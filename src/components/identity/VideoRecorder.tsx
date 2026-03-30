import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  FileVideo,
  ScrollText,
  CheckCircle2,
  ShieldCheck,
  MessageSquare,
  EarOff
} from "lucide-react";
import { VIDEO_CONSTRAINTS, TAVUS_CONSENT_SCRIPT_EN, TAVUS_SPEAKING_SCRIPT_FR } from "@/lib/constants";
import { WavRecorder } from "@/lib/wavRecorder";

// User info for personalized teleprompter
export interface VideoRecorderUserInfo {
  firstName?: string;
  lastName?: string;
  company?: string;
  title?: string;
}

// Recording phases matching Tavus requirements
type RecordingPhase = "consent" | "speaking" | "listening";

interface PhaseConfig {
  key: RecordingPhase;
  label: string;
  icon: typeof ShieldCheck;
  durationSeconds: number;
  color: string;
}

const RECORDING_PHASES: PhaseConfig[] = [
  { key: "consent", label: "Consentement", icon: ShieldCheck, durationSeconds: 15, color: "text-amber-500" },
  { key: "speaking", label: "Parole", icon: MessageSquare, durationSeconds: VIDEO_CONSTRAINTS.SPEAKING_PHASE_SECONDS, color: "text-primary" },
  { key: "listening", label: "Écoute", icon: EarOff, durationSeconds: VIDEO_CONSTRAINTS.LISTENING_PHASE_SECONDS, color: "text-emerald-500" },
];

// Generate personalized consent script
function generateConsentScript(userInfo?: VideoRecorderUserInfo): string {
  const fullName = [userInfo?.firstName, userInfo?.lastName].filter(Boolean).join(" ") || "[YOUR FULL NAME]";
  return TAVUS_CONSENT_SCRIPT_EN.replace("[YOUR FULL NAME]", fullName);
}

// Generate personalized speaking script
function generateSpeakingScript(userInfo?: VideoRecorderUserInfo): string {
  const firstName = userInfo?.firstName || "[votre prénom]";
  const lastName = userInfo?.lastName || "[votre nom]";
  const company = userInfo?.company || "[votre entreprise]";
  const title = userInfo?.title || "[votre fonction]";

  return TAVUS_SPEAKING_SCRIPT_FR
    .replace("[votre prénom]", firstName)
    .replace("[votre nom]", lastName)
    .replace("[votre entreprise]", company)
    .replace("[votre fonction]", title);
}

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
  onAudioReady?: (blob: Blob) => void;
  consentGiven: boolean;
  onConsentChange: (checked: boolean) => void;
  userInfo?: VideoRecorderUserInfo;
  customScript?: string;
  minDurationSeconds?: number;
}

