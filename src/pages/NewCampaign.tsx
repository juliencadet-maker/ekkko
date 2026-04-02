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
import { FacecamRecorder } from "@/components/campaign/FacecamRecorder";
import { VideoImportUpload } from "@/components/campaign/VideoImportUpload";
import {
  ArrowLeft,
  ArrowRight,
  
  Send,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Users,
  Building2,
  FileVideo,
  FileText,
  Swords,
  UserPlus,
  Camera,
  Upload,
  Bot,
} from "lucide-react";
import { EkkoLoader } from "@/components/ui/EkkoLoader";
import type { Identity, Policy } from "@/types/database";

const DEAL_STAGES = [
  { value: "qualification", label: "Qualification" },
  { value: "rfp", label: "RFP" },
  { value: "shortlist", label: "Shortlist" },
  { value: "negotiation", label: "Négociation" },
  { value: "close", label: "Close" },
];

const INCUMBENT_TYPES = [
  { value: "internal", label: "Outil interne" },
  { value: "named_competitor", label: "Concurrent nommé" },
  { value: "unknown", label: "Inconnu" },
];

const generateFacecamScript = (variant: string, company: string, contact: string): string => {
  switch (variant) {
    case "intro":
      return `Bonjour${contact ? ` ${contact}` : ""},\n\nJe me permets de vous contacter au sujet de ${company || "votre projet"}. J'aimerais vous montrer comment nous pouvons vous accompagner.\n\nSeriez-vous disponible pour un échange rapide cette semaine ?`;
    case "relance":
      return `Bonjour${contact ? ` ${contact}` : ""},\n\nJe reviens vers vous suite à notre précédent échange concernant ${company || "votre projet"}.\n\nAvez-vous eu le temps de réfléchir à notre proposition ?`;
    case "reponse":
      return `Bonjour${contact ? ` ${contact}` : ""},\n\nMerci pour votre retour concernant ${company || "votre projet"}. Je souhaitais apporter quelques précisions.\n\nN'hésitez pas à me faire part de vos questions.`;
    default:
      return "";
  }
};

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

  // Step 2 — Competitor
  const [hasIncumbent, setHasIncumbent] = useState<"yes" | "no" | "unknown" | "">("");
  const [incumbentType, setIncumbentType] = useState("");

  // Step 3 — Contacts
  const [contacts, setContacts] = useState<Contact[]>([{ email: "", firstName: "", lastName: "", title: "" }]);

  // Step 4 — Starting asset
  const [assetType, setAssetType] = useState<"video" | "document" | "">("");
  const [selectedIdentityId, setSelectedIdentityId] = useState("");
  const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null);
  const [videoMode, setVideoMode] = useState<"" | "facecam" | "identity" | "import">("");
  const [facecamBlob, setFacecamBlob] = useState<Blob | null>(null);
  const [importedFile, setImportedFile] = useState<File | null>(null);

  // Facecam phases
  const [facecamPhase, setFacecamPhase] = useState<"script" | "naturalizing" | "review" | "recording">("script");
  const [facecamScript, setFacecamScript] = useState("");
  const [facecamOriginalScript, setFacecamOriginalScript] = useState("");
  const [facecamVariant, setFacecamVariant] = useState("intro");
  const [facecamWithTeleprompter, setFacecamWithTeleprompter] = useState(false);
  const [facecamTransitioning, setFacecamTransitioning] = useState(false);
  const [showOriginalScript, setShowOriginalScript] = useState(false);

  // Script for identity path
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

  // Initialize facecam script when entering facecam mode
  useEffect(() => {
    if (videoMode === "facecam" && !facecamScript) {
      setFacecamScript(generateFacecamScript("intro", prospectCompany, contacts[0]?.firstName || ""));
    }
  }, [videoMode, facecamScript, prospectCompany, contacts]);

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

  const switchFacecamVariant = (v: string) => {
    setFacecamVariant(v);
    setFacecamScript(generateFacecamScript(v, prospectCompany, contacts[0]?.firstName || ""));
  };

  const naturalizeScript = async () => {
    if (!facecamScript.trim()) {
      transitionToRecording(true);
      return;
    }
    setFacecamOriginalScript(facecamScript);
    setFacecamPhase("naturalizing");
    try {
      const res = await supabase.functions.invoke("transform-script-to-speech", {
        body: { campaign_id: "00000000-0000-0000-0000-000000000000", script: facecamScript },
      });
      if (res.error || !res.data?.script_oral) {
        // Fallback: use original script
        setFacecamPhase("review");
        return;
      }
      setFacecamScript(res.data.script_oral);
      setFacecamPhase("review");
    } catch {
      // Fallback silently
      setFacecamPhase("review");
    }
  };

  const transitionToRecording = (withTeleprompter: boolean) => {
    setFacecamWithTeleprompter(withTeleprompter);
    setFacecamTransitioning(true);
    setTimeout(() => {
      setFacecamPhase("recording");
      setFacecamTransitioning(false);
    }, 300);
  };

  const canProceedAsset =
    assetType === "document" ||
    (assetType === "video" && videoMode === "facecam" && !!facecamBlob) ||
    (assetType === "video" && videoMode === "identity" && !!selectedIdentityId && !!script.trim()) ||
    (assetType === "video" && videoMode === "import" && !!importedFile);

  const handleSubmit = async () => {
    if (assetType === "video" && videoMode === "identity" && !selectedIdentity) {
      toast({ title: "Identité requise", description: "Veuillez sélectionner une identité pour la vidéo exec.", variant: "destructive" });
      return;
    }
    if (assetType === "video" && videoMode === "identity" && !script.trim()) {
      toast({ title: "Script requis", description: "Veuillez rédiger ou générer un script.", variant: "destructive" });
      return;
    }
    if (assetType === "video" && videoMode === "facecam" && !facecamBlob) {
      toast({ title: "Vidéo requise", description: "Veuillez enregistrer une vidéo.", variant: "destructive" });
      return;
    }
    if (assetType === "video" && videoMode === "import" && !importedFile) {
      toast({ title: "Fichier requis", description: "Veuillez importer une vidéo.", variant: "destructive" });
      return;
    }
    if (!campaignName.trim()) {
      toast({ title: "Nom requis", description: "Veuillez saisir un nom de deal.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
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

      const isExecVideo = assetType === "video" && videoMode === "identity";
      const needsApproval = isExecVideo ? requiresApproval() : false;
      const initialStatus = needsApproval ? "pending_approval" : (isExecVideo ? "approved" : "draft");

      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          org_id: membership!.org_id,
          created_by_user_id: user.id,
          identity_id: isExecVideo ? selectedIdentity?.id : null,
          name: campaignName,
          script: script || "—",
          is_self_campaign: isExecVideo ? isSelfIdentity : true,
          status: initialStatus,
          approved_at: !needsApproval && isExecVideo ? new Date().toISOString() : null,
          approved_by_user_id: !needsApproval && isExecVideo ? user.id : null,
          account_id: accountId,
          crm_stage: dealStage || null,
          deal_experience_mode: assetType === "document" ? "pull_only" : "push_only",
          metadata: {
            stage: dealStage || null,
            deal_value: dealValue ? parseFloat(dealValue) * 1000 : null,
            asset_type: assetType,
            video_mode: assetType === "video" ? videoMode : null,
          },
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      await supabase.from("agent_context").insert({
        campaign_id: campaign.id,
        stage: dealStage || null,
        incumbent_present: hasIncumbent === "yes",
        incumbent_type: hasIncumbent === "yes" ? (incumbentType || "unknown") : null,
        competitive_situation: hasIncumbent === "yes" ? "incumbent" : hasIncumbent === "unknown" ? "unknown" : "greenfield",
      });

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

      if (assetType === "video" && (videoMode === "facecam" || videoMode === "import")) {
        const fileToUpload = videoMode === "facecam" ? facecamBlob! : importedFile!;
        const ext = videoMode === "facecam" ? "webm" : (importedFile?.name.split(".").pop() || "mp4");
        const filePath = `${membership!.org_id}/${campaign.id}/video-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("deal-videos")
          .upload(filePath, fileToUpload, {
            contentType: videoMode === "facecam" ? "video/webm" : importedFile?.type || "video/mp4",
          });

        if (!uploadError) {
          await supabase.from("deal_assets").insert({
            campaign_id: campaign.id,
            asset_type: "video",
            asset_purpose: "intro",
            file_url: filePath,
          });
        }
        toast({ title: "Deal créé", description: "La vidéo a été uploadée avec succès." });
      } else if (isExecVideo && selectedIdentity) {
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
    { num: 2, label: "Concurrent", icon: Swords },
    { num: 3, label: "Contacts", icon: UserPlus },
    { num: 4, label: "Asset", icon: FileVideo },
  ];

  const canProceedStep1 = campaignName.trim() && prospectCompany.trim();

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
          <EkkoLoader mode="once" size={40} />
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

          {/* ════════ STEP 1 — Context ════════ */}
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
                  <Input type="number" min="0" value={dealValue} onChange={(e) => setDealValue(e.target.value)} placeholder="Ex : 200" />
                </div>

                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select value={dealStage} onValueChange={setDealStage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez le stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_STAGES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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

          {/* ════════ STEP 2 — Competitor ════════ */}
          {currentStep === 2 && (
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
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                  </Button>
                  <Button onClick={() => setCurrentStep(3)} className="flex-1 rounded-cta bg-accent text-accent-foreground hover:bg-accent/90">
                    Continuer <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ════════ STEP 3 — Contacts ════════ */}
          {currentStep === 3 && (
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

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCurrentStep(2)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                  </Button>
                  <Button onClick={() => setCurrentStep(4)} className="flex-1 rounded-cta bg-accent text-accent-foreground hover:bg-accent/90">
                    Continuer <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="link-action w-full text-center text-sm py-3"
                >
                  Passer — j'ajouterai les contacts plus tard
                </button>
              </CardContent>
            </Card>
          )}

          {/* ════════ STEP 4 — Asset ════════ */}
          {currentStep === 4 && (
            <Card className="animate-fade-in rounded-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileVideo className="h-5 w-5" />
                  Asset de démarrage
                </CardTitle>
                <CardDescription>Que voulez-vous envoyer ?</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col" style={{ maxHeight: "calc(100vh - 260px)" }}>
                <div className="flex-1 overflow-y-auto space-y-6 pb-4">
                  {/* Initial choice: video or document */}
                  {assetType !== "video" && (
                    <RadioGroup
                      value={assetType}
                      onValueChange={(v) => {
                        setAssetType(v as "video" | "document");
                        setVideoMode("");
                      }}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value="video" id="asset-video" />
                        <FileVideo className="h-5 w-5 text-muted-foreground" />
                        <Label htmlFor="asset-video" className="cursor-pointer flex-1">
                          <span className="block">Envoyer une vidéo</span>
                          <span className="block text-xs font-normal text-muted-foreground">Facecam, clone ou démo produit</span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value="document" id="asset-document" />
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <Label htmlFor="asset-document" className="cursor-pointer flex-1">
                          <span className="block">Partager un document</span>
                          <span className="block text-xs font-normal text-muted-foreground">PDF, présentation, pricing</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  )}

                  {/* Video sub-flow: choose mode */}
                  {assetType === "video" && !videoMode && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setAssetType("")}
                        className="link-action text-sm flex items-center gap-1 -mt-2"
                      >
                        <ArrowLeft className="h-3 w-3" /> Changer le type d'asset
                      </button>
                      <p className="text-sm font-medium">Comment voulez-vous créer cette vidéo ?</p>
                      <div className="space-y-2">
                        {[
                          { key: "facecam" as const, icon: Camera, label: "Enregistrer maintenant", desc: "Je me filme depuis mon navigateur" },
                          { key: "identity" as const, icon: Bot, label: "Utiliser une identité", desc: "Vidéo générée avec un clone vocal et visuel" },
                          { key: "import" as const, icon: Upload, label: "Importer une vidéo existante", desc: "Réunion enregistrée, démo, présentation filmée" },
                        ].map((opt) => (
                          <div
                            key={opt.key}
                            className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => {
                              setVideoMode(opt.key);
                              if (opt.key === "facecam") {
                                setFacecamPhase("script");
                                setFacecamBlob(null);
                                setFacecamWithTeleprompter(false);
                              }
                            }}
                          >
                            <opt.icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{opt.label}</p>
                              <p className="text-xs text-muted-foreground">{opt.desc}</p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ──── FACECAM PATH ──── */}
                  {assetType === "video" && videoMode === "facecam" && (
                    <div className="space-y-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setVideoMode("");
                          setFacecamBlob(null);
                          setFacecamPhase("script");
                          setFacecamScript("");
                          setFacecamOriginalScript("");
                          setFacecamWithTeleprompter(false);
                          setShowOriginalScript(false);
                        }}
                        className="text-muted-foreground -mt-2"
                      >
                        <ArrowLeft className="mr-1 h-3 w-3" /> Changer de méthode
                      </Button>

                      {/* PHASE 1 — Script */}
                      {facecamPhase === "script" && (
                        <div
                          className={`space-y-4 transition-all duration-300 ease-out ${
                            facecamTransitioning ? "opacity-0 max-h-0 overflow-hidden" : "opacity-100 max-h-[800px]"
                          }`}
                        >
                          <p className="text-sm font-medium">Préparez votre script</p>

                          <div className="relative">
                            <div className="absolute top-2 right-2 z-10">
                              <ScriptGenerator
                                onScriptGenerated={(generatedScript) => setFacecamScript(generatedScript)}
                                senderName={`${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Votre nom"}
                                senderTitle={profile?.title || "Votre titre"}
                                defaultCompany={prospectCompany}
                                defaultContact={contacts[0]?.firstName || ""}
                                defaultPurpose={getPurposeFromStage(dealStage)}
                              />
                            </div>
                            <Textarea
                              value={facecamScript}
                              onChange={(e) => setFacecamScript(e.target.value)}
                              rows={8}
                              className="text-sm min-h-[200px] pr-36 leading-relaxed"
                              placeholder="Écrivez votre script ici..."
                            />
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button
                              onClick={() => naturalizeScript()}
                              className="w-full min-h-12 rounded-cta bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
                            >
                              Valider ce script <ArrowRight className="h-4 w-4" />
                            </Button>
                            <button
                              type="button"
                              onClick={() => transitionToRecording(false)}
                              className="link-action w-full text-center text-sm py-2"
                            >
                              Enregistrer sans script →
                            </button>
                          </div>
                        </div>
                      )}

                      {/* PHASE — Naturalizing */}
                      {facecamPhase === "naturalizing" && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                          <EkkoLoader mode="once" size={40} />
                          <p className="text-sm text-muted-foreground">Adaptation du script pour l'oral…</p>
                        </div>
                      )}

                      {/* PHASE — Review naturalized script */}
                      {facecamPhase === "review" && (
                        <div className="space-y-4 animate-fade-in">
                          <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                            <p className="text-sm text-foreground">
                              Ekko a adapté votre script pour sonner naturel à l'oral. Modifiez-le librement.
                            </p>
                            <button
                              type="button"
                              onClick={() => setShowOriginalScript(!showOriginalScript)}
                              className="text-xs text-muted-foreground underline mt-1 hover:text-foreground transition-colors"
                            >
                              {showOriginalScript ? "Masquer le script original" : "Voir le script original"}
                            </button>
                          </div>

                          {showOriginalScript && (
                            <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground whitespace-pre-wrap">
                              {facecamOriginalScript}
                            </div>
                          )}

                          <Textarea
                            value={facecamScript}
                            onChange={(e) => setFacecamScript(e.target.value)}
                            rows={5}
                            className="text-sm min-h-[120px]"
                          />

                          <Button
                            onClick={() => transitionToRecording(true)}
                            className="w-full min-h-12 rounded-cta bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
                          >
                            Lancer l'enregistrement <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {/* PHASE 2 — Recording */}
                      {facecamPhase === "recording" && (
                        <div className="animate-fade-in">
                          <FacecamRecorder
                            company={prospectCompany}
                            contactName={contacts[0]?.firstName || ""}
                            onRecorded={(blob) => setFacecamBlob(blob)}
                            onClear={() => setFacecamBlob(null)}
                            recordedBlob={facecamBlob}
                            externalScript={facecamWithTeleprompter ? facecamScript : ""}
                            showTeleprompter={facecamWithTeleprompter}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* ──── IDENTITY PATH ──── */}
                  {assetType === "video" && videoMode === "identity" && (
                    <div className="space-y-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setVideoMode(""); setSelectedIdentityId(""); setSelectedIdentity(null); setScript(""); }}
                        className="text-muted-foreground -mt-2"
                      >
                        <ArrowLeft className="mr-1 h-3 w-3" /> Changer de méthode
                      </Button>

                      <div className="space-y-3">
                        <Label>Qui apparaît dans la vidéo ? *</Label>
                        {identities.length === 0 ? (
                          <div className="p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                            <p>Aucune identité configurée.</p>
                            <Button variant="link" className="mt-1" onClick={() => navigate("/app/identities")}>
                              Créer une identité
                            </Button>
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

                      {selectedIdentity && (
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
                    </div>
                  )}

                  {/* ──── IMPORT PATH ──── */}
                  {assetType === "video" && videoMode === "import" && (
                    <div className="space-y-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setVideoMode(""); setImportedFile(null); }}
                        className="text-muted-foreground -mt-2"
                      >
                        <ArrowLeft className="mr-1 h-3 w-3" /> Changer de méthode
                      </Button>
                      <VideoImportUpload
                        onFileSelected={(file) => setImportedFile(file)}
                        onClear={() => setImportedFile(null)}
                        selectedFile={importedFile}
                      />
                    </div>
                  )}
                </div>

                {/* Sticky footer with submit */}
                <div className="flex flex-col gap-3 pt-4 border-t flex-shrink-0">
                  {/* Approval info for identity video */}
                  {assetType === "video" && videoMode === "identity" && requiresApproval() && (
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
                    <Button variant="outline" onClick={() => { setCurrentStep(3); setAssetType(""); setVideoMode(""); }}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !canProceedAsset}
                      className="flex-1 rounded-cta bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {isSubmitting ? (
                        <><EkkoLoader mode="once" size={16} className="mr-2" />Création...</>
                      ) : assetType === "video" && videoMode === "identity" && !requiresApproval() ? (
                        <><CheckCircle2 className="mr-2 h-4 w-4" />Créer et générer la vidéo</>
                      ) : assetType === "video" && videoMode === "identity" && requiresApproval() ? (
                        <><Send className="mr-2 h-4 w-4" />Créer et envoyer en validation</>
                      ) : assetType === "video" && (videoMode === "facecam" || videoMode === "import") ? (
                        <><CheckCircle2 className="mr-2 h-4 w-4" />Créer le deal et uploader la vidéo</>
                      ) : (
                        <><CheckCircle2 className="mr-2 h-4 w-4" />Créer le deal</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AppLayout>
  );
}
