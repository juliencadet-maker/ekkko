import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { tavusApi } from "@/lib/api/tavus";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Video, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { VideoRecorder } from "./VideoRecorder";
import { RecordingGuide } from "./RecordingGuide";
import { IDENTITY_TYPES } from "@/lib/constants";

type Step = "profile" | "guide" | "video" | "confirm";

interface CreateIdentityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIdentityCreated: () => void;
}

export function CreateIdentityDialog({ open, onOpenChange, onIdentityCreated }: CreateIdentityDialogProps) {
  const [currentStep, setCurrentStep] = useState<Step>("profile");
  const [isLoading, setIsLoading] = useState(false);
  
  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [identityType, setIdentityType] = useState<string>("other");
  
  // Video fields
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [consentGiven, setConsentGiven] = useState(false);
  
  const { user, membership, refreshUser } = useAuthContext();
  const { logEvent } = useAuditLog();
  const { toast } = useToast();

  const steps = [
    { key: "profile", label: "Profil" },
    { key: "guide", label: "Préparation" },
    { key: "video", label: "Enregistrement" },
    { key: "confirm", label: "Confirmation" },
  ];
  
  const stepIndex = steps.findIndex(s => s.key === currentStep);
  const progress = ((stepIndex + 1) / steps.length) * 100;

  const handleVideoReady = useCallback((blob: Blob, duration: number) => {
    setVideoBlob(blob);
    setVideoDuration(duration);
  }, []);

  const handleReset = () => {
    setCurrentStep("profile");
    setFirstName("");
    setLastName("");
    setCompany("");
    setTitle("");
    setIdentityType("other");
    setVideoBlob(null);
    setVideoDuration(0);
    setConsentGiven(false);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const handleProfileNext = () => {
    if (!firstName || !lastName || !title) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep("video");
  };

  const handleVideoNext = () => {
    if (!videoBlob || !consentGiven) {
      toast({
        title: "Vidéo requise",
        description: "Veuillez enregistrer une vidéo et accepter les conditions",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep("confirm");
  };

  const handleCreateIdentity = async () => {
    if (!membership?.org_id || !videoBlob) return;
    
    setIsLoading(true);
    try {
      // Upload video
      const timestamp = Date.now();
      const path = `identities/${membership.org_id}/additional/${user.id}/${timestamp}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from("identity_assets")
        .upload(path, videoBlob, {
          contentType: "video/webm",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get provider
      const { data: provider } = await supabase
        .from("providers")
        .select("id")
        .eq("org_id", membership.org_id)
        .eq("provider_type", "mock")
        .eq("is_active", true)
        .single();

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
          status: "ready",
          reference_video_path: path,
          reference_video_duration: videoDuration || null,
          consent_given: consentGiven,
          consent_given_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (identityError) throw identityError;

      await logEvent({
        eventType: "identity_created",
        entityType: "identity",
        entityId: identity.id,
        newValues: { displayName, type: identityType },
      });

      // Trigger Tavus replica creation in background
      try {
        await tavusApi.createReplica(identity.id);
        toast({ 
          title: "Identité créée avec succès ! 🎉",
          description: "L'entraînement de votre avatar vidéo est en cours. Cela prend quelques minutes.",
        });
      } catch {
        console.error("Replica creation failed");
        toast({ 
          title: "Identité créée avec succès ! 🎉",
          description: "Note : l'avatar vidéo n'a pas pu être créé automatiquement. Vous pourrez le relancer depuis les paramètres.",
        });
      }

      handleClose();
      onIdentityCreated();
      await refreshUser();
    } catch {
      console.error("Create identity failed");
      toast({
        title: "Erreur",
        description: "Impossible de créer l'identité",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une nouvelle identité</DialogTitle>
          <DialogDescription>
            Configurez votre nouvelle identité en quelques étapes
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Étape {stepIndex + 1} sur {steps.length}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {steps.map((step, index) => {
            const isActive = step.key === currentStep;
            const isCompleted = index < stepIndex;
            return (
              <div key={step.key} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isCompleted ? "bg-primary text-primary-foreground" :
                  isActive ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                </div>
                <span className={`text-sm ${isActive || isCompleted ? "font-medium" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Profile Step */}
        {currentStep === "profile" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5" />
              <h3 className="font-semibold">Informations de l'identité</h3>
            </div>
            
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
              <Label htmlFor="identityType">Type d'identité</Label>
              <Select value={identityType} onValueChange={setIdentityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un type" />
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

            <div className="flex justify-end pt-4">
              <Button onClick={handleProfileNext}>
                Continuer
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Video Step */}
        {currentStep === "video" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Video className="h-5 w-5" />
              <h3 className="font-semibold">Vidéo de référence</h3>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              Enregistrez une courte vidéo de vous-même (10 à 30 secondes).
              Elle servira à créer votre avatar visuel (Tavus) et à cloner votre voix (Voxtral TTS).
            </p>

            <VideoRecorder
              onVideoReady={handleVideoReady}
              consentGiven={consentGiven}
              onConsentChange={setConsentGiven}
              userInfo={{
                firstName,
                lastName,
                company,
                title,
              }}
            />

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep("profile")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
              <Button 
                onClick={handleVideoNext}
                disabled={!videoBlob || !consentGiven}
              >
                Continuer
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Confirm Step */}
        {currentStep === "confirm" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Confirmer la création</h3>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p><strong>Nom :</strong> {firstName} {lastName}</p>
              <p><strong>Fonction :</strong> {title}</p>
              <p><strong>Type :</strong> {IDENTITY_TYPES.find(t => t.value === identityType)?.label}</p>
              <p><strong>Durée de la vidéo :</strong> {videoDuration}s</p>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep("video")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
              <Button onClick={handleCreateIdentity} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Créer l'identité"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
