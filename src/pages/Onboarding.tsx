import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { heygenApi } from "@/lib/api/heygen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Upload,
  AlertCircle,
  ArrowRight,
  FileVideo,
} from "lucide-react";
import { ONBOARDING_STEPS, VIDEO_CONSTRAINTS, IDENTITY_TYPES } from "@/lib/constants";

type OnboardingStep = "welcome" | "profile" | "identity" | "complete";

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [isLoading, setIsLoading] = useState(false);

  // Profile form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Identity
  const [identityType, setIdentityType] = useState<string>("other");
  const [consentGiven, setConsentGiven] = useState(false);
  
  // Video uploads
  const [trainingVideo, setTrainingVideo] = useState<File | null>(null);
  const [consentVideo, setConsentVideo] = useState<File | null>(null);
  const [trainingVideoPreview, setTrainingVideoPreview] = useState<string | null>(null);
  const [consentVideoPreview, setConsentVideoPreview] = useState<string | null>(null);
  const [cloneStatus, setCloneStatus] = useState<"idle" | "uploading" | "creating" | "pending">("idle");
  
  const trainingInputRef = useRef<HTMLInputElement>(null);
  const consentInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const { user, profile, refreshUser } = useAuthContext();
  const { logEvent } = useAuditLog();
  const { toast } = useToast();

  useEffect(() => {
    logEvent({ eventType: "onboarding_started" });
  }, [logEvent]);

  const stepIndex = ONBOARDING_STEPS.findIndex(s => s.key === currentStep);
  const progress = ((stepIndex + 1) / ONBOARDING_STEPS.length) * 100;

  const handleFileSelect = (type: "training" | "consent") => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast({ title: "Format invalide", description: "Veuillez sélectionner un fichier vidéo (MP4, WebM, MOV).", variant: "destructive" });
      return;
    }

    const maxSize = VIDEO_CONSTRAINTS.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Fichier trop volumineux", description: `La taille maximale est de ${VIDEO_CONSTRAINTS.MAX_FILE_SIZE_MB} Mo.`, variant: "destructive" });
      return;
    }

    const url = URL.createObjectURL(file);
    if (type === "training") {
      setTrainingVideo(file);
      setTrainingVideoPreview(url);
    } else {
      setConsentVideo(file);
      setConsentVideoPreview(url);
    }

    toast({ title: "Vidéo importée ✓" });
  };

  const handleProfileSubmit = async () => {
    if (!firstName || !lastName || !title) {
      toast({ title: "Champs requis", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ first_name: firstName, last_name: lastName, title, company, timezone, onboarding_step: 2 })
        .eq("user_id", user.id);
      if (error) throw error;

      await logEvent({ eventType: "onboarding_profile_completed", newValues: { firstName, lastName, title } });
      toast({ title: "Profil enregistré ✓" });
      setCurrentStep("identity");
    } catch {
      toast({ title: "Erreur", description: "Impossible d'enregistrer le profil", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!trainingVideo || !consentVideo) {
      toast({ title: "Vidéos requises", description: "Veuillez importer les deux vidéos pour continuer.", variant: "destructive" });
      return;
    }

    if (!consentGiven) {
      toast({ title: "Consentement requis", description: "Veuillez accepter les conditions pour continuer", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setCloneStatus("uploading");

    try {
      const { data: membership } = await supabase
        .from("org_memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!membership) throw new Error("No org membership found");

      const timestamp = Date.now();
      const trainingPath = `identities/${membership.org_id}/onboarding/${user.id}/${timestamp}_training.mp4`;
      const consentPath = `identities/${membership.org_id}/onboarding/${user.id}/${timestamp}_consent.mp4`;

      // Upload both videos
      const [trainingUpload, consentUpload] = await Promise.all([
        supabase.storage.from("identity_assets").upload(trainingPath, trainingVideo, { contentType: trainingVideo.type, upsert: true }),
        supabase.storage.from("identity_assets").upload(consentPath, consentVideo, { contentType: consentVideo.type, upsert: true }),
      ]);

      if (trainingUpload.error) throw trainingUpload.error;
      if (consentUpload.error) throw consentUpload.error;

      await logEvent({ eventType: "onboarding_video_recorded", metadata: { trainingPath, consentPath } });

      setCloneStatus("creating");

      // Get provider
      const { data: provider } = await supabase
        .from("providers")
        .select("id")
        .eq("org_id", membership.org_id)
        .eq("is_active", true)
        .single();

      const displayName = `${title} – ${firstName} ${lastName}`;

      // Create identity with clone_status: pending
      const { data: identity, error: identityError } = await supabase
        .from("identities")
        .insert({
          org_id: membership.org_id,
          owner_user_id: user.id,
          provider_id: provider?.id || null,
          display_name: displayName,
          type: identityType as any,
          status: "pending_approval",
          clone_status: "pending",
          reference_video_path: trainingPath,
          consent_given: true,
          consent_given_at: new Date().toISOString(),
          metadata: { consent_video_path: consentPath, title, company },
        })
        .select()
        .single();

      if (identityError) throw identityError;

      // Update profile
      await supabase.from("profiles").update({
        default_identity_id: identity.id,
        onboarding_completed: true,
        onboarding_step: 4,
      }).eq("user_id", user.id);

      await logEvent({ eventType: "identity_created", entityType: "identity", entityId: identity.id, newValues: { displayName, type: identityType } });
      await logEvent({ eventType: "onboarding_completed" });

      // Trigger HeyGen avatar creation in background
      setCloneStatus("pending");
      try {
        await heygenApi.createAvatar(identity.id);
      } catch {
        console.error("Avatar creation failed (non-blocking)");
      }

      toast({ title: "Configuration terminée ! 🎉", description: "Votre clone est en cours de création." });
      setCurrentStep("complete");
    } catch (error) {
      console.error("Completion failed:", error);
      setCloneStatus("idle");
      toast({ title: "Erreur", description: "Impossible de finaliser la configuration", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const goToDashboard = async () => {
    await refreshUser();
    navigate("/app/dashboard", { replace: true });
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
            <span className="text-sm font-medium text-muted-foreground">{Math.round(progress)}%</span>
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
                <div className={`onboarding-step-number ${isCompleted ? "onboarding-step-completed" : isActive ? "onboarding-step-active" : "onboarding-step-pending"}`}>
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                </div>
              </div>
            );
          })}
        </div>

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
                <Button onClick={() => setCurrentStep("profile")} className="w-full" size="lg">
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
                <CardDescription>Ces informations seront utilisées pour créer votre identité Ekko.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom *</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom *</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Fonction *</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Directeur Commercial" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Entreprise (optionnel)</Label>
                  <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuseau horaire</Label>
                  <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Europe/Paris" />
                </div>
                <Button onClick={handleProfileSubmit} className="w-full" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</> : <>Continuer<ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
              </CardContent>
            </>
          )}

          {/* IDENTITY CREATION (with video uploads) */}
          {currentStep === "identity" && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Créez votre clone vidéo
                </CardTitle>
                <CardDescription>
                  Importez deux vidéos pour créer votre avatar HeyGen. Votre clone sera prêt en quelques minutes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Training Video Upload */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Votre vidéo de présentation *</Label>
                  <p className="text-xs text-muted-foreground">
                    MP4 ou WebM, minimum 2 minutes, résolution 720p minimum. Parlez naturellement face caméra.
                  </p>
                  <input ref={trainingInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect("training")} />
                  {trainingVideoPreview ? (
                    <div className="space-y-2">
                      <video src={trainingVideoPreview} controls className="w-full aspect-video rounded-lg bg-muted object-cover" />
                      <Button variant="outline" size="sm" onClick={() => { setTrainingVideo(null); setTrainingVideoPreview(null); }}>
                        Changer la vidéo
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                      onClick={() => trainingInputRef.current?.click()}
                    >
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm font-medium">Cliquez pour importer votre vidéo de présentation</p>
                      <p className="text-xs text-muted-foreground mt-1">MP4, WebM • Min. 2 min • 720p+</p>
                    </div>
                  )}
                </div>

                {/* Consent Video Upload */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Votre déclaration de consentement HeyGen *</Label>
                  <p className="text-xs text-muted-foreground">
                    Vidéo courte où vous déclarez consentir à la création de votre clone numérique.
                  </p>
                  <input ref={consentInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect("consent")} />
                  {consentVideoPreview ? (
                    <div className="space-y-2">
                      <video src={consentVideoPreview} controls className="w-full aspect-video rounded-lg bg-muted object-cover" />
                      <Button variant="outline" size="sm" onClick={() => { setConsentVideo(null); setConsentVideoPreview(null); }}>
                        Changer la vidéo
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                      onClick={() => consentInputRef.current?.click()}
                    >
                      <FileVideo className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm font-medium">Cliquez pour importer votre vidéo de consentement</p>
                      <p className="text-xs text-muted-foreground mt-1">MP4, WebM</p>
                    </div>
                  )}
                </div>

                {/* Identity Type */}
                <div className="space-y-2">
                  <Label>Type d'identité</Label>
                  <Select value={identityType} onValueChange={setIdentityType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {IDENTITY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Consent Checkbox */}
                <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg border">
                  <Checkbox id="consent" checked={consentGiven} onCheckedChange={(c) => setConsentGiven(!!c)} className="mt-1" />
                  <label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                    J'autorise la création d'un clone numérique de mon apparence et de ma voix à partir de ces vidéos, conformément aux{" "}
                    <span className="text-primary underline">conditions d'utilisation</span>.
                  </label>
                </div>

                {/* Status Messages */}
                {cloneStatus === "uploading" && (
                  <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>Upload des vidéos en cours...</AlertDescription>
                  </Alert>
                )}
                {cloneStatus === "creating" && (
                  <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>Création du clone en cours...</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleComplete}
                  className="w-full"
                  size="lg"
                  disabled={isLoading || !trainingVideo || !consentVideo || !consentGiven}
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création en cours...</>
                  ) : (
                    <>Créer mon clone et terminer<ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </CardContent>
            </>
          )}

          {/* COMPLETE */}
          {currentStep === "complete" && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <CardTitle className="text-2xl">Vous êtes prêt ! 🎉</CardTitle>
                <CardDescription className="text-base mt-2">
                  Votre clone vidéo est en cours de création. Vous serez notifié dès qu'il sera prêt.
                  En attendant, vous pouvez explorer la plateforme.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-3">
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>Clone en cours de création… Cela prend généralement quelques minutes.</AlertDescription>
                </Alert>
                <Button onClick={goToDashboard} className="w-full" size="lg">
                  Créer un nouveau deal
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
