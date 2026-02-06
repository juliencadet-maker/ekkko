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
  ArrowRight
} from "lucide-react";
import { ONBOARDING_STEPS, SUGGESTED_SCRIPT, VIDEO_CONSTRAINTS, IDENTITY_TYPES } from "@/lib/constants";

type OnboardingStep = "welcome" | "profile" | "facecam" | "identity" | "complete";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Identity
  const [identityType, setIdentityType] = useState<string>("other");
  const [consentGiven, setConsentGiven] = useState(false);

  const navigate = useNavigate();
  const { user, profile, refreshUser } = useAuthContext();
  const { logEvent } = useAuditLog();
  const { toast } = useToast();

  // Log onboarding started
  useEffect(() => {
    logEvent({ eventType: "onboarding_started" });
  }, [logEvent]);

  // Calculate progress
  const stepIndex = ONBOARDING_STEPS.findIndex(s => s.key === currentStep);
  const progress = ((stepIndex + 1) / ONBOARDING_STEPS.length) * 100;

  // Initialize camera
  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
    } catch (error) {
      console.error("Camera error:", error);
      setHasPermission(false);
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
    };
  }, []);

  // Start recording
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: "video/webm;codecs=vp9",
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
    };

    mediaRecorder.start(1000);
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
    setRecordingDuration(0);

    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingDuration(prev => {
        if (prev >= VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS) {
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [isRecording]);

  // Reset recording
  const resetRecording = useCallback(() => {
    setRecordedBlob(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedUrl(null);
    setRecordingDuration(0);
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [recordedUrl]);

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

      // Store path for identity creation
      localStorage.setItem("ekko_onboarding_video_path", path);
      localStorage.setItem("ekko_onboarding_video_duration", recordingDuration.toString());

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

      const videoPath = localStorage.getItem("ekko_onboarding_video_path");
      const videoDuration = parseInt(localStorage.getItem("ekko_onboarding_video_duration") || "0");
      const hasVideo = !!videoPath;

      const displayName = `${title} – ${firstName} ${lastName}`;

      // Create identity
      const { data: identity, error: identityError } = await supabase
        .from("identities")
        .insert({
          org_id: membership.org_id,
          owner_user_id: user.id,
          provider_id: provider?.id || null,
          display_name: displayName,
          type: identityType as any,
          status: hasVideo ? "ready" : "draft",
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
                  Enregistrez une vidéo de 30 à 60 secondes. Cette vidéo servira de référence pour générer vos futures vidéos personnalisées.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Video Preview */}
                <div className={`facecam-preview ${isRecording ? "facecam-preview-active" : ""}`}>
                  {recordedUrl ? (
                    <video
                      src={recordedUrl}
                      controls
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  )}
                  {isRecording && (
                    <div className="absolute top-4 left-4 recording-indicator">
                      <span className="recording-dot" />
                      REC {formatTime(recordingDuration)}
                    </div>
                  )}
                </div>

                {/* Recording Controls */}
                {hasPermission === null ? (
                  <Button onClick={initCamera} className="w-full">
                    <Video className="mr-2 h-4 w-4" />
                    Activer la caméra
                  </Button>
                ) : hasPermission === false ? (
                  <div className="text-center p-4 bg-destructive/10 rounded-lg">
                    <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                    <p className="text-sm text-destructive">
                      Accès à la caméra refusé. Vous pouvez ignorer cette étape ou importer une vidéo.
                    </p>
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
                          <Button onClick={stopRecording} variant="destructive" className="flex-1">
                            <Square className="mr-2 h-4 w-4" />
                            Arrêter ({formatTime(recordingDuration)})
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

                {/* Suggested Script */}
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Script suggéré :</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {SUGGESTED_SCRIPT}
                  </p>
                </div>

                {/* Consent */}
                {recordedBlob && (
                  <div className="flex items-start gap-3 p-4 border rounded-lg">
                    <Checkbox 
                      id="consent"
                      checked={consentGiven}
                      onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
                    />
                    <Label htmlFor="consent" className="text-sm cursor-pointer">
                      J'accepte d'utiliser cette vidéo comme vidéo de référence pour mon identité Ekko.
                    </Label>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep("identity")} 
                    className="flex-1"
                  >
                    Ignorer
                  </Button>
                  <Button 
                    onClick={handleVideoUpload} 
                    className="flex-1"
                    disabled={isLoading || (recordedBlob && !consentGiven)}
                  >
                    {isLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi...</>
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
