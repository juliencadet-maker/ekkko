import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Play, 
  Square, 
  RotateCcw, 
  Upload, 
  AlertCircle, 
  AlertTriangle,
  Camera,
  FileVideo
} from "lucide-react";
import { VIDEO_CONSTRAINTS, SUGGESTED_SCRIPT } from "@/lib/constants";

// Supported MIME types in order of preference
const SUPPORTED_MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

function getSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mimeType of SUPPORTED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return null;
}

function checkBrowserSupport(): { supported: boolean; reason?: string } {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return { supported: false, reason: "Votre navigateur ne supporte pas l'accès à la caméra." };
  }
  if (typeof MediaRecorder === "undefined") {
    return { supported: false, reason: "Votre navigateur ne supporte pas l'enregistrement vidéo." };
  }
  if (!getSupportedMimeType()) {
    return { supported: false, reason: "Aucun format vidéo compatible n'est disponible." };
  }
  return { supported: true };
}

interface VideoRecorderProps {
  onVideoReady: (blob: Blob, duration: number) => void;
  consentGiven: boolean;
  onConsentChange: (checked: boolean) => void;
}

export function VideoRecorder({ onVideoReady, consentGiven, onConsentChange }: VideoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializingCamera, setIsInitializingCamera] = useState(false);
  const [browserSupport, setBrowserSupport] = useState<{ supported: boolean; reason?: string } | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    setBrowserSupport(checkBrowserSupport());
  }, []);

  // Notify parent when video is ready
  useEffect(() => {
    if (recordedBlob && consentGiven) {
      onVideoReady(recordedBlob, recordingDuration);
    }
  }, [recordedBlob, consentGiven, recordingDuration, onVideoReady]);

  const initCamera = useCallback(async () => {
    setIsInitializingCamera(true);
    setCameraError(null);
    setRecordingError(null);
    
    try {
      const support = checkBrowserSupport();
      if (!support.supported) {
        setCameraError(support.reason || "Navigateur non supporté");
        setHasPermission(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "user", 
          width: { ideal: 1280, min: 640 }, 
          height: { ideal: 720, min: 480 } 
        },
        audio: true,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve, reject) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve();
            videoRef.current.onerror = () => reject(new Error("Erreur de chargement vidéo"));
            setTimeout(() => reject(new Error("Timeout lors du chargement")), 10000);
          } else {
            reject(new Error("Référence vidéo manquante"));
          }
        });
      }
      setHasPermission(true);
    } catch (error: unknown) {
      console.error("Camera error:", error);
      setHasPermission(false);
      
      const err = error as Error & { name?: string };
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Accès à la caméra refusé. Veuillez autoriser l'accès dans les paramètres de votre navigateur.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("Aucune caméra détectée. Veuillez connecter une webcam.");
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setCameraError("La caméra est utilisée par une autre application. Veuillez la fermer et réessayer.");
      } else if (err.name === "OverconstrainedError") {
        setCameraError("Votre caméra ne supporte pas la résolution requise.");
      } else if (err.name === "TypeError") {
        setCameraError("Erreur de configuration. Veuillez actualiser la page.");
      } else {
        setCameraError(err.message || "Erreur inattendue lors de l'accès à la caméra.");
      }
    } finally {
      setIsInitializingCamera(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) {
      setRecordingError("La caméra n'est pas initialisée. Veuillez réessayer.");
      return;
    }

    setRecordingError(null);
    chunksRef.current = [];
    
    try {
      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        setRecordingError("Aucun format d'enregistrement compatible trouvé.");
        return;
      }

      const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        try {
          if (chunksRef.current.length === 0) {
            setRecordingError("Aucune donnée enregistrée. Veuillez réessayer.");
            return;
          }
          const blob = new Blob(chunksRef.current, { type: mimeType });
          if (blob.size === 0) {
            setRecordingError("L'enregistrement est vide. Veuillez réessayer.");
            return;
          }
          setRecordedBlob(blob);
          setRecordedUrl(URL.createObjectURL(blob));
        } catch (e) {
          console.error("Error creating blob:", e);
          setRecordingError("Erreur lors de la création de la vidéo.");
        }
      };

      mediaRecorder.onerror = (event: Event) => {
        console.error("MediaRecorder error:", event);
        setRecordingError("Erreur pendant l'enregistrement. Veuillez réessayer.");
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS) {
            stopRecording();
            toast({
              title: "Durée maximale atteinte",
              description: `L'enregistrement a été arrêté automatiquement après ${VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS} secondes.`,
            });
            return prev;
          }
          return newDuration;
        });
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      setRecordingError("Impossible de démarrer l'enregistrement. Veuillez actualiser la page.");
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } catch (error) {
      console.error("Error stopping recording:", error);
      setIsRecording(false);
    }
  }, []);

  const resetRecording = useCallback(() => {
    setRecordedBlob(null);
    setRecordingError(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedUrl(null);
    setRecordingDuration(0);
    onConsentChange(false);
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [recordedUrl, onConsentChange]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast({
        title: "Format invalide",
        description: "Veuillez sélectionner un fichier vidéo (MP4, WebM, MOV).",
        variant: "destructive",
      });
      return;
    }

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 100 Mo.",
        variant: "destructive",
      });
      return;
    }

    setRecordedBlob(file);
    setRecordedUrl(URL.createObjectURL(file));
    setRecordingError(null);
    
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setRecordingDuration(Math.round(video.duration));
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);

    toast({
      title: "Vidéo importée",
      description: "Vous pouvez prévisualiser votre vidéo ci-dessus.",
    });
  }, [toast]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isDurationValid = recordingDuration >= VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS;

  return (
    <div className="space-y-4">
      {/* Browser not supported */}
      {browserSupport && !browserSupport.supported && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {browserSupport.reason}
            <br />
            <span className="text-sm">Vous pouvez importer une vidéo existante à la place.</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Video area */}
      <div className="relative bg-muted rounded-lg overflow-hidden aspect-video">
        {recordedUrl ? (
          <video
            src={recordedUrl}
            controls
            className="w-full h-full object-cover"
          />
        ) : hasPermission ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover mirror"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <Camera className="h-12 w-12 mb-4" />
            {isInitializingCamera ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                <p className="text-sm">Initialisation de la caméra...</p>
              </>
            ) : cameraError ? (
              <div className="text-center px-4">
                <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive">{cameraError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={initCamera}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Réessayer
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm mb-4">Cliquez pour activer la caméra</p>
                <Button onClick={initCamera}>
                  <Camera className="h-4 w-4 mr-2" />
                  Activer la caméra
                </Button>
              </>
            )}
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            {formatTime(recordingDuration)} / {formatTime(VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS)}
          </div>
        )}
      </div>

      {/* Controls */}
      {hasPermission && !recordedUrl && (
        <div className="flex justify-center gap-4">
          {!isRecording ? (
            <Button onClick={startRecording} size="lg">
              <Play className="h-5 w-5 mr-2" />
              Démarrer
            </Button>
          ) : (
            <Button 
              onClick={stopRecording} 
              variant="destructive" 
              size="lg"
              disabled={recordingDuration < VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS}
            >
              <Square className="h-5 w-5 mr-2" />
              Arrêter ({VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS}s min)
            </Button>
          )}
        </div>
      )}

      {recordedUrl && (
        <div className="flex justify-center gap-4">
          <Button onClick={resetRecording} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Recommencer
          </Button>
        </div>
      )}

      {/* Duration validation */}
      {recordedUrl && !isDurationValid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            La vidéo doit faire au moins {VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS} secondes. 
            Durée actuelle : {recordingDuration}s
          </AlertDescription>
        </Alert>
      )}

      {recordingError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{recordingError}</AlertDescription>
        </Alert>
      )}

      {/* File upload alternative */}
      <div className="border-t pt-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
        >
          <FileVideo className="h-4 w-4 mr-2" />
          Importer une vidéo existante
        </Button>
      </div>

      {/* Suggested script */}
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm font-medium mb-2">📝 Script suggéré :</p>
        <p className="text-sm text-muted-foreground whitespace-pre-line">{SUGGESTED_SCRIPT}</p>
      </div>

      {/* Consent */}
      {recordedUrl && isDurationValid && (
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
          <Checkbox
            id="consent"
            checked={consentGiven}
            onCheckedChange={(checked) => onConsentChange(checked === true)}
          />
          <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
            J'autorise l'utilisation de mon image pour la génération de vidéos personnalisées 
            dans le cadre des campagnes de mon organisation. Je comprends que cette vidéo sera 
            utilisée comme référence pour créer du contenu synthétique.
          </Label>
        </div>
      )}
    </div>
  );
}
