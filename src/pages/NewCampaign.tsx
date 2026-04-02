import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Building2,
  Target,
  FileVideo,
  FileText,
  Swords,
  UserPlus,
} from "lucide-react";
import type { Identity, Policy } from "@/types/database";

const DEAL_STAGES = [
  { value: "qualification", label: "Qualification" },
  { value: "rfp", label: "RFP" },
  { value: "shortlist", label: "Shortlist" },
  { value: "negotiation", label: "Négociation" },
  { value: "close", label: "Close" },
];

const MOTION_TYPES = [
  { value: "greenfield", label: "Nouveau besoin (greenfield)" },
  { value: "replacement", label: "Remplacement d'un outil" },
  { value: "rfp", label: "RFP" },
  { value: "expansion", label: "Expansion" },
];

const DECISION_STRUCTURES = [
  { value: "single", label: "1 personne" },
  { value: "small_committee", label: "Petit comité (2-5)" },
  { value: "large_committee", label: "Grand comité (6+)" },
];

const INCUMBENT_TYPES = [
  { value: "internal", label: "Outil interne" },
  { value: "named_competitor", label: "Concurrent nommé" },
  { value: "unknown", label: "Inconnu" },
];

type Step = 1 | 2 | 3 | 4;

interface Contact {
  email: string;
  firstName: string;
  lastName: string;
  title: string;
}

