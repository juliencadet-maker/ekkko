import { useState, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare, Send, Bot, User, Sparkles,
  TrendingUp, TrendingDown, Users, Zap, Shield, Eye,
  ChevronRight, X,
} from "lucide-react";
import { EkkoLoader } from "@/components/ui/EkkoLoader";

const BADGE_PATTERNS = [
  { pattern: /^\[FAIT\]\s*/, type: "fact" as const },
  { pattern: /^\[INFÉRENCE ≈?\]\s*/, type: "inference" as const },
  { pattern: /^\[CONTEXTE AE\]\s*/, type: "declared" as const },
];

const BADGE_STYLE = {
  fact: { label: "FAIT", bg: "#F7F6F3", color: "#0D1B2A", border: "#D1D5DB" },
  inference: { label: "INFÉRENCE ≈", bg: "#FAEEDA", color: "#E8A838", border: "#F5D08A" },
  declared: { label: "CONTEXTE AE", bg: "#E6F1FB", color: "#3B82F6", border: "#BFDBFE" },
} as const;

function parseAgentMessage(content: string): Array<{ badge: keyof typeof BADGE_STYLE | null; text: string }> {
  return content.split("\n").map(line => {
    for (const { pattern, type } of BADGE_PATTERNS) {
      if (pattern.test(line)) {
        return { badge: type, text: line.replace(pattern, "") };
      }
    }
    return { badge: null, text: line };
  });
}

interface EkkoAgentProps {
  campaignId: string;
  campaignName: string;
  viewers?: any[];
  dealScore?: any;
  initialPrompt?: string;
  onClose?: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  { label: "Lire ce deal", prompt: "Donne-moi une lecture globale de ce deal en 5 lignes. Qu'est-ce qui se passe vraiment ?" },
  { label: "Bloqueurs ?", prompt: "Y a-t-il des bloqueurs potentiels dans ce deal ? Qui sont-ils et pourquoi ?" },
  { label: "Decision window ?", prompt: "Est-ce que je suis dans une fenêtre de décision ? Quels signaux me font dire oui ou non ?" },
  { label: "Prochaine action", prompt: "Quelle est ma priorité absolue sur ce deal cette semaine ? Avec quel coût d'exécution ?" },
  { label: "Champions", prompt: "Qui sont mes champions sur ce deal ? Sont-ils fiables ? Quels signaux le confirment ?" },
  { label: "Comité complet ?", prompt: "Est-ce que j'ai une couverture suffisante du buying committee ? Qui me manque ?" },
];

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    sponsor_actif: "bg-emerald-500",
    neutre: "bg-amber-500",
    bloqueur_potentiel: "bg-red-500",
    nouveau: "bg-blue-500",
    inconnu: "bg-blue-400",
    unknown: "bg-muted-foreground",
  };
  return <div className={`w-2 h-2 rounded-full ${colors[status] || colors.unknown}`} />;
}

