import { useState, useEffect, useMemo } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ScriptGenerator } from "@/components/campaign/ScriptGenerator";
import { 
  ArrowLeft, 
  ArrowRight, 
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import type { Identity, Policy } from "@/types/database";

const DEAL_STAGES = [
  { value: "qualification", label: "Qualification" },
  { value: "rfp", label: "RFP" },
  { value: "shortlist", label: "Shortlist" },
  { value: "negotiation", label: "Négociation" },
  { value: "close", label: "Close" },
];

type Step = "identity-context" | "script-recipients";

interface Recipient {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
}

export default function NewCampaign() {
  const [currentStep, setCurrentStep] = useState<Step>("identity-context");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Campaign data
  const [selectedIdentityId, setSelectedIdentityId] = useState<string>("");
  const [campaignName, setCampaignName] = useState("");
  const [dealStage, setDealStage] = useState("");
  const [script, setScript] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([{ email: "", firstName: "", lastName: "", company: "" }]);

  // Data
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);

  const navigate = useNavigate();
  const { user, profile, membership } = useAuthContext();
  const { logEvent } = useAuditLog();
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      if (!membership?.org_id) return;
      setIsLoading(true);
      try {
        const { data: allIdentities } = await supabase
          .from("identities")
          .select("*")
          .eq("org_id", membership.org_id)
          .eq("clone_status", "ready")
          .order("created_at", { ascending: false });

        setIdentities((allIdentities || []) as Identity[]);

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
  }, [membership?.org_id, user.id]);

  const handleIdentitySelect = (identityId: string) => {
    const identity = identities.find(i => i.id === identityId);
    setSelectedIdentityId(identityId);
    setSelectedIdentity(identity || null);
  };

  const isSelfIdentity = selectedIdentity?.owner_user_id === user.id;
  const requiresApproval = () => {
    if (!policy) return true;
    if (!isSelfIdentity) return true;
    if (!policy.approval_required) return false;
    if (policy.allow_self_approval_for_owners && 
        (membership?.role === "org_owner" || membership?.role === "org_admin")) return false;
    return true;
  };

  const addRecipient = () => {
    setRecipients([...recipients, { email: "", firstName: "", lastName: "", company: "" }]);
  };

  const removeRecipient = (index: number) => {
    if (recipients.length <= 1) return;
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const updateRecipient = (index: number, field: keyof Recipient, value: string) => {
    const updated = [...recipients];
    updated[index] = { ...updated[index], [field]: value };
    setRecipients(updated);
  };

  // Estimate script duration
  const estimatedDuration = useMemo(() => {
    const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
    const seconds = Math.round(wordCount / 2.5); // ~150 words/min
    return seconds;
  }, [script]);

  const getDurationLabel = () => {
    if (!script.trim()) return "";
    const s = estimatedDuration;
    if (s < 60) return `~${s}s`;
    return `~${Math.floor(s / 60)}m${s % 60 > 0 ? `${s % 60}s` : ""}`;
  };

  const getDurationHint = () => {
    if (estimatedDuration < 30) return "Très court";
    if (estimatedDuration <= 90) return "optimal pour AE";
    if (estimatedDuration <= 150) return "bon format";
    return "Long — envisagez de raccourcir";
  };

  const handleSubmit = async () => {
    if (!selectedIdentity || !script.trim() || !campaignName.trim()) {
      toast({ title: "Champs requis", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }

    const validRecipients = recipients.filter(r => r.email.trim());
    if (validRecipients.length === 0) {
      toast({ title: "Destinataire requis", description: "Veuillez ajouter au moins un destinataire", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const needsApproval = requiresApproval();
      const initialStatus = needsApproval ? "pending_approval" : "approved";

      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          org_id: membership!.org_id,
          created_by_user_id: user.id,
          identity_id: selectedIdentity.id,
          name: campaignName,
          script,
          is_self_campaign: isSelfIdentity,
          status: initialStatus,
          approved_at: !needsApproval ? new Date().toISOString() : null,
          approved_by_user_id: !needsApproval ? user.id : null,
          metadata: dealStage ? { stage: dealStage } : null,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create recipients
      for (const r of validRecipients) {
        await supabase.from("recipients").insert({
          org_id: membership!.org_id,
          campaign_id: campaign.id,
          email: r.email,
          first_name: r.firstName || null,
          last_name: r.lastName || null,
          company: r.company || null,
        });
      }

      await logEvent({ eventType: "campaign_created", entityType: "campaign", entityId: campaign.id, newValues: { name: campaignName, identityId: selectedIdentity.id } });

      if (needsApproval) {
        const assignedTo = !isSelfIdentity ? selectedIdentity.owner_user_id : null;
        const { data: approvalData } = await supabase.from("approval_requests").insert({
          org_id: membership!.org_id,
          campaign_id: campaign.id,
          requested_by_user_id: user.id,
          assigned_to_user_id: assignedTo,
          approval_type: "script",
          script_snapshot: script,
        }).select("id").single();

        if (approvalData?.id) {
          supabase.functions.invoke("notify-approval", { body: { approval_id: approvalData.id } }).catch(() => {});
        }

        await logEvent({ eventType: "approval_requested", entityType: "campaign", entityId: campaign.id });
        toast({ title: "Deal envoyé en validation", description: "La demande de validation a été envoyée." });
      } else {
        await logEvent({ eventType: "campaign_approved", entityType: "campaign", entityId: campaign.id });
        try {
          await tavusApi.generateVideo(campaign.id);
          toast({ title: "Deal créé", description: "La génération vidéo est en cours." });
        } catch {
          toast({ title: "Deal créé", description: "Approuvé mais la génération vidéo a rencontré une erreur.", variant: "destructive" });
        }
      }

      navigate("/app/campaigns");
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer le deal", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIdentityRoleLabel = (identity: Identity) => {
    if (identity.type === "executive") return "Exec clone";
    if (identity.type === "sales_rep") return "AE facecam";
    if (identity.type === "hr") return "RH clone";
    if (identity.type === "marketing") return "Marketing clone";
    return "Clone";
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Nouveau deal"
        description="Choisissez une identité, rédigez le script, ajoutez les destinataires."
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
          {/* Step indicator */}
          <div className="flex items-center gap-4 mb-8">
            <div className={`flex items-center gap-2 ${currentStep === "identity-context" ? "text-accent font-semibold" : "text-muted-foreground"}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${currentStep === "identity-context" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>1</div>
              <span className="text-sm">Identité + Contexte</span>
            </div>
            <div className="flex-1 h-px bg-border" />
            <div className={`flex items-center gap-2 ${currentStep === "script-recipients" ? "text-accent font-semibold" : "text-muted-foreground"}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${currentStep === "script-recipients" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>2</div>
              <span className="text-sm">Script + Destinataires</span>
            </div>
          </div>

          {/* STEP 1: Identity + Context */}
          {currentStep === "identity-context" && (
            <Card className="animate-fade-in rounded-card">
              <CardHeader>
                <CardTitle>Qui parle, sur quel deal ?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Identity selector — visual cards */}
                <div className="space-y-2">
                  <Label>Qui apparaît dans la vidéo ? *</Label>
                  {identities.length === 0 ? (
                    <div className="p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                      Aucune identité disponible. Créez-en une dans la section Identités.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {identities.map((identity) => (
                        <div
                          key={identity.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedIdentityId === identity.id
                              ? "border-accent bg-accent/5"
                              : "border-transparent bg-muted hover:border-border"
                          }`}
                          onClick={() => handleIdentitySelect(identity.id)}
                        >
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-marine flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-signal">
                              {identity.display_name[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{identity.display_name}</p>
                            <p className="text-xs text-muted-foreground">{getIdentityRoleLabel(identity)}</p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-badge ${
                            (identity as any).clone_status === "ready" ? "bg-signal-pale text-marine" : "bg-warning/10 text-warning"
                          }`}>
                            {(identity as any).clone_status === "ready" ? "Prêt" : "En attente"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Validation warning if not own identity */}
                {selectedIdentity && !isSelfIdentity && (
                  <div className="p-3 bg-warning/10 rounded-lg border border-warning/20 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-warning text-sm">Validation requise</p>
                      <p className="text-xs text-muted-foreground">Le propriétaire de cette identité devra approuver votre script.</p>
                    </div>
                  </div>
                )}

                {/* Deal name */}
                <div className="space-y-2">
                  <Label>Nom du deal *</Label>
                  <Input
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="Ex : TotalEnergies — RFP Q2"
                  />
                </div>

                {/* Stage */}
                <div className="space-y-2">
                  <Label>Où en êtes-vous dans le cycle ?</Label>
                  <Select value={dealStage} onValueChange={setDealStage}>
                    <SelectTrigger><SelectValue placeholder="Sélectionnez le stage" /></SelectTrigger>
                    <SelectContent>
                      {DEAL_STAGES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Calibre les benchmarks de signal attendus sur ce deal.</p>
                </div>

                <Button 
                  onClick={() => setCurrentStep("script-recipients")}
                  disabled={!selectedIdentityId || !campaignName.trim()}
                  className="w-full rounded-cta bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  Continuer <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* STEP 2: Script + Recipients */}
          {currentStep === "script-recipients" && (
            <Card className="animate-fade-in rounded-card">
              <CardHeader>
                <CardTitle>Ce que vous allez dire, à qui</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Script */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Script de la vidéo *</Label>
                    <div className="flex items-center gap-3">
                      {script.trim() && (
                        <span className="text-xs text-muted-foreground">
                          Durée estimée : {getDurationLabel()} — {getDurationHint()}
                        </span>
                      )}
                      <ScriptGenerator
                        onScriptGenerated={(generatedScript, recipientData) => {
                          setScript(generatedScript);
                          if (recipientData?.firstName) {
                            const updated = [...recipients];
                            updated[0] = { ...updated[0], firstName: recipientData.firstName };
                            if (recipientData.company) updated[0].company = recipientData.company;
                            setRecipients(updated);
                          }
                        }}
                        senderName={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Votre nom'}
                        senderTitle={profile?.title || 'Votre titre'}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Parlez comme vous parleriez à cette personne. Utilisez {'{prénom}'}, {'{nom}'}, {'{entreprise}'} pour personnaliser.</p>
                  <Textarea
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    placeholder="Bonjour {prénom},&#10;&#10;Je suis ravi de vous contacter..."
                    rows={8}
                  />
                </div>

                {/* Recipients */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> À qui envoyez-vous cette vidéo ? *</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={addRecipient}>
                      <Plus className="h-3 w-3 mr-1" /> Ajouter
                    </Button>
                  </div>
                  {recipients.map((r, idx) => (
                    <div key={idx} className="p-3 bg-muted rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Destinataire {idx + 1}</span>
                        {recipients.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeRecipient(idx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <Input
                        type="email"
                        value={r.email}
                        onChange={(e) => updateRecipient(idx, "email", e.target.value)}
                        placeholder="destinataire@entreprise.com"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Input value={r.firstName} onChange={(e) => updateRecipient(idx, "firstName", e.target.value)} placeholder="Prénom" />
                        <Input value={r.lastName} onChange={(e) => updateRecipient(idx, "lastName", e.target.value)} placeholder="Nom" />
                        <Input value={r.company} onChange={(e) => updateRecipient(idx, "company", e.target.value)} placeholder="Entreprise" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Approval info */}
                {requiresApproval() && (
                  <div className="p-3 bg-warning/10 rounded-lg border border-warning/20 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-warning text-sm">Validation requise</p>
                      <p className="text-xs text-muted-foreground">
                        {!isSelfIdentity ? "Le propriétaire de l'identité devra approuver ce script." : "Un administrateur devra approuver ce script."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCurrentStep("identity-context")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    disabled={isSubmitting || !script.trim() || recipients.every(r => !r.email.trim())}
                    className="flex-1 rounded-cta bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création...</>
                    ) : requiresApproval() ? (
                      <><Send className="mr-2 h-4 w-4" />Envoyer en validation</>
                    ) : (
                      <><CheckCircle2 className="mr-2 h-4 w-4" />Générer la vidéo</>
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
