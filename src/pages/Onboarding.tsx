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
  AlertCircle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { ONBOARDING_STEPS, VIDEO_CONSTRAINTS, IDENTITY_TYPES } from "@/lib/constants";
import { VideoRecorder } from "@/components/identity/VideoRecorder";
import { RecordingGuide } from "@/components/identity/RecordingGuide";

type OnboardingStep = "welcome" | "profile" | "identity" | "complete";
type IdentitySubStep = "guide-training" | "record-training" | "guide-consent" | "record-consent" | "review";

// Generate consent script with unique code
function generateConsentScript(firstName: string, lastName: string): { script: string; code: string } {
  const code = Math.floor(10 + Math.random() * 90).toString();
  return {
    code,
    script: `Je m'appelle ${firstName} ${lastName}. J'autorise la création d'un clone numérique de mon apparence et de ma voix. Ce clone sera utilisé exclusivement dans le cadre de communications professionnelles via la plateforme Ekko. Pour des raisons de sécurité, mon code unique est ${code}.`,
  };
}

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [identitySubStep, setIdentitySubStep] = useState<IdentitySubStep>("guide-training");
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
  
  // Video recordings
  const [trainingBlob, setTrainingBlob] = useState<Blob | null>(null);
  const [trainingDuration, setTrainingDuration] = useState(0);
  const [consentBlob, setConsentBlob] = useState<Blob | null>(null);
  const [consentDuration, setConsentDuration] = useState(0);
  const [consentScriptData, setConsentScriptData] = useState<{ script: string; code: string } | null>(null);
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
      setCurrentStep("identity");
      setIdentitySubStep("guide-training");
    } catch {
      toast({ title: "Erreur", description: "Impossible d'enregistrer le profil", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrainingVideoReady = useCallback((blob: Blob, duration: number) => {
    setTrainingBlob(blob);
    setTrainingDuration(duration);
  }, []);

  const handleConsentVideoReady = useCallback((blob: Blob, duration: number) => {
    setConsentBlob(blob);
    setConsentDuration(duration);
  }, []);

  const handleStartTrainingRecording = () => {
    setIdentitySubStep("record-training");
  };

  const handleStartConsentRecording = () => {
    // Generate consent script with unique code
    const data = generateConsentScript(firstName, lastName);
    setConsentScriptData(data);
    setIdentitySubStep("record-consent");
  };

  const handleTrainingDone = () => {
    if (!trainingBlob) {
      toast({ title: "Vidéo requise", description: "Veuillez d'abord enregistrer votre vidéo de présentation.", variant: "destructive" });
      return;
    }
    setIdentitySubStep("guide-consent");
  };

  const handleConsentDone = () => {
    if (!consentBlob) {
      toast({ title: "Vidéo requise", description: "Veuillez d'abord enregistrer votre vidéo de consentement.", variant: "destructive" });
      return;
    }
    setIdentitySubStep("review");
  };

  const isDemoAccount = profile?.email === "demo@ekko.app";

  const handleComplete = async () => {
    if (!isDemoAccount && (!trainingBlob || !consentBlob)) {
      toast({ title: "Vidéos requises", description: "Veuillez enregistrer les deux vidéos pour continuer.", variant: "destructive" });
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

      // Demo account: skip real uploads and HeyGen
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

      // Real account flow: upload recordings
      const timestamp = Date.now();
      const trainingPath = `identities/${membership.org_id}/onboarding/${user.id}/${timestamp}_training.webm`;
      const consentPath = `identities/${membership.org_id}/onboarding/${user.id}/${timestamp}_consent.webm`;

      const [trainingUpload, consentUpload] = await Promise.all([
        supabase.storage.from("identity_assets").upload(trainingPath, trainingBlob!, { contentType: "video/webm", upsert: true }),
        supabase.storage.from("identity_assets").upload(consentPath, consentBlob!, { contentType: "video/webm", upsert: true }),
      ]);

      if (trainingUpload.error) throw trainingUpload.error;
      if (consentUpload.error) throw consentUpload.error;

      await logEvent({ eventType: "onboarding_video_recorded", metadata: { trainingPath, consentPath } });

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
          status: "pending_approval",
          clone_status: "pending",
          reference_video_path: trainingPath,
          consent_given: true,
          consent_given_at: new Date().toISOString(),
          metadata: { consent_video_path: consentPath, title, company, consent_code: consentScriptData?.code },
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

          {/* IDENTITY CREATION */}
          {currentStep === "identity" && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Créez votre clone vidéo
                </CardTitle>
                <CardDescription>
                  {isDemoAccount
                    ? "En mode démo, votre identité sera créée automatiquement sans vidéo."
                    : identitySubStep === "guide-training" || identitySubStep === "record-training"
                      ? "Étape 1/2 — Enregistrez votre vidéo de présentation (minimum 2 minutes)"
                      : identitySubStep === "guide-consent" || identitySubStep === "record-consent"
                        ? "Étape 2/2 — Enregistrez votre déclaration de consentement"
                        : "Vérifiez vos enregistrements et finalisez"}
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
                    {/* Sub-step: Training Guide */}
                    {identitySubStep === "guide-training" && (
                      <RecordingGuide videoType="training" onStartRecording={handleStartTrainingRecording} />
                    )}

                    {/* Sub-step: Training Recording */}
                    {identitySubStep === "record-training" && (
                      <div className="space-y-4">
                        <VideoRecorder
                          onVideoReady={handleTrainingVideoReady}
                          consentGiven={true}
                          onConsentChange={() => {}}
                          userInfo={{ firstName, lastName, company, title }}
                        />
                        <div className="flex justify-between pt-2">
                          <Button variant="outline" onClick={() => setIdentitySubStep("guide-training")}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Retour aux conseils
                          </Button>
                          <Button onClick={handleTrainingDone} disabled={!trainingBlob}>
                            Continuer
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Sub-step: Consent Guide */}
                    {identitySubStep === "guide-consent" && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                          <span className="text-sm font-medium">Vidéo de présentation enregistrée ✓ ({trainingDuration}s)</span>
                        </div>
                        <RecordingGuide videoType="consent" onStartRecording={handleStartConsentRecording} />
                        <div className="bg-muted/50 rounded-lg p-4 border">
                          <p className="text-sm font-medium mb-2">📝 Texte à lire pendant l'enregistrement :</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {consentScriptData?.script || generateConsentScript(firstName, lastName).script}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Sub-step: Consent Recording */}
                    {identitySubStep === "record-consent" && (
                      <div className="space-y-4">
                        <VideoRecorder
                          onVideoReady={handleConsentVideoReady}
                          consentGiven={true}
                          onConsentChange={() => {}}
                          userInfo={{ firstName, lastName, company, title }}
                          customScript={consentScriptData?.script}
                          minDurationSeconds={0}
                        />
                        <div className="flex justify-between pt-2">
                          <Button variant="outline" onClick={() => setIdentitySubStep("guide-consent")}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Retour
                          </Button>
                          <Button onClick={handleConsentDone} disabled={!consentBlob}>
                            Continuer
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Sub-step: Review */}
                    {identitySubStep === "review" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                            <span className="text-sm font-medium">Vidéo de présentation — {trainingDuration}s</span>
                          </div>
                          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                            <span className="text-sm font-medium">Vidéo de consentement — {consentDuration}s</span>
                          </div>
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

                        <div className="flex justify-between pt-2">
                          <Button variant="outline" onClick={() => setIdentitySubStep("guide-consent")}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Refaire les vidéos
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