export default function NewCampaign() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 — Deal context
  const [prospectCompany, setProspectCompany] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [dealStage, setDealStage] = useState("");
  const [existingAccount, setExistingAccount] = useState<{ id: string; name: string } | null>(null);
  const [accountSuggestion, setAccountSuggestion] = useState<{ id: string; name: string } | null>(null);

  // Step 2 — Starting asset
  const [assetType, setAssetType] = useState<"video" | "document" | "">("");
  const [selectedIdentityId, setSelectedIdentityId] = useState("");
  const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null);

  // Step 3 — Competitor
  const [hasIncumbent, setHasIncumbent] = useState<"yes" | "no" | "unknown" | "">("");
  const [incumbentType, setIncumbentType] = useState("");

  // Step 4 — Contacts
  const [contacts, setContacts] = useState<Contact[]>([{ email: "", firstName: "", lastName: "", title: "" }]);

  // Script (generated later in campaign detail)
  const [script, setScript] = useState("");

  // Data
  const [identities, setIdentities] = useState<Identity[]>([]);
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
        const [identitiesRes, policyRes] = await Promise.all([
          supabase.from("identities").select("*").eq("org_id", membership.org_id).eq("clone_status", "ready").order("created_at", { ascending: false }),
          supabase.from("policies").select("*").eq("org_id", membership.org_id).single(),
        ]);
        setIdentities((identitiesRes.data || []) as Identity[]);
        setPolicy(policyRes.data as Policy | null);
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [membership?.org_id]);

  // Account lookup on company name blur
  const handleCompanyBlur = async () => {
    if (!prospectCompany.trim() || !membership?.org_id) return;
    const normalized = prospectCompany.trim().toLowerCase();
    const { data } = await supabase
      .from("accounts")
      .select("id, name")
      .eq("org_id", membership.org_id)
      .ilike("normalized_name", `%${normalized}%`)
      .limit(1);
    if (data && data.length > 0) {
      setAccountSuggestion(data[0]);
    } else {
      setAccountSuggestion(null);
    }
  };

  const useExistingAccount = () => {
    if (accountSuggestion) {
      setExistingAccount(accountSuggestion);
      setProspectCompany(accountSuggestion.name);
      setAccountSuggestion(null);
    }
  };

  const handleIdentitySelect = (identityId: string) => {
    const identity = identities.find((i) => i.id === identityId);
    setSelectedIdentityId(identityId);
    setSelectedIdentity(identity || null);
  };

  const isSelfIdentity = selectedIdentity?.owner_user_id === user.id;
  const requiresApproval = () => {
    if (!selectedIdentity) return true;
    if (!policy) return true;
    if (!isSelfIdentity) return true;
    if (!policy.approval_required) return false;
    if (policy.allow_self_approval_for_owners && (membership?.role === "org_owner" || membership?.role === "org_admin")) return false;
    return true;
  };

  const addContact = () => {
    setContacts([...contacts, { email: "", firstName: "", lastName: "", title: "" }]);
  };

  const removeContact = (index: number) => {
    if (contacts.length <= 1) return;
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const updateContact = (index: number, field: keyof Contact, value: string) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    setContacts(updated);
  };

  const estimatedDuration = useMemo(() => {
    const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
    return Math.round(wordCount / 2.5);
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

  const getIdentityRoleLabel = (identity: Identity) => {
    if (identity.type === "executive") return "Exec clone";
    if (identity.type === "sales_rep") return "AE facecam";
    if (identity.type === "hr") return "RH clone";
    if (identity.type === "marketing") return "Marketing clone";
    return "Clone";
  };

  // Purpose mapping from stage
  const getPurposeFromStage = (stage: string) => {
    const map: Record<string, string> = {
      qualification: "qualification",
      rfp: "rfp",
      shortlist: "shortlist",
      negotiation: "negotiation",
      close: "close",
    };
    return map[stage] || "";
  };

  const handleSubmit = async () => {
    if (assetType === "video" && !selectedIdentity) {
      toast({ title: "Identité requise", description: "Veuillez sélectionner une identité pour la vidéo exec.", variant: "destructive" });
      return;
    }
    if (assetType === "video" && !script.trim()) {
      toast({ title: "Script requis", description: "Veuillez rédiger ou générer un script.", variant: "destructive" });
      return;
    }
    if (!campaignName.trim()) {
      toast({ title: "Nom requis", description: "Veuillez saisir un nom de deal.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create or reuse account
      let accountId = existingAccount?.id || null;
      if (!accountId && prospectCompany.trim()) {
        const { data: newAccount } = await supabase
          .from("accounts")
          .insert({
            org_id: membership!.org_id,
            name: prospectCompany.trim(),
            normalized_name: prospectCompany.trim().toLowerCase(),
            created_from: "deal_creation",
          })
          .select("id")
          .single();
        accountId = newAccount?.id || null;
      }

      // 2. Determine approval
      const needsApproval = assetType === "video" ? requiresApproval() : false;
      const initialStatus = needsApproval ? "pending_approval" : (assetType === "video" ? "approved" : "draft");

      // 3. Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          org_id: membership!.org_id,
          created_by_user_id: user.id,
          identity_id: assetType === "video" ? selectedIdentity?.id : null,
          name: campaignName,
          script: script || "—",
          is_self_campaign: assetType === "video" ? isSelfIdentity : true,
          status: initialStatus,
          approved_at: !needsApproval && assetType === "video" ? new Date().toISOString() : null,
          approved_by_user_id: !needsApproval && assetType === "video" ? user.id : null,
          account_id: accountId,
          crm_stage: dealStage || null,
          deal_experience_mode: assetType === "document" ? "pull_only" : "push_only",
          metadata: {
            stage: dealStage || null,
            deal_value: dealValue ? parseFloat(dealValue) * 1000 : null,
            asset_type: assetType,
          },
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // 4. Create agent_context
      await supabase.from("agent_context").insert({
        campaign_id: campaign.id,
        stage: dealStage || null,
        incumbent_present: hasIncumbent === "yes",
        incumbent_type: hasIncumbent === "yes" ? (incumbentType || "unknown") : null,
        competitive_situation: hasIncumbent === "yes" ? "incumbent" : hasIncumbent === "unknown" ? "unknown" : "greenfield",
      });

      // 5. Create contacts as recipients
      const validContacts = contacts.filter((c) => c.email.trim());
      for (const c of validContacts) {
        await supabase.from("recipients").insert({
          org_id: membership!.org_id,
          campaign_id: campaign.id,
          email: c.email,
          first_name: c.firstName || null,
          last_name: c.lastName || null,
          company: prospectCompany || null,
        });
      }

      await logEvent({
        eventType: "campaign_created",
        entityType: "campaign",
        entityId: campaign.id,
        newValues: { name: campaignName, assetType, dealStage },
      });

      // 6. Handle video pipeline if asset = video
      if (assetType === "video" && selectedIdentity) {
        const assignedTo = !isSelfIdentity ? selectedIdentity.owner_user_id : user.id;
        const { data: approvalData } = await supabase
          .from("approval_requests")
          .insert({
            org_id: membership!.org_id,
            campaign_id: campaign.id,
            requested_by_user_id: user.id,
            assigned_to_user_id: assignedTo,
            approval_type: "script",
            script_snapshot: script,
          })
          .select("id")
          .single();

        if (needsApproval) {
          if (approvalData?.id) {
            supabase.functions.invoke("notify-approval", { body: { approval_id: approvalData.id } }).catch(() => {});
          }
          await logEvent({ eventType: "approval_requested", entityType: "campaign", entityId: campaign.id });
          toast({ title: "Deal envoyé en validation", description: "La demande de validation a été envoyée." });
        } else {
          if (approvalData?.id) {
            try {
              await supabase.functions.invoke("process-approval-decision", {
                body: { approval_id: approvalData.id, action: "approved" },
              });
              toast({ title: "Deal créé", description: "La génération vidéo est en cours." });
            } catch {
              toast({ title: "Deal créé", description: "Approuvé mais la génération vidéo a rencontré une erreur.", variant: "destructive" });
            }
          }
          await logEvent({ eventType: "campaign_approved", entityType: "campaign", entityId: campaign.id });
        }
      } else {
        toast({ title: "Deal créé", description: "Vous pouvez maintenant ajouter des assets." });
      }

      navigate("/app/campaigns");
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer le deal", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const STEPS = [
    { num: 1, label: "Contexte", icon: Building2 },
    { num: 2, label: "Asset", icon: FileVideo },
    { num: 3, label: "Concurrent", icon: Swords },
    { num: 4, label: "Contacts", icon: UserPlus },
  ];

  const canProceedStep1 = campaignName.trim() && prospectCompany.trim();
  const canProceedStep2 = assetType && (assetType === "document" || selectedIdentityId);

  return (
    <AppLayout>
      <PageHeader
        title="Nouveau deal"
        description="Configurez votre deal en quelques étapes."
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
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((step, idx) => (
              <div key={step.num} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex items-center gap-1.5 ${
                    currentStep === step.num ? "text-accent font-semibold" : currentStep > step.num ? "text-signal" : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      currentStep === step.num
                        ? "bg-accent text-accent-foreground"
                        : currentStep > step.num
                        ? "bg-signal/20 text-signal"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.num ? <CheckCircle2 className="h-4 w-4" /> : step.num}
                  </div>
                  <span className="text-xs hidden sm:inline">{step.label}</span>
                </div>
                {idx < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
              </div>
            ))}
          </div>

          {/* STEP 1 — Deal Context */}
          {currentStep === 1 && (
            <Card className="animate-fade-in rounded-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Contexte du deal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Nom de l'entreprise prospect *</Label>
                  <Input
                    value={prospectCompany}
                    onChange={(e) => {
                      setProspectCompany(e.target.value);
                      setExistingAccount(null);
                      setAccountSuggestion(null);
                    }}
                    onBlur={handleCompanyBlur}
                    placeholder="Ex : TotalEnergies"
                  />
                  {accountSuggestion && !existingAccount && (
                    <div className="p-3 bg-accent/10 rounded-lg border border-accent/20 flex items-center justify-between">
                      <p className="text-sm">
                        Compte existant détecté : <strong>{accountSuggestion.name}</strong>
                      </p>
                      <Button size="sm" variant="outline" onClick={useExistingAccount}>
                        Utiliser ce compte
                      </Button>
                    </div>
                  )}
                  {existingAccount && (
                    <p className="text-xs text-signal flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Compte existant sélectionné
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Nom du deal *</Label>
                  <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex : TotalEnergies — RFP Q2" />
                </div>

                <div className="space-y-2">
                  <Label>Valeur estimée (k€)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    placeholder="Ex : 200"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select value={dealStage} onValueChange={setDealStage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez le stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_STAGES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                  2 projets différents chez le même prospect = 2 deals séparés
                </p>

                <Button onClick={() => setCurrentStep(2)} disabled={!canProceedStep1} className="w-full rounded-cta bg-accent text-accent-foreground hover:bg-accent/90">
                  Continuer <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* STEP 2 — Starting Asset */}
          {currentStep === 2 && (
            <Card className="animate-fade-in rounded-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileVideo className="h-5 w-5" />
                  Asset de démarrage
                </CardTitle>
                <CardDescription>Par quoi démarrer ?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup value={assetType} onValueChange={(v) => setAssetType(v as "video" | "document")} className="space-y-2">
                  <div className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="video" id="asset-video" />
                    <FileVideo className="h-5 w-5 text-muted-foreground" />
                    <Label htmlFor="asset-video" className="cursor-pointer flex-1">
                      Envoyer une vidéo exec
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="document" id="asset-document" />
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <Label htmlFor="asset-document" className="cursor-pointer flex-1">
                      Partager un document (PDF, deck)
                    </Label>
                  </div>
                </RadioGroup>

                {/* Identity selector — only if video */}
                {assetType === "video" && (
                  <div className="space-y-3">
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
                              selectedIdentityId === identity.id ? "border-accent bg-accent/5" : "border-transparent bg-muted hover:border-border"
                            }`}
                            onClick={() => handleIdentitySelect(identity.id)}
                          >
                            <div className="w-10 h-10 rounded-full bg-marine flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-bold text-signal">{identity.display_name[0].toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{identity.display_name}</p>
                              <p className="text-xs text-muted-foreground">{getIdentityRoleLabel(identity)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedIdentity && !isSelfIdentity && (
                      <div className="p-3 bg-warning/10 rounded-lg border border-warning/20 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-warning text-sm">Validation requise</p>
                          <p className="text-xs text-muted-foreground">Le propriétaire de cette identité devra approuver votre script.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Script section for video */}
                {assetType === "video" && selectedIdentity && (
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
                          onScriptGenerated={(generatedScript) => setScript(generatedScript)}
                          senderName={`${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Votre nom"}
                          senderTitle={profile?.title || "Votre titre"}
                          defaultCompany={prospectCompany}
                          defaultContact={contacts[0]?.firstName || ""}
                          defaultPurpose={getPurposeFromStage(dealStage)}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Utilisez {"{prénom}"}, {"{nom}"}, {"{entreprise}"} pour personnaliser.
                    </p>
                    <Textarea value={script} onChange={(e) => setScript(e.target.value)} placeholder="Bonjour {prénom},&#10;&#10;..." rows={8} />
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour
                  </Button>
                  <Button onClick={() => setCurrentStep(3)} disabled={!canProceedStep2} className="flex-1 rounded-cta bg-accent text-accent-foreground hover:bg-accent/90">
                    Continuer <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 4 — Competitor (optional) */}
          {currentStep === 4 && (
            <Card className="animate-fade-in rounded-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Swords className="h-5 w-5" />
                  Contexte concurrent
                </CardTitle>
                <CardDescription>Optionnel — aide à calibrer les actions prioritaires.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Y a-t-il un concurrent ou outil en place ?</Label>
                  <RadioGroup value={hasIncumbent} onValueChange={(v) => setHasIncumbent(v as "yes" | "no" | "unknown")} className="space-y-2">
                    <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="yes" id="inc-yes" />
                      <Label htmlFor="inc-yes" className="cursor-pointer flex-1">Oui</Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="no" id="inc-no" />
                      <Label htmlFor="inc-no" className="cursor-pointer flex-1">Non</Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="unknown" id="inc-unknown" />
                      <Label htmlFor="inc-unknown" className="cursor-pointer flex-1">Je ne sais pas</Label>
                    </div>
                  </RadioGroup>
                </div>

                {hasIncumbent === "yes" && (
                  <div className="space-y-3">
                    <Label>Type</Label>
                    <RadioGroup value={incumbentType} onValueChange={setIncumbentType} className="space-y-2">
                      {INCUMBENT_TYPES.map((it) => (
                        <div key={it.value} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                          <RadioGroupItem value={it.value} id={`inc-type-${it.value}`} />
                          <Label htmlFor={`inc-type-${it.value}`} className="cursor-pointer flex-1">{it.label}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCurrentStep(3)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour
                  </Button>
                  <Button onClick={() => setCurrentStep(5)} className="flex-1 rounded-cta bg-accent text-accent-foreground hover:bg-accent/90">
                    Continuer <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 5 — Contacts (optional) */}
          {currentStep === 5 && (
            <Card className="animate-fade-in rounded-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Contacts connus
                </CardTitle>
                <CardDescription>Optionnel — vous pourrez ajouter les contacts plus tard.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Users className="h-4 w-4" /> Contacts
                    </Label>
                    <Button type="button" variant="ghost" size="sm" onClick={addContact}>
                      <Plus className="h-3 w-3 mr-1" /> Ajouter
                    </Button>
                  </div>
                  {contacts.map((c, idx) => (
                    <div key={idx} className="p-3 bg-muted rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Contact {idx + 1}</span>
                        {contacts.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeContact(idx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <Input type="email" value={c.email} onChange={(e) => updateContact(idx, "email", e.target.value)} placeholder="contact@entreprise.com" />
                      <div className="grid grid-cols-3 gap-2">
                        <Input value={c.firstName} onChange={(e) => updateContact(idx, "firstName", e.target.value)} placeholder="Prénom" />
                        <Input value={c.lastName} onChange={(e) => updateContact(idx, "lastName", e.target.value)} placeholder="Nom" />
                        <Input value={c.title} onChange={(e) => updateContact(idx, "title", e.target.value)} placeholder="Titre / Fonction" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Approval info for video */}
                {assetType === "video" && requiresApproval() && (
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
                  <Button variant="outline" onClick={() => setCurrentStep(4)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 rounded-cta bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création...</>
                    ) : assetType === "video" && !requiresApproval() ? (
                      <><CheckCircle2 className="mr-2 h-4 w-4" />Créer et générer la vidéo</>
                    ) : assetType === "video" && requiresApproval() ? (
                      <><Send className="mr-2 h-4 w-4" />Créer et envoyer en validation</>
                    ) : (
                      <><CheckCircle2 className="mr-2 h-4 w-4" />Créer le deal</>
                    )}
                  </Button>
                </div>

                <Button variant="ghost" onClick={handleSubmit} disabled={isSubmitting} className="w-full text-muted-foreground text-sm">
                  Passer — j'ajouterai les contacts plus tard
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AppLayout>
  );
}
