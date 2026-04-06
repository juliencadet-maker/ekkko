import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { EkkoLoader } from "@/components/ui/EkkoLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Link, Clock, User } from "lucide-react";

const PURPOSE_LABELS: Record<string, string> = {
  intro: "Introduction",
  pricing: "Proposition commerciale",
  technical: "Détails techniques",
  legal: "Éléments juridiques",
  closing: "Closing",
  followup: "Suivi",
};
const TYPE_LABELS: Record<string, string> = {
  video: "Vidéo",
  document: "Document",
  link: "Lien",
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface DealItem {
  id: string;
  name: string;
  deal_status: string | null;
}

interface AssetItem {
  id: string;
  asset_type: string;
  asset_purpose: string;
  version_number: number | null;
}

interface ContactItem {
  id: string;
  name: string | null;
  title: string | null;
  email: string | null;
}

interface DeliveryItem {
  id: string;
  delivery_token: string;
  asset_id: string;
  share_mode: string | null;
  sent_at: string | null;
  recipient_email: string | null;
  asset_purpose: string | null;
}

export default function SharePage() {
  const { membership } = useAuthContext();
  const navigate = useNavigate();

  const [deals, setDeals] = useState<DealItem[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [dealAssets, setDealAssets] = useState<AssetItem[]>([]);
  const [knownContacts, setKnownContacts] = useState<ContactItem[]>([]);
  const [shareMode, setShareMode] = useState("direct");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [selectedContactSource, setSelectedContactSource] = useState<
    "suggested" | "manual"
  >("manual");
  const [recentLinks, setRecentLinks] = useState<DeliveryItem[]>([]);
  const [generatingAssetId, setGeneratingAssetId] = useState<string | null>(
    null
  );
  const [generatedLinks, setGeneratedLinks] = useState<
    Record<string, string>
  >({});
  const [isLoadingDeals, setIsLoadingDeals] = useState(true);

  // Deals actifs triés par priority_deal_score DESC
  useEffect(() => {
    if (!membership?.org_id) return;
    const fetchDeals = async () => {
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id, name, deal_status")
        .eq("org_id", membership.org_id)
        .not("deal_status", "eq", "closed")
        .limit(50);

      if (!campaigns?.length) {
        setDeals([]);
        setIsLoadingDeals(false);
        return;
      }

      const ids = campaigns.map((c) => c.id);
      const { data: scores } = await supabase
        .from("deal_scores")
        .select("campaign_id, priority_deal_score, scored_at")
        .in("campaign_id", ids)
        .order("scored_at", { ascending: false });

      const scoreMap: Record<string, number> = {};
      scores?.forEach((s) => {
        if (!(s.campaign_id in scoreMap) && s.priority_deal_score != null)
          scoreMap[s.campaign_id] = s.priority_deal_score;
      });

      const sorted = [...campaigns].sort((a, b) => {
        const sa = scoreMap[a.id] ?? -1;
        const sb = scoreMap[b.id] ?? -1;
        if (sb !== sa) return sb - sa;
        return a.name.localeCompare(b.name);
      });

      setDeals(sorted);
      setIsLoadingDeals(false);
    };
    fetchDeals();
  }, [membership?.org_id]);

  // Assets valid + contacts connus (powermap) + historique
  useEffect(() => {
    if (!selectedDealId) return;
    setGeneratedLinks({});
    setRecipientEmail("");
    setSelectedContactSource("manual");
    setKnownContacts([]);
    const fetchData = async () => {
      const [assetsRes, historyRes, viewersRes] = await Promise.all([
        supabase
          .from("deal_assets")
          .select("id, asset_type, asset_purpose, version_number")
          .eq("campaign_id", selectedDealId)
          .eq("asset_status", "valid")
          .order("created_at", { ascending: false }),
        supabase
          .from("asset_deliveries")
          .select(
            "id, delivery_token, asset_id, share_mode, sent_at, recipient_email, asset_purpose"
          )
          .eq("campaign_id", selectedDealId)
          .order("sent_at", { ascending: false })
          .limit(5),
        supabase
          .from("viewers")
          .select("id, name, title, email")
          .eq("campaign_id", selectedDealId)
          .eq("is_known", true)
          .not("email", "is", null)
          .order("contact_score", { ascending: false, nullsFirst: false })
          .limit(5),
      ]);
      setDealAssets((assetsRes.data as AssetItem[]) || []);
      setRecentLinks((historyRes.data as DeliveryItem[]) || []);
      setKnownContacts(
        ((viewersRes.data as ContactItem[]) || []).filter((v) => v.email)
      );
    };
    fetchData();
  }, [selectedDealId]);

  const handleGenerateLink = async (assetId: string) => {
    if (!selectedDealId) return;
    const emailToSend = recipientEmail.trim();
    const validEmail =
      emailToSend && EMAIL_REGEX.test(emailToSend) ? emailToSend : undefined;

    setGeneratingAssetId(assetId);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-tracked-link",
        {
          body: {
            campaign_id: selectedDealId,
            asset_id: assetId,
            share_mode: shareMode,
            ...(validEmail
              ? {
                  recipient_email: validEmail,
                  recipient_source: selectedContactSource,
                }
              : {}),
          },
        }
      );
      if (error || !data?.tracked_url) throw error;

      setGeneratedLinks((prev) => ({ ...prev, [assetId]: data.tracked_url }));

      // Refresh historique
      const { data: history } = await supabase
        .from("asset_deliveries")
        .select(
          "id, delivery_token, asset_id, share_mode, sent_at, recipient_email, asset_purpose"
        )
        .eq("campaign_id", selectedDealId)
        .order("sent_at", { ascending: false })
        .limit(5);
      setRecentLinks((history as DeliveryItem[]) || []);
    } catch {
      toast.error("Impossible de générer le lien. Réessayez.");
    } finally {
      setGeneratingAssetId(null);
    }
  };

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("Lien copié");
  };

  const siteBase = window.location.origin;

  if (isLoadingDeals)
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <EkkoLoader mode="loop" />
        </div>
      </AppLayout>
    );

  return (
    <AppLayout>
      <PageHeader title="Partager un asset" />

      <div className="max-w-2xl mx-auto space-y-6 mt-6">
        {deals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Aucun deal actif. Créez d'abord un deal pour partager des
                assets.
              </p>
              <Button onClick={() => navigate("/app/campaigns/new")}>
                Créer un deal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 1. Deal + destinataire */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Deal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={selectedDealId || ""}
                  onValueChange={(v) => setSelectedDealId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un deal" />
                  </SelectTrigger>
                  <SelectContent>
                    {deals.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Contacts connus (powermap) */}
                {selectedDealId && knownContacts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Contacts identifiés sur ce deal
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {knownContacts.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => {
                            setRecipientEmail(contact.email || "");
                            setSelectedContactSource("suggested");
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors ${
                            recipientEmail === contact.email
                              ? "border-accent bg-accent/10 text-accent font-medium"
                              : "border-border bg-muted/30 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                          }`}
                        >
                          <User className="h-3 w-3" />
                          {contact.name || contact.email}
                          {contact.title && (
                            <span className="opacity-60">
                              · {contact.title}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Email libre */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {knownContacts.length > 0
                      ? "Ou saisir un autre email"
                      : "Email du destinataire (optionnel)"}
                  </label>
                  <Input
                    type="email"
                    placeholder="cfo@entreprise.com"
                    value={recipientEmail}
                    onChange={(e) => {
                      setRecipientEmail(e.target.value);
                      setSelectedContactSource("manual");
                    }}
                    className="h-8 text-sm"
                  />
                  {recipientEmail && !EMAIL_REGEX.test(recipientEmail) && (
                    <p className="text-xs text-destructive">
                      Format email invalide
                    </p>
                  )}
                </div>

                {/* Canal d'envoi */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Via</span>
                  <Select value={shareMode} onValueChange={setShareMode}>
                    <SelectTrigger className="w-40 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Lien direct</SelectItem>
                      <SelectItem value="email">Email / Autre</SelectItem>
                      <SelectItem value="slack">Slack</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* 2. Assets valid */}
            {selectedDealId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assets</CardTitle>
                </CardHeader>
                <CardContent>
                  {dealAssets.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucun asset prêt à partager sur ce deal.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {dealAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg border bg-muted/20"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {PURPOSE_LABELS[asset.asset_purpose] ||
                                asset.asset_purpose}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {TYPE_LABELS[asset.asset_type] ||
                                asset.asset_type}
                              {asset.version_number &&
                                asset.version_number > 1 &&
                                ` · v${asset.version_number}`}
                            </p>
                          </div>
                          <div>
                            {generatedLinks[asset.id] ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleCopy(generatedLinks[asset.id])
                                }
                                className="h-8 text-xs gap-1"
                              >
                                <Copy className="h-3.5 w-3.5" /> Copier
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerateLink(asset.id)}
                                disabled={generatingAssetId === asset.id}
                                className="h-8 text-xs gap-1"
                              >
                                {generatingAssetId === asset.id ? (
                                  <EkkoLoader mode="once" size={14} />
                                ) : (
                                  <>
                                    <Link className="h-3.5 w-3.5" /> Générer
                                    un lien tracké
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 3. Historique */}
            {selectedDealId && recentLinks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Derniers liens générés
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {recentLinks.map((link) => {
                      const diffMin = Math.floor(
                        (Date.now() - new Date(link.sent_at || "").getTime()) /
                          60000
                      );
                      const timeLabel =
                        diffMin < 60
                          ? `il y a ${diffMin}min`
                          : diffMin < 1440
                            ? `il y a ${Math.floor(diffMin / 60)}h`
                            : `il y a ${Math.floor(diffMin / 1440)}j`;

                      const linkUrl =
                        generatedLinks[link.asset_id] ??
                        `${siteBase}/lp/${selectedDealId}?ref=${link.delivery_token}`;

                      return (
                        <div
                          key={link.id}
                          className="flex items-center justify-between text-xs text-muted-foreground"
                        >
                          <div className="flex items-center gap-2">
                            <span>{timeLabel}</span>
                            {link.recipient_email && (
                              <span className="text-foreground/70">
                                → {link.recipient_email}
                              </span>
                            )}
                            {link.asset_purpose && (
                              <span className="opacity-60">
                                ·{" "}
                                {PURPOSE_LABELS[link.asset_purpose] ||
                                  link.asset_purpose}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleCopy(linkUrl)}
                            className="shrink-0 underline hover:text-foreground transition-colors"
                          >
                            Copier
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
