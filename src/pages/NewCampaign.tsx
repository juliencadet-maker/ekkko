import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { tavusApi } from "@/lib/api/tavus";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ScriptGenerator } from "@/components/campaign/ScriptGenerator";
import { 
  ArrowLeft, 
  ArrowRight, 
  User, 
  Users, 
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import type { Identity, Policy } from "@/types/database";

type CampaignMode = "self" | "other";
type Step = "select-mode" | "select-identity" | "write-script" | "add-recipients" | "review";

export default function NewCampaign() {
  const [currentStep, setCurrentStep] = useState<Step>("select-mode");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Campaign data
  const [mode, setMode] = useState<CampaignMode | null>(null);
  const [selectedIdentityId, setSelectedIdentityId] = useState<string>("");
  const [campaignName, setCampaignName] = useState("");
  const [script, setScript] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientFirstName, setRecipientFirstName] = useState("");
  const [recipientLastName, setRecipientLastName] = useState("");
  const [recipientCompany, setRecipientCompany] = useState("");

  // Data
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [myIdentity, setMyIdentity] = useState<Identity | null>(null);
  const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);

  const navigate = useNavigate();
  const { user, profile, membership } = useAuthContext();
  const { logEvent } = useAuditLog();
  const { toast } = useToast();

  // Fetch identities and policy
  useEffect(() => {
    const fetchData = async () => {
      if (!membership?.org_id) return;

      setIsLoading(true);
      try {
        // Fetch all identities in org — only those with clone ready
        const { data: allIdentities } = await supabase
          .from("identities")
          .select("*")
          .eq("org_id", membership.org_id)
          .eq("clone_status", "ready")
          .order("created_at", { ascending: false });

        const typedIdentities = (allIdentities || []) as Identity[];
        setIdentities(typedIdentities);

        // Find user's own identity - prefer default_identity_id from profile
        const userIdentities = typedIdentities.filter(i => i.owner_user_id === user.id);
        
        if (userIdentities.length > 0) {
          // Use default identity if set and valid, otherwise use most recent
          const defaultId = profile?.default_identity_id;
          const defaultIdentity = defaultId 
            ? userIdentities.find(i => i.id === defaultId)
            : null;
          setMyIdentity(defaultIdentity || userIdentities[0]);
        } else {
          setMyIdentity(null);
        }

        // Fetch policy
        const { data: policyData } = await supabase
          .from("policies")
          .select("*")
          .eq("org_id", membership.org_id)
          .single();

        setPolicy(policyData as Policy | null);
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [membership?.org_id, user.id, profile?.default_identity_id]);

  // Handle mode selection
  const handleModeSelect = (selectedMode: CampaignMode) => {
    setMode(selectedMode);
    if (selectedMode === "self" && myIdentity) {
      setSelectedIdentityId(myIdentity.id);
      setSelectedIdentity(myIdentity);
      setCurrentStep("write-script");
    } else if (selectedMode === "other") {
      setCurrentStep("select-identity");
    } else if (selectedMode === "self" && !myIdentity) {
      toast({
        title: "Clone non disponible",
        description: "Votre clone est en cours de création. Vous pourrez créer un deal dès qu'il sera prêt.",
        variant: "destructive",
      });
    }
  };

  // Handle identity selection
  const handleIdentitySelect = (identityId: string) => {
    const identity = identities.find(i => i.id === identityId);
    setSelectedIdentityId(identityId);
    setSelectedIdentity(identity || null);
  };

  // Determine if approval is required
  const requiresApproval = () => {
    if (!policy) return true;
    if (mode === "other") return true; // Always requires approval for other person's identity
    if (!policy.approval_required) return false;
    if (policy.allow_self_approval_for_owners && 
        (membership?.role === "org_owner" || membership?.role === "org_admin")) {
      return false;
    }
    return true;
  };

  // Handle campaign submission
  const handleSubmit = async () => {
    if (!selectedIdentity || !script.trim() || !campaignName.trim()) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    if (!recipientEmail.trim()) {
      toast({
        title: "Destinataire requis",
        description: "Veuillez ajouter au moins un destinataire",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const needsApproval = requiresApproval();
      const initialStatus = needsApproval ? "pending_approval" : "approved";

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          org_id: membership!.org_id,
          created_by_user_id: user.id,
          identity_id: selectedIdentity.id,
          name: campaignName,
          script,
          is_self_campaign: mode === "self",
          status: initialStatus,
          approved_at: !needsApproval ? new Date().toISOString() : null,
          approved_by_user_id: !needsApproval ? user.id : null,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create recipient
      await supabase.from("recipients").insert({
        org_id: membership!.org_id,
        campaign_id: campaign.id,
        email: recipientEmail,
        first_name: recipientFirstName || null,
        last_name: recipientLastName || null,
        company: recipientCompany || null,
      });

      // Log campaign creation
      await logEvent({
        eventType: "campaign_created",
        entityType: "campaign",
        entityId: campaign.id,
        newValues: { name: campaignName, identityId: selectedIdentity.id },
      });

      // Create approval request if needed
      if (needsApproval) {
        const assignedTo = mode === "other" 
          ? selectedIdentity.owner_user_id 
          : null; // Will be assigned to org admin

        const { data: approvalData } = await supabase.from("approval_requests").insert({
          org_id: membership!.org_id,
          campaign_id: campaign.id,
          requested_by_user_id: user.id,
          assigned_to_user_id: assignedTo,
          approval_type: "script",
          script_snapshot: script,
        }).select("id").single();

        // Trigger notification to exec
        if (approvalData?.id) {
          supabase.functions.invoke("notify-approval", {
            body: { approval_id: approvalData.id },
          }).catch(() => console.error("Notification failed"));
        }

        await logEvent({
          eventType: "approval_requested",
          entityType: "campaign",
          entityId: campaign.id,
        });

        toast({
          title: "Campagne envoyée en validation",
          description: "La demande de validation a été envoyée.",
        });
      } else {
        // Auto-approved - trigger HeyGen video generation
        await logEvent({
          eventType: "campaign_approved",
          entityType: "campaign",
          entityId: campaign.id,
        });

        try {
          await heygenApi.generateVideo(campaign.id);
          toast({
            title: "Campagne créée",
            description: "La génération vidéo est en cours.",
          });
        } catch {
          console.error("Video generation failed");
          toast({
            title: "Campagne créée",
            description: "La campagne a été approuvée mais la génération vidéo a rencontré une erreur.",
            variant: "destructive",
          });
        }
      }

      navigate("/app/campaigns");
    } catch {
      console.error("Submit failed");
      toast({
        title: "Erreur",
        description: "Impossible de créer la campagne",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show all shareable identities (excluding user's default/own non-shareable ones)
  const otherIdentities = identities.filter(i => i.is_shareable && i.id !== myIdentity?.id);

  return (
    <AppLayout>
      <PageHeader 
        title="Nouveau deal"
        description="Créez un deal avec présence exécutive vidéo"
        actions={
          <Button variant="outline" onClick={() => navigate("/app/campaigns")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          {/* STEP: SELECT MODE */}
          {currentStep === "select-mode" && (
            <Card className="animate-fade-in">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Qui sera sur la vidéo ?</CardTitle>
                <CardDescription>
                  Choisissez qui apparaîtra dans la vidéo personnalisée
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div 
                  className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                    !myIdentity ? "opacity-50 cursor-not-allowed" : "hover:border-primary hover:bg-muted/50"
                  }`}
                  onClick={() => myIdentity && handleModeSelect("self")}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-primary/10">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-lg">MOI</p>
                      <p className="text-sm text-muted-foreground">
                        Créer une vidéo avec votre propre identité
                      </p>
                      {myIdentity && (
                        <p className="text-sm text-primary mt-1">{myIdentity.display_name}</p>
                      )}
                      {!myIdentity && (
                        <p className="text-sm text-destructive mt-1">
                          Identité non configurée
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div 
                  className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                    otherIdentities.length === 0 ? "opacity-50 cursor-not-allowed" : "hover:border-primary hover:bg-muted/50"
                  }`}
                  onClick={() => otherIdentities.length > 0 && handleModeSelect("other")}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-accent/10">
                      <Users className="h-6 w-6 text-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-lg">UNE AUTRE PERSONNE</p>
                      <p className="text-sm text-muted-foreground">
                        Créer une vidéo avec l'identité d'un collègue
                      </p>
                      <p className="text-xs text-warning mt-1">
                        Nécessite une validation du propriétaire de l'identité
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP: SELECT IDENTITY (for "other" mode) */}
          {currentStep === "select-identity" && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>Sélectionner une identité</CardTitle>
                <CardDescription>
                  Choisissez l'identité qui apparaîtra dans la vidéo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedIdentityId} onValueChange={handleIdentitySelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez une identité" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherIdentities.map((identity) => (
                      <SelectItem key={identity.id} value={identity.id}>
                        {identity.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                    <div>
                      <p className="font-medium text-warning">Validation requise</p>
                      <p className="text-sm text-muted-foreground">
                        Le propriétaire de cette identité devra approuver votre script avant la génération.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCurrentStep("select-mode")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour
                  </Button>
                  <Button 
                    onClick={() => setCurrentStep("write-script")}
                    disabled={!selectedIdentityId}
                    className="flex-1"
                  >
                    Continuer
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP: WRITE SCRIPT */}
          {currentStep === "write-script" && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>Rédiger le script</CardTitle>
                <CardDescription>
                  Écrivez le texte qui sera prononcé dans la vidéo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedIdentity && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Identité sélectionnée</p>
                    <p className="font-medium">{selectedIdentity.display_name}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="campaignName">Nom du deal — Objectif *</Label>
                  <Input
                    id="campaignName"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="Ex: TechVision — Réponse RFP Q1"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="script">Script *</Label>
                    <ScriptGenerator
                      onScriptGenerated={(generatedScript, recipientData) => {
                        setScript(generatedScript);
                        // Auto-fill recipient fields if data provided
                        if (recipientData?.firstName) {
                          setRecipientFirstName(recipientData.firstName);
                        }
                        if (recipientData?.company) {
                          setRecipientCompany(recipientData.company);
                        }
                      }}
                      senderName={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Votre nom'}
                      senderTitle={profile?.title || 'Votre titre'}
                    />
                  </div>
                  <Textarea
                    id="script"
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    placeholder="Bonjour {prénom},&#10;&#10;Je suis ravi de vous contacter..."
                    rows={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Utilisez {"{prénom}"}, {"{nom}"}, {"{entreprise}"} pour personnaliser le message
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep(mode === "self" ? "select-mode" : "select-identity")}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour
                  </Button>
                  <Button 
                    onClick={() => setCurrentStep("add-recipients")}
                    disabled={!script.trim() || !campaignName.trim()}
                    className="flex-1"
                  >
                    Continuer
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP: ADD RECIPIENTS */}
          {currentStep === "add-recipients" && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>Ajouter un destinataire</CardTitle>
                <CardDescription>
                  Ajoutez les informations du destinataire de la vidéo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recipientEmail">Email *</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="destinataire@entreprise.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipientFirstName">Prénom</Label>
                    <Input
                      id="recipientFirstName"
                      value={recipientFirstName}
                      onChange={(e) => setRecipientFirstName(e.target.value)}
                      placeholder="Jean"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipientLastName">Nom</Label>
                    <Input
                      id="recipientLastName"
                      value={recipientLastName}
                      onChange={(e) => setRecipientLastName(e.target.value)}
                      placeholder="Dupont"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipientCompany">Entreprise</Label>
                  <Input
                    id="recipientCompany"
                    value={recipientCompany}
                    onChange={(e) => setRecipientCompany(e.target.value)}
                    placeholder="TechCorp"
                  />
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCurrentStep("write-script")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour
                  </Button>
                  <Button 
                    onClick={() => setCurrentStep("review")}
                    disabled={!recipientEmail.trim()}
                    className="flex-1"
                  >
                    Continuer
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP: REVIEW */}
          {currentStep === "review" && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>Récapitulatif</CardTitle>
                <CardDescription>
                  Vérifiez les informations avant de soumettre
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Campagne</p>
                    <p className="font-medium">{campaignName}</p>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Identité</p>
                    <p className="font-medium">{selectedIdentity?.display_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {mode === "self" ? "Votre identité" : "Identité d'un collègue"}
                    </p>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Destinataire</p>
                    <p className="font-medium">
                      {recipientFirstName} {recipientLastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{recipientEmail}</p>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Script</p>
                    <p className="text-sm whitespace-pre-wrap">{script}</p>
                  </div>
                </div>

                {requiresApproval() && (
                  <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                      <div>
                        <p className="font-medium text-warning">Validation requise</p>
                        <p className="text-sm text-muted-foreground">
                          {mode === "other" 
                            ? "Le propriétaire de l'identité devra approuver ce script."
                            : "Un administrateur devra approuver ce script."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!requiresApproval() && (
                  <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                      <div>
                        <p className="font-medium text-success">Auto-approbation</p>
                        <p className="text-sm text-muted-foreground">
                          La génération commencera automatiquement.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCurrentStep("add-recipients")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création...</>
                    ) : requiresApproval() ? (
                      <><Send className="mr-2 h-4 w-4" />Envoyer en validation</>
                    ) : (
                      <><CheckCircle2 className="mr-2 h-4 w-4" />Créer la campagne</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AppLayout>
  );
}
