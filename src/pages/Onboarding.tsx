import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  CheckCircle2, 
  Video, 
  User, 
  Sparkles,
  Play,
  Square,
  RotateCcw,
  Upload,
  AlertCircle,
  ArrowRight,
  AlertTriangle,
  Camera,
  FileVideo,
  ScrollText
} from "lucide-react";
import { ONBOARDING_STEPS, SUGGESTED_SCRIPT, VIDEO_CONSTRAINTS, IDENTITY_TYPES } from "@/lib/constants";

type OnboardingStep = "welcome" | "profile" | "facecam" | "identity" | "complete";

// Supported MIME types in order of preference
const SUPPORTED_MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

// Get best supported MIME type for the browser
function getSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mimeType of SUPPORTED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return null;
}

// Check if browser supports all required APIs
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

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [isLoading, setIsLoading] = useState(false);

  // Profile form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Video recording
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
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Teleprompter state
  const [showTeleprompter, setShowTeleprompter] = useState(false);

  // Generate personalized teleprompter script
  const generateTeleprompterScript = useCallback(() => {
    const displayFirstName = firstName || "[votre prénom]";
    const displayLastName = lastName || "[votre nom]";
    const displayCompany = company || "[votre entreprise]";
    const displayTitle = title || "[votre fonction]";

    return `Bonjour, je m'appelle ${displayFirstName} ${displayLastName}.

Je travaille chez ${displayCompany} en tant que ${displayTitle}.

Je fais cet enregistrement car bientôt je serai en mesure de créer plus de confiance sur le cycle de vente, tout en gagnant du temps.

Je pourrai également être présent sur tous les deals sans avoir à bloquer mon agenda.

Cela me permettra d'impliquer des personnes plus facilement, afin de créer plus de confiance et d'engagement avec mes clients et partenaires.

Avec Ekko, je vais pouvoir personnaliser mes messages vidéo pour chaque prospect, et ainsi augmenter significativement mes taux de conversion.

Merci de votre attention !`;
  }, [firstName, lastName, company, title]);

  // Identity
  const [identityType, setIdentityType] = useState<string>("other");
  const [consentGiven, setConsentGiven] = useState(false);
  
  // Video path storage (more reliable than localStorage)
  const [savedVideoPath, setSavedVideoPath] = useState<string | null>(null);
  const [savedVideoDuration, setSavedVideoDuration] = useState<number>(0);

  const navigate = useNavigate();
  const { user, profile, refreshUser } = useAuthContext();
  const { logEvent } = useAuditLog();
  const { toast } = useToast();

  // Log onboarding started and check browser support
  useEffect(() => {
    logEvent({ eventType: "onboarding_started" });
    setBrowserSupport(checkBrowserSupport());
  }, [logEvent]);

  // Calculate progress
  const stepIndex = ONBOARDING_STEPS.findIndex(s => s.key === currentStep);
  const progress = ((stepIndex + 1) / ONBOARDING_STEPS.length) * 100;

  // Initialize camera with comprehensive error handling
  const initCamera = useCallback(async () => {
    setIsInitializingCamera(true);
    setCameraError(null);
    setRecordingError(null);
    
    try {
      // Check browser support first
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
        // Wait for video to be ready
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
      
      // Provide specific error messages based on error type
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

  // Cleanup camera on unmount
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
    };
  }, []);

  // Auto-scroll teleprompter during recording
  useEffect(() => {
    if (isRecording && showTeleprompter && teleprompterRef.current) {
      const element = teleprompterRef.current;
      element.scrollTop = 0;
      
      // Calculate scroll speed: total scroll height over ~35 seconds for comfortable reading
      const totalScrollHeight = element.scrollHeight - element.clientHeight;
      const scrollDuration = 35000; // 35 seconds
      const scrollStep = totalScrollHeight / (scrollDuration / 50); // Update every 50ms
      
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
  }, [isRecording, showTeleprompter]);

  // Start recording with error handling
  const startRecording = useCallback(() => {
    if (!streamRef.current) {
      setRecordingError("La caméra n'est pas initialisée. Veuillez réessayer.");
      return;
    }

    setRecordingError(null);
    chunksRef.current = [];
    setShowTeleprompter(true);
    
    try {
      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        setRecordingError("Aucun format d'enregistrement compatible trouvé.");
        setShowTeleprompter(false);
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
        setShowTeleprompter(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer with auto-stop at max duration
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
      setShowTeleprompter(false);
    }
  }, [toast]);

  // Stop recording safely
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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      setShowTeleprompter(false);
    } catch (error) {
      console.error("Error stopping recording:", error);
      setIsRecording(false);
      setShowTeleprompter(false);
    }
  }, []);

  // Reset recording
  const resetRecording = useCallback(() => {
    setRecordedBlob(null);
    setRecordingError(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedUrl(null);
    setRecordingDuration(0);
    setConsentGiven(false);
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [recordedUrl]);

  // Handle file upload as alternative to recording
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast({
        title: "Format invalide",
        description: "Veuillez sélectionner un fichier vidéo (MP4, WebM, MOV).",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 100 Mo.",
        variant: "destructive",
      });
      return;
    }

    // Create blob and URL
    setRecordedBlob(file);
    setRecordedUrl(URL.createObjectURL(file));
    setRecordingError(null);
    
    // Try to get video duration
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

  // Handle profile submission
  const handleProfileSubmit = async () => {
    if (!firstName || !lastName || !title) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          title,
          company,
          timezone,
          onboarding_step: 2,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      await logEvent({ 
        eventType: "onboarding_profile_completed",
        newValues: { firstName, lastName, title }
      });

      toast({ title: "Profil enregistré ✓" });
      setCurrentStep("facecam");
    } catch (error) {
      console.error("Profile update error:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le profil",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle video upload
  const handleVideoUpload = async () => {
    if (!recordedBlob) {
      // Allow skipping
      setCurrentStep("identity");
      return;
    }

    if (!consentGiven) {
      toast({
        title: "Consentement requis",
        description: "Veuillez accepter les conditions pour continuer",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Get user's org_id
      const { data: membership } = await supabase
        .from("org_memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!membership) throw new Error("No org membership found");

      const timestamp = Date.now();
      const path = `identities/${membership.org_id}/onboarding/${user.id}/${timestamp}.webm`;

      const { error: uploadError } = await supabase.storage
        .from("identity_assets")
        .upload(path, recordedBlob, {
          contentType: "video/webm",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      await supabase
        .from("profiles")
        .update({ onboarding_step: 3 })
        .eq("user_id", user.id);

      await logEvent({ 
        eventType: "onboarding_video_recorded",
        metadata: { duration: recordingDuration, path }
      });

      // Store path in state for identity creation (more reliable than localStorage)
      setSavedVideoPath(path);
      setSavedVideoDuration(recordingDuration);

      toast({ title: "Vidéo enregistrée ✓" });
      setCurrentStep("identity");
    } catch (error) {
      console.error("Video upload error:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la vidéo",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle identity creation and completion
  const handleComplete = async () => {
    setIsLoading(true);
    try {
      const { data: membership } = await supabase
        .from("org_memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!membership) throw new Error("No org membership found");

      // Get provider
      const { data: provider } = await supabase
        .from("providers")
        .select("id")
        .eq("org_id", membership.org_id)
        .eq("provider_type", "mock")
        .eq("is_active", true)
        .single();

      const displayName = `${title} – ${firstName} ${lastName}`;

      // Create identity - always set to "ready" since onboarding requires video
      // Use state values (more reliable) or fallback to localStorage for page refresh scenarios
      const videoPath = savedVideoPath || localStorage.getItem("ekko_onboarding_video_path");
      const videoDuration = savedVideoDuration || parseInt(localStorage.getItem("ekko_onboarding_video_duration") || "0");

      const { data: identity, error: identityError } = await supabase
        .from("identities")
        .insert({
          org_id: membership.org_id,
          owner_user_id: user.id,
          provider_id: provider?.id || null,
          display_name: displayName,
          type: identityType as any,
          status: "ready", // Always ready - onboarding requires completing video step
          reference_video_path: videoPath,
          reference_video_duration: videoDuration || null,
          consent_given: consentGiven,
          consent_given_at: consentGiven ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (identityError) throw identityError;

      // Update profile with default identity and complete onboarding
      await supabase
        .from("profiles")
        .update({
          default_identity_id: identity.id,
          onboarding_completed: true,
          onboarding_step: 5,
        })
        .eq("user_id", user.id);

      await logEvent({ 
        eventType: "identity_created",
        entityType: "identity",
        entityId: identity.id,
        newValues: { displayName, type: identityType }
      });

      await logEvent({ eventType: "onboarding_completed" });

      // Cleanup
      localStorage.removeItem("ekko_onboarding_video_path");
      localStorage.removeItem("ekko_onboarding_video_duration");

      toast({ title: "Configuration terminée ! 🎉" });
      setCurrentStep("complete");
    } catch (error) {
      console.error("Completion error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de finaliser la configuration",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate to dashboard
  const goToDashboard = async () => {
    await refreshUser();
    navigate("/app/dashboard", { replace: true });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Étape {stepIndex + 1} sur {ONBOARDING_STEPS.length}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {ONBOARDING_STEPS.map((step, index) => {
            const isActive = step.key === currentStep;
            const isCompleted = index < stepIndex;
            return (
              <div key={step.id} className="onboarding-step">
                <div className={`onboarding-step-number ${
                  isCompleted ? "onboarding-step-completed" :
                  isActive ? "onboarding-step-active" :
                  "onboarding-step-pending"
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                </div>
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <Card className="animate-fade-in">
          {/* WELCOME */}
          {currentStep === "welcome" && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Sparkles className="h-8 w-8" />
                </div>
                <CardTitle className="text-2xl">Bonjour 👋 Bienvenue sur Ekko</CardTitle>
                <CardDescription className="text-base mt-2">
                  Configurons votre compte en quelques étapes simples pour commencer à créer des vidéos personnalisées.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Button 
                  onClick={() => setCurrentStep("profile")} 
                  className="w-full"
                  size="lg"
                >
                  Commencer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </>
          )}

          {/* PROFILE */}
          {currentStep === "profile" && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Votre profil
                </CardTitle>
                <CardDescription>
                  Ces informations seront utilisées pour créer votre identité Ekko.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom *</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jean"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom *</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Dupont"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Fonction *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Directeur Commercial"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Entreprise (optionnel)</Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Corp"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuseau horaire</Label>
                  <Input
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="Europe/Paris"
                  />
                </div>

                <Button 
                  onClick={handleProfileSubmit} 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</>
                  ) : (
                    <>Continuer<ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </CardContent>
            </>
          )}

          {/* FACECAM */}
          {currentStep === "facecam" && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Vidéo de référence
                </CardTitle>
                <CardDescription>
                  Enregistrez une vidéo de {VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS} à {VIDEO_CONSTRAINTS.RECOMMENDED_DURATION_SECONDS} secondes. 
                  Cette vidéo servira de référence pour générer vos futures vidéos personnalisées.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Browser Support Warning */}
                {browserSupport && !browserSupport.supported && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {browserSupport.reason} Vous pouvez importer une vidéo ou ignorer cette étape.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Recording Error Display */}
                {recordingError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{recordingError}</AlertDescription>
                  </Alert>
                )}

                {/* Video Preview */}
                <div className={`facecam-preview ${isRecording ? "facecam-preview-active" : ""}`}>
                  {recordedUrl ? (
                    <video
                      src={recordedUrl}
                      controls
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : hasPermission ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted rounded-lg">
                      <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground">
                        {isInitializingCamera ? "Initialisation de la caméra..." : "Activez la caméra pour commencer"}
                      </p>
                    </div>
                  )}
                  
                  {/* Recording Indicator with Duration Warnings */}
                  {isRecording && (
                    <div className={`absolute top-4 left-4 recording-indicator ${
                      recordingDuration >= VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS - 10 ? "bg-amber-600" : ""
                    }`}>
                      <span className="recording-dot" />
                      REC {formatTime(recordingDuration)}
                    </div>
                  )}
                  
                  {/* Duration Warning Overlay */}
                  {isRecording && recordingDuration >= VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS - 10 && (
                    <div className="absolute bottom-4 left-4 right-4 bg-amber-600/90 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>
                        {recordingDuration >= VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS - 5
                          ? `Arrêt automatique dans ${VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS - recordingDuration}s`
                          : "La durée maximale approche"
                        }
                      </span>
                    </div>
                  )}
                  
                  {/* Teleprompter overlay during recording */}
                  {isRecording && showTeleprompter && recordingDuration < VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS - 10 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 z-10">
                      <div className="flex items-center gap-2 text-white/80 mb-2">
                        <ScrollText className="h-4 w-4" />
                        <span className="text-xs font-medium">Lisez le script ci-dessous</span>
                      </div>
                      <div 
                        ref={teleprompterRef}
                        className="h-24 overflow-hidden text-white text-center"
                      >
                        <div className="space-y-3 py-2">
                          {generateTeleprompterScript().split('\n\n').map((paragraph, index) => (
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
                </div>

                {/* Duration Info Bar */}
                {(isRecording || recordedBlob) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Durée : <span className={`font-medium ${
                        recordingDuration < VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS 
                          ? "text-amber-600" 
                          : recordingDuration <= VIDEO_CONSTRAINTS.RECOMMENDED_DURATION_SECONDS 
                            ? "text-green-600" 
                            : "text-amber-600"
                      }`}>{formatTime(recordingDuration)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {recordingDuration < VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS && (
                        <span className="text-amber-600">Min. {VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS}s</span>
                      )}
                      {recordingDuration >= VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS && 
                       recordingDuration <= VIDEO_CONSTRAINTS.RECOMMENDED_DURATION_SECONDS && (
                        <span className="text-green-600">✓ Durée idéale</span>
                      )}
                      {recordingDuration > VIDEO_CONSTRAINTS.RECOMMENDED_DURATION_SECONDS && (
                        <span className="text-amber-600">Max. {VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS}s</span>
                      )}
                    </span>
                  </div>
                )}

                {/* Recording Controls */}
                {browserSupport?.supported !== false && (
                  <>
                    {hasPermission === null ? (
                      <Button 
                        onClick={initCamera} 
                        className="w-full"
                        disabled={isInitializingCamera}
                      >
                        {isInitializingCamera ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Initialisation...</>
                        ) : (
                          <><Camera className="mr-2 h-4 w-4" />Activer la caméra</>
                        )}
                      </Button>
                    ) : hasPermission === false ? (
                      <div className="space-y-3">
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="space-y-2">
                            <p className="font-medium">{cameraError || "Accès à la caméra refusé"}</p>
                            <p className="text-xs opacity-90">
                              Pour activer la caméra, cliquez sur l'icône de caméra dans la barre d'adresse 
                              et autorisez l'accès, puis actualisez la page.
                            </p>
                          </AlertDescription>
                        </Alert>
                        <Button 
                          onClick={initCamera} 
                          variant="outline" 
                          className="w-full"
                          disabled={isInitializingCamera}
                        >
                          {isInitializingCamera ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Réessai...</>
                          ) : (
                            <><RotateCcw className="mr-2 h-4 w-4" />Réessayer l'accès caméra</>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {!recordedUrl ? (
                          <>
                            {!isRecording ? (
                              <Button onClick={startRecording} className="flex-1">
                                <Play className="mr-2 h-4 w-4" />
                                Commencer l'enregistrement
                              </Button>
                            ) : (
                              <Button 
                                onClick={stopRecording} 
                                variant={recordingDuration < VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS ? "outline" : "destructive"} 
                                className="flex-1"
                              >
                                <Square className="mr-2 h-4 w-4" />
                                Arrêter ({formatTime(recordingDuration)})
                                {recordingDuration < VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS && (
                                  <span className="ml-2 text-xs opacity-75">min. {VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS}s</span>
                                )}
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button onClick={resetRecording} variant="outline" className="flex-1">
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Recommencer
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* File Upload Alternative */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">ou</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileVideo className="mr-2 h-4 w-4" />
                    Importer une vidéo existante
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Formats acceptés : MP4, WebM, MOV • Taille max. 100 Mo
                  </p>
                </div>

                {/* Suggested Script */}
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">💡 Script suggéré :</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {SUGGESTED_SCRIPT}
                  </p>
                </div>

                {/* Consent */}
                {recordedBlob && (
                  <div className={`flex items-start gap-3 p-4 border rounded-lg transition-colors ${
                    !consentGiven ? "border-amber-500/50 bg-amber-500/5" : "border-green-500/50 bg-green-500/5"
                  }`}>
                    <Checkbox 
                      id="consent"
                      checked={consentGiven}
                      onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
                    />
                    <Label htmlFor="consent" className="text-sm cursor-pointer">
                      J'accepte d'utiliser cette vidéo comme vidéo de référence pour mon identité Ekko. 
                      Je confirme que je suis bien la personne apparaissant dans cette vidéo.
                    </Label>
                  </div>
                )}

                {/* Duration Warning for Short Videos */}
                {recordedBlob && recordingDuration > 0 && recordingDuration < VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Votre vidéo est plus courte que la durée minimale recommandée ({VIDEO_CONSTRAINTS.MIN_DURATION_SECONDS}s). 
                      Vous pouvez continuer, mais une vidéo plus longue donnera de meilleurs résultats.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep("identity")} 
                    className="flex-1"
                  >
                    Ignorer cette étape
                  </Button>
                  <Button 
                    onClick={handleVideoUpload} 
                    className="flex-1"
                    disabled={isLoading || (recordedBlob && !consentGiven)}
                  >
                    {isLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi en cours...</>
                    ) : (
                      <>Continuer<ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* IDENTITY */}
          {currentStep === "identity" && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Votre identité Ekko
                </CardTitle>
                <CardDescription>
                  Choisissez le type d'identité qui vous correspond le mieux.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{title} – {firstName} {lastName}</p>
                  {company && <p className="text-sm text-muted-foreground">{company}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Type d'identité</Label>
                  <Select value={identityType} onValueChange={setIdentityType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {IDENTITY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleComplete} 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création...</>
                  ) : (
                    <>Finaliser la configuration<ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </CardContent>
            </>
          )}

          {/* COMPLETE */}
          {currentStep === "complete" && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success text-success-foreground">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <CardTitle className="text-2xl">Tout est prêt ✅</CardTitle>
                <CardDescription className="text-base mt-2">
                  Votre compte Ekko est configuré. Vous pouvez maintenant créer votre première campagne vidéo.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-3">
                <Button onClick={goToDashboard} className="w-full" size="lg">
                  Aller au tableau de bord
                </Button>
                <Button 
                  onClick={() => navigate("/app/campaigns/new")} 
                  variant="outline" 
                  className="w-full"
                >
                  Créer une campagne
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