export function EkkoAgent({ campaignId, campaignName, viewers = [], dealScore, initialPrompt, onClose }: EkkoAgentProps) {
  const { membership } = useAuthContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"agent" | "deal" | "committee">("agent");
  const [selectedViewer, setSelectedViewer] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initial greeting
  useEffect(() => {
    const viewerCount = viewers.length || dealScore?.viewer_count || 0;
    const des = dealScore?.des ?? "N/A";
    setMessages([{
      role: "assistant",
      content: `Bonjour. Je suis l'agent Ekko sur ce deal.\n\nJ'ai accès à l'ensemble des signaux comportementaux — ${viewerCount} contacts identifiés, DES ${des}.\n\nQue veux-tu savoir ?`,
    }]);
  }, [campaignId]);

  // Handle initial prompt
  useEffect(() => {
    if (initialPrompt && messages.length === 1) {
      sendMessage(initialPrompt);
    }
  }, [initialPrompt, messages.length]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ekko-agent", {
        body: {
          campaign_id: campaignId,
          messages: newMessages,
          user_id: membership?.user_id || null,
        },
      });

      if (error) throw error;
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e) {
      console.error("Agent error:", e);
      setMessages((prev) => [...prev, { role: "assistant", content: "Erreur de connexion à l'agent. Réessayez." }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const getMomentumBadge = (momentum: string) => {
    if (momentum === "rising") return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">↑ Rising</Badge>;
    if (momentum === "declining") return <Badge className="bg-red-500/15 text-red-700 border-red-500/30">↓ Declining</Badge>;
    return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">→ Stable</Badge>;
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-purple-600">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Ekko Agent</p>
            <p className="text-[10px] text-muted-foreground">Deal Intelligence · {campaignName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {["agent", "deal", "committee"].map((t) => (
            <Button
              key={t}
              variant={activeTab === t ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setActiveTab(t as any)}
            >
              {t === "agent" ? "Agent" : t === "deal" ? "Deal" : "Comité"}
            </Button>
          ))}
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with deal summary */}
        <div className="w-56 border-r overflow-y-auto flex-shrink-0 hidden lg:block">
          {/* Deal summary */}
          <div className="p-3 border-b">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Deal actif</p>
            <p className="text-sm font-semibold truncate">{campaignName}</p>
            <div className="flex gap-2 mt-3">
              <div className="flex-1 bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-emerald-600">{dealScore?.des ?? "—"}</p>
                <p className="text-[9px] text-muted-foreground">DES</p>
              </div>
              <div className="flex-1 bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-primary">{viewers.length || dealScore?.viewer_count || 0}</p>
                <p className="text-[9px] text-muted-foreground">Contacts</p>
              </div>
            </div>
            {dealScore?.momentum && (
              <div className="mt-2">{getMomentumBadge(dealScore.momentum)}</div>
            )}
          </div>

          {/* Alerts */}
          {dealScore?.alerts && Array.isArray(dealScore.alerts) && (dealScore.alerts as any[]).length > 0 && (
            <div className="p-3 border-b space-y-2">
              {(dealScore.alerts as any[]).slice(0, 3).map((a: any, i: number) => (
                <div key={i} className={`text-[11px] p-2 rounded-md border ${
                  a.type === "danger" ? "bg-red-500/10 border-red-500/20 text-red-700" :
                  a.type === "warning" ? "bg-amber-500/10 border-amber-500/20 text-amber-700" :
                  "bg-blue-500/10 border-blue-500/20 text-blue-700"
                }`}>
                  {a.text}
                </div>
              ))}
            </div>
          )}

          {/* Committee list */}
          <div className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Buying committee</p>
            <div className="space-y-1">
              {viewers.slice(0, 10).map((v: any) => (
                <button
                  key={v.id}
                  onClick={() => { setSelectedViewer(v); setActiveTab("committee"); }}
                  className={`w-full flex items-center gap-2 p-2 rounded-md text-left hover:bg-muted/50 transition-colors ${
                    selectedViewer?.id === v.id ? "bg-muted" : ""
                  }`}
                >
                  <StatusDot status={v.status || "unknown"} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{v.name || v.email?.split("@")[0] || "Inconnu"}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{v.title || v.domain || "—"}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">{v.total_watch_depth ?? 0}%</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === "agent" && (
            <>
              {/* Quick prompts */}
              <div className="px-3 py-2 border-b flex gap-1.5 flex-wrap">
                {QUICK_PROMPTS.map((q, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] rounded-full px-2.5"
                    onClick={() => sendMessage(q.prompt)}
                    disabled={loading}
                  >
                    {q.label}
                  </Button>
                ))}
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    {m.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm whitespace-pre-wrap"
                        : "bg-muted rounded-bl-sm"
                    }`}>
                      {m.role === "assistant"
                        ? <div className="space-y-1">
                            {parseAgentMessage(m.content).map((part, j) =>
                              part.text.trim() === "" ? null : (
                                <div key={j} className="flex items-start gap-1.5">
                                  {part.badge && (
                                    <span
                                      className="inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium shrink-0 mt-0.5 border"
                                      style={{ backgroundColor: BADGE_STYLE[part.badge].bg, color: BADGE_STYLE[part.badge].color, borderColor: BADGE_STYLE[part.badge].border }}
                                    >
                                      {BADGE_STYLE[part.badge].label}
                                    </span>
                                  )}
                                  <span className="whitespace-pre-wrap">{part.text}</span>
                                </div>
                              )
                            )}
                          </div>
                        : m.content
                      }
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                    <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-1.5">
                      <EkkoLoader mode="loop" size={14} />
                      <span className="text-xs text-muted-foreground ml-1.5">Analyse en cours...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-2.5 border-t">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Pose une question sur ce deal..."
                    disabled={loading}
                    rows={2}
                    className="flex-1 bg-muted/50 border rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <Button
                    size="icon"
                    className="h-10 w-10 rounded-lg"
                    onClick={() => sendMessage()}
                    disabled={loading || !input.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {activeTab === "deal" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Deal scores */}
              {dealScore && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "DES", value: dealScore.des ?? "—", icon: Zap },
                    { label: "Breadth", value: `${Math.round((dealScore.breadth ?? 0) * 100) / 100}%`, icon: Users },
                    { label: "Velocity", value: dealScore.event_velocity ?? "—", icon: TrendingUp },
                    { label: "Multi-thread", value: dealScore.multi_threading_score ?? "—", icon: Shield },
                  ].map((s) => (
                    <div key={s.label} className="bg-muted/50 rounded-lg p-3 text-center">
                      <s.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-lg font-bold">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Cold start indicator */}
              {dealScore?.cold_start_regime && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <div>
                    <p className="text-xs font-medium text-amber-700">
                      Régime : {dealScore.cold_start_regime === "cold_global" ? "Cold Global" :
                        dealScore.cold_start_regime === "cold_account" ? "Cold Account" :
                        dealScore.cold_start_regime === "warm_account" ? "Warm Account" : "Mature"}
                    </p>
                    <p className="text-[10px] text-amber-600">
                      {dealScore.cold_start_regime === "cold_global" ? "Heuristiques génériques — fiabilité limitée" :
                        dealScore.cold_start_regime === "cold_account" ? "Benchmarks industrie disponibles" :
                        dealScore.cold_start_regime === "warm_account" ? "Patterns compte activés" : "Insights complets"}
                    </p>
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setActiveTab("agent"); sendMessage("Analyse la situation globale de ce deal et dis-moi ce qui est le plus important."); }}
              >
                Demander à l'agent d'analyser ce deal ↗
              </Button>
            </div>
          )}

          {activeTab === "committee" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedViewer ? (
                <div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedViewer(null)} className="mb-3">
                    ← Retour
                  </Button>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-xs">
                        {(selectedViewer.name || "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{selectedViewer.name || "Inconnu"}</p>
                      <p className="text-xs text-muted-foreground">{selectedViewer.title || selectedViewer.domain || "—"}</p>
                    </div>
                    {selectedViewer.contact_score != null && (
                      <div className="text-center">
                        <p className={`text-xl font-bold ${selectedViewer.contact_score > 70 ? "text-emerald-600" : selectedViewer.contact_score > 40 ? "text-amber-600" : "text-red-600"}`}>
                          {selectedViewer.contact_score}
                        </p>
                        <p className="text-[9px] text-muted-foreground">Contact</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: "Watch depth", value: `${selectedViewer.total_watch_depth ?? 0}%` },
                      { label: "Partages", value: selectedViewer.share_count ?? 0 },
                      { label: "Sponsor score", value: selectedViewer.sponsor_score ?? "N/A" },
                      { label: "Replays", value: selectedViewer.replay_count ?? 0 },
                    ].map((s) => (
                      <div key={s.label} className="bg-muted/50 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                        <p className="text-sm font-semibold">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setActiveTab("agent");
                      sendMessage(`Analyse-moi le profil de ${selectedViewer.name || "ce contact"} (${selectedViewer.title || "rôle inconnu"}). Watch depth ${selectedViewer.total_watch_depth ?? 0}%, statut ${selectedViewer.status || "inconnu"}, ${selectedViewer.share_count || 0} partages, sponsor score ${selectedViewer.sponsor_score ?? "N/A"}. Qu'est-ce que ça signifie et quelle est ma prochaine action ?`);
                    }}
                  >
                    Demander à l'agent d'analyser ce contact ↗
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Sponsor map</p>
                  {viewers.map((v: any) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedViewer(v)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border mb-2 hover:bg-muted/50 transition-colors text-left"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10px]">
                          {(v.name || "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{v.name || v.email?.split("@")[0] || "Inconnu"}</p>
                        <p className="text-[10px] text-muted-foreground">{v.title || v.domain || "—"} · Partages: {v.share_count ?? 0}</p>
                      </div>
                      <StatusDot status={v.status || "unknown"} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
