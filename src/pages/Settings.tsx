import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { canManageOrg } from "@/lib/roles";
import { toast } from "sonner";
import { Check, Loader2, ExternalLink, Link2, Link2Off, MessageSquare, Hash, ShieldOff } from "lucide-react";

export default function Settings() {
  const { profile, org, membership } = useAuthContext();
  const [hubspotKey, setHubspotKey] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");

  // Slack state
  const [slackChannelId, setSlackChannelId] = useState("");
  const [slackStatus, setSlackStatus] = useState<"unknown" | "connected" | "testing" | "error">("unknown");
  const [isSavingSlack, setIsSavingSlack] = useState(false);

  const isOwnerOrAdmin = membership?.role === "org_owner" || membership?.role === "org_admin";
  const userRole = membership?.role || "org_user";

  useEffect(() => {
    if (org?.settings) {
      const settings = org.settings as Record<string, unknown>;
      if (settings.hubspot_api_key) {
        setHubspotKey("••••••••••••" + String(settings.hubspot_api_key).slice(-4));
        setConnectionStatus("connected");
      }
      if (settings.slack_channel_id) {
        setSlackChannelId(String(settings.slack_channel_id));
        setSlackStatus("connected");
      }
    }
  }, [org]);

  const saveHubspotKey = async () => {
    if (!org || !hubspotKey || hubspotKey.startsWith("••••")) return;
    setIsSaving(true);
    try {
      const currentSettings = (org.settings as Record<string, string | number | boolean | null>) || {};
      const { error } = await supabase
        .from("orgs")
        .update({ settings: { ...currentSettings, hubspot_api_key: hubspotKey } as Record<string, string | number | boolean | null> })
        .eq("id", org.id);
      if (error) throw error;
      toast.success("Clé API HubSpot sauvegardée");
      setConnectionStatus("connected");
    } catch (e) {
      toast.error("Erreur lors de la sauvegarde");
      console.error("Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    setIsTestingConnection(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("hubspot-sync", {
        body: { action: "test_connection" },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      if (res.data?.success) {
        setConnectionStatus("connected");
        toast.success("Connexion HubSpot vérifiée ✓");
      } else {
        setConnectionStatus("error");
        toast.error(res.data?.message || "Connexion échouée");
      }
    } catch {
      setConnectionStatus("error");
      toast.error("Erreur lors du test de connexion");
    } finally {
      setIsTestingConnection(false);
    }
  };

  const disconnectHubspot = async () => {
    if (!org) return;
    try {
      const currentSettings = (org.settings as Record<string, string | number | boolean | null>) || {};
      const { hubspot_api_key: _, ...rest } = currentSettings;
      await supabase.from("orgs").update({ settings: rest as Record<string, string | number | boolean | null> }).eq("id", org.id);
      setHubspotKey("");
      setConnectionStatus("unknown");
      toast.success("HubSpot déconnecté");
    } catch {
      toast.error("Erreur lors de la déconnexion");
    }
  };

  const saveSlackChannel = async () => {
    if (!org || !slackChannelId.trim()) return;
    setIsSavingSlack(true);
    try {
      const currentSettings = (org.settings as Record<string, any>) || {};
      const { error } = await supabase
        .from("orgs")
        .update({ settings: { ...currentSettings, slack_channel_id: slackChannelId.trim() } })
        .eq("id", org.id);
      if (error) throw error;
      setSlackStatus("connected");
      toast.success("Canal Slack configuré — les notifications d'approbation seront envoyées ici");
    } catch (e) {
      toast.error("Erreur lors de la sauvegarde");
      console.error("Save failed");
    } finally {
      setIsSavingSlack(false);
    }
  };

  const testSlack = async () => {
    if (!slackChannelId.trim()) return;
    setSlackStatus("testing");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("notify-approval", {
        body: { test_slack: true, channel_id: slackChannelId.trim() },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      if (!res.error) {
        setSlackStatus("connected");
        toast.success("Message test envoyé sur Slack ✓");
      } else {
        setSlackStatus("error");
        toast.error("Échec de l'envoi du message test");
      }
    } catch {
      setSlackStatus("error");
      toast.error("Erreur de connexion");
    }
  };

  const disconnectSlack = async () => {
    if (!org) return;
    try {
      const currentSettings = (org.settings as Record<string, any>) || {};
      const { slack_channel_id: _, ...rest } = currentSettings;
      await supabase.from("orgs").update({ settings: rest }).eq("id", org.id);
      setSlackChannelId("");
      setSlackStatus("unknown");
      toast.success("Slack déconnecté");
    } catch {
      toast.error("Erreur lors de la déconnexion");
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Paramètres" description="Configuration de votre organisation" />
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Organisation</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><span className="text-muted-foreground">Nom:</span> {org?.name}</p>
              <p><span className="text-muted-foreground">Identifiant:</span> {org?.slug}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Profil</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><span className="text-muted-foreground">Nom:</span> {profile?.first_name} {profile?.last_name}</p>
              <p><span className="text-muted-foreground">Email:</span> {profile?.email}</p>
              <p><span className="text-muted-foreground">Fonction:</span> {profile?.title}</p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Slack Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Notifications Slack
                  {slackStatus === "connected" && (
                    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                      <Check className="h-3 w-3 mr-1" /> Actif
                    </Badge>
                  )}
                  {slackStatus === "error" && <Badge variant="destructive">Erreur</Badge>}
                </CardTitle>
                <CardDescription className="mt-1">
                  Envoyez les demandes d'approbation directement dans un canal Slack — vos execs approuvent en un tap depuis Slack.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 border text-sm space-y-2">
              <p className="font-medium">Comment ça marche :</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Ajoutez le bot Ekko à votre workspace Slack</li>
                <li>Copiez l'ID du canal où envoyer les notifications (clic droit sur le canal → Copier l'ID)</li>
                <li>Collez l'ID ci-dessous</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Chaque demande d'approbation enverra un message riche avec un bouton « Relire et répondre » vers la page d'approbation mobile.
              </p>
            </div>

            {isOwnerOrAdmin ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="C0123456789"
                      value={slackChannelId}
                      onChange={(e) => {
                        setSlackChannelId(e.target.value);
                        if (slackStatus === "connected") setSlackStatus("unknown");
                      }}
                      className="pl-9 font-mono text-sm"
                    />
                  </div>
                  <Button onClick={saveSlackChannel} disabled={isSavingSlack || !slackChannelId.trim()}>
                    {isSavingSlack ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                    Sauvegarder
                  </Button>
                </div>
                {(slackStatus === "connected" || slackStatus === "testing") && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={testSlack} disabled={slackStatus === "testing"}>
                      {slackStatus === "testing" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                      Envoyer un message test
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={disconnectSlack}>
                      <Link2Off className="h-3.5 w-3.5 mr-1" /> Déconnecter
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Seuls les administrateurs peuvent configurer Slack.
              </p>
            )}
          </CardContent>
        </Card>

        {/* HubSpot Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Intégration HubSpot
                  {connectionStatus === "connected" && (
                    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                      <Check className="h-3 w-3 mr-1" /> Connecté
                    </Badge>
                  )}
                  {connectionStatus === "error" && <Badge variant="destructive">Erreur</Badge>}
                </CardTitle>
                <CardDescription className="mt-1">
                  Synchronisez les données d'engagement vidéo vers votre CRM HubSpot
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 border text-sm space-y-2">
              <p className="font-medium">Pour connecter HubSpot :</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Allez dans <strong>HubSpot → Settings → Integrations → Private Apps</strong></li>
                <li>Créez une Private App avec les scopes : <code className="text-xs bg-muted px-1 py-0.5 rounded">crm.objects.contacts.write</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">crm.objects.contacts.read</code></li>
                <li>Copiez le token et collez-le ci-dessous</li>
              </ol>
              <a href="https://developers.hubspot.com/docs/guides/apps/private-apps/overview" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline mt-1">
                Documentation HubSpot <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {isOwnerOrAdmin ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="pat-xx-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={hubspotKey}
                    onChange={(e) => { setHubspotKey(e.target.value); setConnectionStatus("unknown"); }}
                    className="font-mono text-sm"
                  />
                  <Button onClick={saveHubspotKey} disabled={isSaving || !hubspotKey || hubspotKey.startsWith("••••")}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                    Sauvegarder
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={testConnection} disabled={isTestingConnection || connectionStatus === "unknown"}>
                    {isTestingConnection ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                    Tester la connexion
                  </Button>
                  {connectionStatus === "connected" && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={disconnectHubspot}>
                      <Link2Off className="h-3.5 w-3.5 mr-1" /> Déconnecter
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Seuls les administrateurs peuvent configurer l'intégration HubSpot.
              </p>
            )}

            {connectionStatus === "connected" && (
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-sm">
                <p className="font-medium text-accent-foreground">Propriétés personnalisées créées dans HubSpot :</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["ekko_lead_score", "ekko_watch_percentage", "ekko_total_watch_time", "ekko_sessions", "ekko_interest_level", "ekko_is_champion", "ekko_committee_role", "ekko_campaign", "ekko_last_activity"].map((p) => (
                    <code key={p} className="text-xs bg-muted px-1.5 py-0.5 rounded">{p}</code>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
