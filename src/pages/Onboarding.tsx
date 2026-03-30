import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { tavusApi } from "@/lib/api/tavus";
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
  AlertCircle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { ONBOARDING_STEPS, VIDEO_CONSTRAINTS, IDENTITY_TYPES } from "@/lib/constants";
import { VideoRecorder } from "@/components/identity/VideoRecorder";
import { RecordingGuide } from "@/components/identity/RecordingGuide";

type OnboardingStep = "welcome" | "profile" | "identity" | "complete";
type IdentitySubStep = "guide" | "record" | "review";

// Generate combined teleprompter script (presentation + consent)
function generateCombinedScript(firstName: string, lastName: string, company: string, title: string): { script: string; code: string } {
  const code = Math.floor(10 + Math.random() * 90).toString();
  const companyLine = company ? `Je travaille chez ${company} en tant que ${title}.` : `J'occupe la fonction de ${title}.`;
  
  return {
    code,
    script: `Bonjour, je m'appelle ${firstName} ${lastName}.

${companyLine}

Je fais cet enregistrement car bientôt je serai en mesure de créer plus de confiance sur le cycle de vente, tout en gagnant du temps.

Je pourrai également être présent sur tous les deals sans avoir à bloquer mon agenda.

Cela me permettra d'impliquer des personnes plus facilement, afin de créer plus de confiance et d'engagement avec mes clients et partenaires.

Avec Ekko, je vais pouvoir personnaliser mes messages vidéo pour chaque prospect, et ainsi augmenter significativement mes taux de conversion.

Pour finaliser, je confirme que j'autorise la création d'un clone numérique de mon apparence et de ma voix. Ce clone sera utilisé exclusivement dans le cadre de communications professionnelles via la plateforme Ekko. Mon code unique est ${code}.

Merci !`,
  };
}

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [identitySubStep, setIdentitySubStep] = useState<IdentitySubStep>("guide");
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
  
  // Single video recording
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [scriptData, setScriptData] = useState<{ script: string; code: string } | null>(null);
  const [cloneStatus, setCloneStatus] = useState<"idle" | "uploading" | "creating" | "pending">("idle");

  const navigate = useNavigate();
  const { user, profile, refreshUser } = useAuthContext();
  const { logEvent } = useAuditLog();
  const { toast } = useToast();

  useEffect(() => {
    logEvent({ eventType: "onboarding_started" });
  }, [logEvent]);

  const stepIndex = ONBOARDING_STEPS.findIndex(s => s.key === currentStep);
  const progress = ((stepIndex + 1) / ONBOARDING_STEPS.length) * 100;

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
      
      // Generate the combined script with user info
      setScriptData(generateCombinedScript(firstName, lastName, company, title));
      setCurrentStep("identity");
      setIdentitySubStep("guide");
    } catch {
      toast({ title: "Erreur", description: "Impossible d'enregistrer le profil", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoReady = useCallback((blob: Blob, duration: number) => {
    setVideoBlob(blob);
    setVideoDuration(duration);
  }, []);

  const handleAudioReady = useCallback((blob: Blob) => {
    setAudioBlob(blob);
    console.log("Audio reference captured:", blob.size, "bytes");
  }, []);

  const handleStartRecording = () => {
    if (!scriptData) {
      setScriptData(generateCombinedScript(firstName, lastName, company, title));
    }
    setIdentitySubStep("record");
  };

  const handleRecordingDone = () => {
    if (!videoBlob) {
      toast({ title: "Vidéo requise", description: "Veuillez d'abord enregistrer votre vidéo.", variant: "destructive" });
      return;
    }
    setIdentitySubStep("review");
  };

  const isDemoAccount = profile?.email === "demo@ekko.app";
  const isExecAccount = profile?.email === "exec@ekko.app";
  const EXEC_TAVUS_REPLICA_ID = "35687b4153974f7ca564d3a3ba7c455e";

  const handleComplete = async () => {
    if (!isDemoAccount && !videoBlob) {
      toast({ title: "Vidéo requise", description: "Veuillez enregistrer votre vidéo pour continuer.", variant: "destructive" });
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

      // Demo account: skip real uploads and Tavus
      if (isDemoAccount) {
        setCloneStatus("creating");

        const { data: provider } = await supabase
          .from("providers")
          .select("id")
          .eq("org_id", membership.org_id)
          .eq("is_active", true)
          .single();

        const displayName = `${title} – ${firstName} ${lastName}`;

        const { data: identity, error: identityError } = await supabase
          .from("identities")
          .insert({
            org_id: membership.org_id,
            owner_user_id: user.id,
            provider_id: provider?.id || null,
            display_name: displayName,
            type: identityType as any,
            status: "ready",
            clone_status: "ready",
            reference_video_path: `demo/mock_training.mp4`,
            consent_given: true,
            consent_given_at: new Date().toISOString(),
            metadata: { demo: true, title, company },
          })
          .select()
          .single();

        if (identityError) throw identityError;

        await supabase.from("profiles").update({
          default_identity_id: identity.id,
          onboarding_completed: true,
          onboarding_step: 4,
        }).eq("user_id", user.id);

        await logEvent({ eventType: "identity_created", entityType: "identity", entityId: identity.id, newValues: { displayName, type: identityType, demo: true } });
        await logEvent({ eventType: "onboarding_completed" });

        toast({ title: "Configuration terminée ! 🎉", description: "Votre identité démo est prête." });
        setCurrentStep("complete");
        return;
      }

      // Real account flow: upload video + audio
      const timestamp = Date.now();
      const videoPath = `identities/${membership.org_id}/onboarding/${user.id}/${timestamp}_reference.webm`;

      const { error: uploadError } = await supabase.storage
        .from("identity_assets")
        .upload(videoPath, videoBlob!, { contentType: "video/webm", upsert: true });

      if (uploadError) throw uploadError;

      // Upload audio reference separately (for Voxtral voice cloning)
      let voiceReferencePath: string | null = null;
      if (audioBlob) {
        voiceReferencePath = `identities/${membership.org_id}/onboarding/${user.id}/${timestamp}_voice_reference.webm`;
        const { error: audioUploadError } = await supabase.storage
          .from("identity_assets")
          .upload(voiceReferencePath, audioBlob, { contentType: "audio/webm", upsert: true });

        if (audioUploadError) {
          console.warn("Audio upload failed (non-blocking):", audioUploadError);
          voiceReferencePath = null; // Fall back to extracting from video
        }
      }

      await logEvent({ eventType: "onboarding_video_recorded", metadata: { videoPath, voiceReferencePath, duration: videoDuration } });

      setCloneStatus("creating");

      const { data: provider } = await supabase
        .from("providers")
        .select("id")
        .eq("org_id", membership.org_id)
        .eq("is_active", true)
        .single();

      const displayName = `${title} – ${firstName} ${lastName}`;

      // Video for Tavus visual training, audio reference for Voxtral voice cloning
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
          reference_video_path: videoPath,
          reference_video_duration: videoDuration,
          consent_given: true,
          consent_given_at: new Date().toISOString(),
          metadata: {
            title,
            company,
            consent_code: scriptData?.code,
            voice_reference_path: voiceReferencePath,
          },
        })
        .select()
        .single();

      if (identityError) throw identityError;

      await supabase.from("profiles").update({
        default_identity_id: identity.id,
        onboarding_completed: true,
        onboarding_step: 4,
      }).eq("user_id", user.id);

      await logEvent({ eventType: "identity_created", entityType: "identity", entityId: identity.id, newValues: { displayName, type: identityType } });
      await logEvent({ eventType: "onboarding_completed" });

      setCloneStatus("pending");
      
      // Trigger Tavus replica creation (visual clone) - non-blocking
      try {
        await tavusApi.createReplica(identity.id);
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

          {/* IDENTITY CREATION */}
          {currentStep === "identity" && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Créez votre clone
                </CardTitle>
                <CardDescription>
                  {isDemoAccount
                    ? "En mode démo, votre identité sera créée automatiquement sans vidéo."
                    : identitySubStep === "guide"
                      ? "Une seule vidéo pour cloner votre apparence et votre voix."
                      : identitySubStep === "record"
                        ? "Enregistrez-vous en suivant le téléprompter — cette vidéo sert pour le visuel ET la voix."
                        : "Vérifiez votre enregistrement et finalisez."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isDemoAccount ? (
                  <>
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Mode démo : les vidéos ne sont pas nécessaires. Une identité simulée sera créée automatiquement.
                      </AlertDescription>
                    </Alert>

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

                    {/* Consent */}
                    <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg border">
                      <Checkbox id="consent" checked={consentGiven} onCheckedChange={(c) => setConsentGiven(!!c)} className="mt-1" />
                      <label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                        J'autorise la création d'un clone numérique de mon apparence et de ma voix, conformément aux{" "}
                        <span className="text-primary underline">conditions d'utilisation</span>.
                      </label>
                    </div>

                    <Button onClick={handleComplete} className="w-full" size="lg" disabled={isLoading || !consentGiven}>
                      {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création en cours...</> : <>Créer mon identité démo<ArrowRight className="ml-2 h-4 w-4" /></>}
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Sub-step: Guide */}
                    {identitySubStep === "guide" && (
                      <RecordingGuide onStartRecording={handleStartRecording} />
                    )}

                    {/* Sub-step: Recording */}
                    {identitySubStep === "record" && (
                      <div className="space-y-4">
                        <VideoRecorder
                          onVideoReady={handleVideoReady}
                          onAudioReady={handleAudioReady}
                          consentGiven={true}
                          onConsentChange={() => {}}
                          userInfo={{ firstName, lastName, company, title }}
                          customScript={scriptData?.script}
                        />
                        <div className="flex justify-between pt-2">
                          <Button variant="outline" onClick={() => setIdentitySubStep("guide")}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Retour aux conseils
                          </Button>
                          <Button onClick={handleRecordingDone} disabled={!videoBlob}>
                            Continuer
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Sub-step: Review */}
                    {identitySubStep === "review" && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                          <span className="text-sm font-medium">Vidéo enregistrée — {videoDuration}s</span>
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
                            J'autorise la création d'un clone numérique de mon apparence et de ma voix à partir de cette vidéo, conformément aux{" "}
                            <span className="text-primary underline">conditions d'utilisation</span>.
                          </label>
                        </div>

                        {/* Status Messages */}
                        {cloneStatus === "uploading" && (
                          <Alert>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <AlertDescription>Upload de la vidéo en cours...</AlertDescription>
                          </Alert>
                        )}
                        {cloneStatus === "creating" && (
                          <Alert>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <AlertDescription>Création des clones visuel et vocal en cours...</AlertDescription>
                          </Alert>
                        )}

                        <div className="flex justify-between pt-2">
                          <Button variant="outline" onClick={() => { setVideoBlob(null); setVideoDuration(0); setIdentitySubStep("guide"); }}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Refaire la vidéo
                          </Button>
                          <Button onClick={handleComplete} size="lg" disabled={isLoading || !consentGiven}>
                            {isLoading ? (
                              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création en cours...</>
                            ) : (
                              <>Créer mon clone<ArrowRight className="ml-2 h-4 w-4" /></>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
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
                  Votre clone vidéo et vocal est en cours de création. Vous serez notifié dès qu'il sera prêt.
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