export function VideoRecorder({ onVideoReady, onAudioReady, consentGiven, onConsentChange, userInfo, customScript, minDurationSeconds }: VideoRecorderProps) {
  const minDuration = minDurationSeconds ?? VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS;
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializingCamera, setIsInitializingCamera] = useState(false);
  const [browserSupport, setBrowserSupport] = useState<{ supported: boolean; reason?: string } | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<RecordingPhase>("consent");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wavRecorderRef = useRef<WavRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Determine current phase based on elapsed time
  useEffect(() => {
    if (!isRecording) return;
    
    const consentEnd = RECORDING_PHASES[0].durationSeconds;
    const speakingEnd = consentEnd + RECORDING_PHASES[1].durationSeconds;
    
    if (recordingDuration < consentEnd) {
      setCurrentPhase("consent");
    } else if (recordingDuration < speakingEnd) {
      setCurrentPhase("speaking");
    } else {
      setCurrentPhase("listening");
    }
  }, [recordingDuration, isRecording]);

  // Get the script text for current phase
  const getPhaseScript = useCallback((): string | null => {
    if (customScript) return customScript;
    
    switch (currentPhase) {
      case "consent":
        return `🇬🇧 CONSENTEMENT — Lisez cette phrase EN ANGLAIS :\n\n${generateConsentScript(userInfo)}`;
      case "speaking":
        return `🇫🇷 PAROLE LIBRE — Parlez naturellement :\n\n${generateSpeakingScript(userInfo)}`;
      case "listening":
        return null; // No script during listening
    }
  }, [currentPhase, customScript, userInfo]);

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
          width: { ideal: 1920, min: 1280 }, 
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, min: 25 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      
      streamRef.current = stream;
      setHasPermission(true);
      
      // Wait for next render so videoRef is mounted, then attach stream
      requestAnimationFrame(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch(() => {
            // autoPlay may handle it
          });
        }
      });
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
        setCameraError("Votre caméra ne supporte pas la résolution requise (1080p minimum).");
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
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  // Auto-scroll teleprompter during speaking phases
  useEffect(() => {
    if (isRecording && currentPhase !== "listening" && teleprompterRef.current) {
      const element = teleprompterRef.current;
      element.scrollTop = 0;
      
      const totalScrollHeight = element.scrollHeight - element.clientHeight;
      const phaseDuration = currentPhase === "consent" ? 15000 : 55000;
      const scrollStep = totalScrollHeight / (phaseDuration / 50);
      
      scrollIntervalRef.current = setInterval(() => {
        if (element.scrollTop < totalScrollHeight) {
          element.scrollTop += scrollStep;
        }
      }, 50);
    } else if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [isRecording, currentPhase]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) {
      setRecordingError("La caméra n'est pas initialisée. Veuillez réessayer.");
      return;
    }

    setRecordingError(null);
    chunksRef.current = [];
    setCurrentPhase("consent");
    
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

      // Audio-only WAV recorder (for voice reference / Voxtral cloning)
      const audioTracks = streamRef.current.getAudioTracks();
      if (audioTracks.length > 0 && onAudioReady) {
        try {
          const audioStream = new MediaStream(audioTracks);
          const wavRec = new WavRecorder();
          wavRec.start(audioStream);
          wavRecorderRef.current = wavRec;
        } catch (audioErr) {
          console.warn("WAV audio recorder failed (non-blocking):", audioErr);
        }
      }

      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS) {
            stopRecording();
            toast({
              title: "Durée maximale atteinte",
              description: `L'enregistrement a été arrêté automatiquement après ${VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS / 60} minutes.`,
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
  }, [toast, onAudioReady]);

  const stopRecording = useCallback(() => {
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      if (wavRecorderRef.current && wavRecorderRef.current.isRecording) {
        wavRecorderRef.current.stop().then((wavBlob) => {
          if (wavBlob.size > 0 && onAudioReady) {
            onAudioReady(wavBlob);
          }
        }).catch(err => console.warn("WAV stop error:", err));
        wavRecorderRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } catch (error) {
      console.error("Error stopping recording:", error);
      setIsRecording(false);
    }
  }, [onAudioReady]);

  const resetRecording = useCallback(() => {
    setRecordedBlob(null);
    setRecordingError(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedUrl(null);
    setRecordingDuration(0);
    setCurrentPhase("consent");
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
        description: "Veuillez sélectionner un fichier vidéo (MP4, WebM).",
        variant: "destructive",
      });
      return;
    }

    const maxSize = VIDEO_CONSTRAINTS.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Fichier trop volumineux",
        description: `La taille maximale est de ${VIDEO_CONSTRAINTS.MAX_FILE_SIZE_MB} Mo.`,
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

  const isDurationValid = minDuration === 0 || recordingDuration >= minDuration;

  // Calculate phase progress for the timeline
  const totalPhaseDuration = RECORDING_PHASES.reduce((sum, p) => sum + p.durationSeconds, 0);
  const getPhaseProgress = () => {
    let elapsed = recordingDuration;
    return RECORDING_PHASES.map((phase) => {
      const phaseElapsed = Math.min(elapsed, phase.durationSeconds);
      elapsed = Math.max(0, elapsed - phase.durationSeconds);
      return {
        ...phase,
        progress: phase.durationSeconds > 0 ? (phaseElapsed / phase.durationSeconds) * 100 : 0,
        completed: phaseElapsed >= phase.durationSeconds,
        active: phaseElapsed > 0 && phaseElapsed < phase.durationSeconds,
      };
    });
  };

  const phaseScript = getPhaseScript();

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
                <p className="text-sm">Initialisation de la caméra (1080p)...</p>
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

        {/* Recording indicator + phase timeline */}
        {isRecording && (
          <div className="absolute top-4 left-4 right-4 z-10 space-y-2">
            {/* Timer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm w-fit">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                {formatTime(recordingDuration)} / {formatTime(totalPhaseDuration)}
              </div>
              {/* Current phase badge */}
              <Badge variant="secondary" className="bg-black/70 text-white border-0 text-xs">
                {currentPhase === "consent" && "🇬🇧 Consentement"}
                {currentPhase === "speaking" && "🇫🇷 Parole"}
                {currentPhase === "listening" && "🤫 Écoute silencieuse"}
              </Badge>
            </div>

            {/* Phase progress bar */}
            <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
              <div className="flex gap-1 h-2">
                {getPhaseProgress().map((phase) => (
                  <div
                    key={phase.key}
                    className="relative flex-1 bg-white/20 rounded-full overflow-hidden"
                    title={phase.label}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                        phase.completed ? "bg-emerald-500" : phase.active ? "bg-primary" : "bg-white/10"
                      }`}
                      style={{ width: `${phase.progress}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {RECORDING_PHASES.map((phase) => (
                  <span key={phase.key} className={`text-[10px] ${currentPhase === phase.key ? "text-white" : "text-white/50"}`}>
                    {phase.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Min duration indicator */}
            {recordingDuration >= minDuration && (
              <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs text-emerald-400 w-fit">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Durée minimum atteinte — vous pouvez arrêter
              </div>
            )}
          </div>
        )}

        {/* Teleprompter overlay during recording */}
        {isRecording && currentPhase !== "listening" && phaseScript && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 z-10">
            <div className="flex items-center gap-2 text-white/80 mb-2">
              <ScrollText className="h-4 w-4" />
              <span className="text-xs font-medium">
                {currentPhase === "consent" ? "Lisez EN ANGLAIS :" : "Lisez naturellement :"}
              </span>
            </div>
            <div 
              ref={teleprompterRef}
              className="h-24 overflow-hidden text-white text-center"
            >
              <div className="space-y-3 py-2">
                {phaseScript.split('\n\n').map((paragraph, index) => (
                  <p 
                    key={index} 
                    className="text-sm md:text-base leading-relaxed font-medium"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Listening phase overlay */}
        {isRecording && currentPhase === "listening" && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-6 z-10">
            <div className="flex flex-col items-center gap-3 text-white">
              <EarOff className="h-8 w-8 text-emerald-400" />
              <div className="text-center">
                <p className="text-base font-semibold">Phase d'écoute silencieuse</p>
                <p className="text-sm text-white/70 mt-1">
                  Restez immobile • Lèvres fermées • Regard vers la caméra
                </p>
                <p className="text-xs text-white/50 mt-1">
                  Un sourire léger occasionnel est bienvenu 😊
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {hasPermission && !recordedUrl && (
        <div className="flex justify-center gap-4">
          {!isRecording ? (
            <Button onClick={startRecording} size="lg">
              <Play className="h-5 w-5 mr-2" />
              Démarrer l'enregistrement
            </Button>
          ) : (
            <Button 
              onClick={stopRecording} 
              variant="destructive" 
              size="lg"
              disabled={minDuration > 0 && recordingDuration < minDuration}
            >
              <Square className="h-5 w-5 mr-2" />
              Arrêter{minDuration > 0 && recordingDuration < minDuration ? ` (${formatTime(minDuration - recordingDuration)} restant)` : ""}
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
      {recordedUrl && !isDurationValid && minDuration > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            La vidéo doit faire au moins {formatTime(minDuration)} ({minDuration} secondes). 
            Durée actuelle : {formatTime(recordingDuration)}
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
          accept="video/mp4,video/webm"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
        >
          <FileVideo className="h-4 w-4 mr-2" />
          Importer une vidéo existante (MP4, WebM — max {VIDEO_CONSTRAINTS.MAX_FILE_SIZE_MB} Mo)
        </Button>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          La vidéo importée doit respecter les exigences : 1080p min, 25 fps, 2 min minimum (1 min parole + 1 min écoute), 
          avec le consentement Tavus prononcé en anglais au début.
        </p>
      </div>

      {/* Consent checkbox */}
      {recordedUrl && isDurationValid && (
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
          <Checkbox
            id="consent"
            checked={consentGiven}
            onCheckedChange={(checked) => onConsentChange(checked === true)}
          />
          <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
            J'autorise l'utilisation de mon image et de ma voix pour la création d'un avatar vidéo 
            par intelligence artificielle. Je confirme avoir prononcé la phrase de consentement en anglais 
            dans l'enregistrement. Je comprends que cet avatar sera utilisé pour générer des vidéos 
            personnalisées dans le cadre des campagnes de mon organisation.
          </Label>
        </div>
      )}
    </div>
  );
}
