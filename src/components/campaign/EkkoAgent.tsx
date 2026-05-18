// 1d.5h-bis Phase 2 — EkkoAgent refondu.
// - Prop `density` ("compact"|"full") pilote padding/typo
// - Portfolio mode quand campaignId === null (cross-deal)
// - Markdown rendering (react-markdown + remark-gfm) sur messages assistant
// - Liens cliquables target=_blank rel=noopener
// - Bulles brand: AE = bg-primary/text-primary-foreground (Marine/Ivoire),
//   agent = bg-card border (Ivoire/Marine), CTA = bg-accent (Signal Green)
// - Suppression E1/E2 (handleSuggestionAction, agentSuggestion, regex extract)
// - Wording: "Execution Amplifier" (jamais "Deal Intelligence")
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Send, Bot, Sparkles,
  TrendingUp, Users, Zap, Shield, X,
} from "lucide-react";
import { EkkoLoader } from "@/components/ui/EkkoLoader";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const BADGE_PATTERNS = [
  { pattern: /^\[FAIT\]\s*/, type: "fact" as const },
  { pattern: /^\[INFÉRENCE ≈?\]\s*/, type: "inference" as const },
  { pattern: /^\[CONTEXTE AE\]\s*/, type: "declared" as const },
];

const BADGE_STYLE = {
  fact:      { label: "FAIT",         bg: "hsl(var(--muted))",  fg: "hsl(var(--foreground))", border: "hsl(var(--border)/0.3)" },
  inference: { label: "INFÉRENCE ≈",  bg: "hsl(37 80% 92%)",    fg: "hsl(37 80% 35%)",        border: "hsl(37 80% 75%)" },
  declared:  { label: "CONTEXTE AE",  bg: "hsl(217 91% 95%)",   fg: "hsl(217 91% 45%)",       border: "hsl(217 91% 80%)" },
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
  campaignId: string | null;
  campaignName?: string;
  viewers?: any[];
  dealScore?: any;
  initialPrompt?: string;
  onClose?: () => void;
  density?: "compact" | "full";
}

interface ToolEvent {
  tool: string;
  status: "start" | "ok" | "err";
}

interface Message {
  role: "user" | "assistant";
  content: string;
  toolEvents?: ToolEvent[];
  streaming?: boolean;
}

const QUICK_PROMPTS_DEAL = [
  { label: "Lire ce deal",          prompt: "Donne-moi une lecture globale de ce deal en 5 lignes. Qu'est-ce qui se passe vraiment ?" },
  { label: "Champions actifs ?",    prompt: "Qui sont mes champions sur ce deal ? Sont-ils fiables ? Quels signaux le confirment ?" },
  { label: "Fenêtre de décision ?", prompt: "Est-ce que je suis dans une fenêtre de décision ? Quels signaux me font dire oui ou non ?" },
  { label: "Prochaine action",      prompt: "Quelle est ma priorité absolue sur ce deal cette semaine ? Avec quel coût d'exécution ?" },
  { label: "Concurrent ?",          prompt: "Y a-t-il un concurrent en place ou en évaluation ? Quel est mon niveau de risque ?" },
  { label: "Comité complet ?",      prompt: "Ai-je une couverture suffisante du buying committee ? Qui me manque ?" },
];

const QUICK_PROMPTS_PORTFOLIO = [
  { label: "Top 3 priorités",       prompt: "Quels sont mes 3 deals prioritaires cette semaine et pourquoi ?" },
  { label: "Deals à risque",        prompt: "Quels deals montrent des signaux de risque ou de silence ?" },
  { label: "Actions en attente",    prompt: "Quelles actions ai-je en attente de validation ?" },
  { label: "Momentum portfolio",    prompt: "Comment évolue mon portfolio en momentum global ?" },
];

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    sponsor_actif: "bg-accent",
    neutre: "bg-warning",
    bloqueur_potentiel: "bg-destructive",
    nouveau: "bg-info",
    inconnu: "bg-info/60",
    unknown: "bg-muted-foreground",
  };
  return <div className={`w-2 h-2 rounded-full ${colors[status] || colors.unknown}`} />;
}

export function EkkoAgent({
  campaignId, campaignName = "", viewers = [], dealScore,
  initialPrompt, onClose, density = "full",
}: EkkoAgentProps) {
  const { membership } = useAuthContext();
  const isPortfolio = !campaignId;
  const isCompact = density === "compact";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"agent" | "deal" | "committee">("agent");
  const [selectedViewer, setSelectedViewer] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initial greeting
  useEffect(() => {
    let content: string;
    if (isPortfolio) {
      content = "Vue portfolio.\n\nQue voulez-vous regarder en priorité ?";
    } else {
      const viewerCount = viewers.length || dealScore?.viewer_count || 0;
      const des = dealScore?.des ?? null;
      const daysSinceSignal = dealScore?.days_since_last_signal ?? null;
      const firstSignalAt = (dealScore as any)?.first_signal_at ?? null;

      if (viewerCount > 0 || firstSignalAt) {
        const parts: string[] = [];
        if (des !== null) parts.push(`DES ${des}`);
        if (daysSinceSignal !== null) parts.push(`${daysSinceSignal}j sans signal`);
        if (viewerCount > 0) parts.push(`${viewerCount} contact${viewerCount > 1 ? "s" : ""}`);
        const header = parts.join(" · ");
        content = header
          ? `${header}\n\nOù en êtes-vous dans le cycle ?`
          : "Où en êtes-vous dans le cycle ?";
      } else {
        content = "Aucun signal pour ce deal.\n\nEkko apprend dès que vous partagez un premier asset.\n\nPar quoi voulez-vous commencer ?";
      }
    }
    setMessages([{ role: "assistant", content }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  useEffect(() => {
    if (initialPrompt && messages.length === 1) {
      sendMessage(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    setMessages((prev) => [...prev, { role: "assistant", content: "", toolEvents: [], streaming: true }]);

    try {
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token
        ?? ((import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
      const apikey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

      const response = await fetch(`${supabaseUrl}/functions/v1/ekko-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          apikey,
        },
        body: JSON.stringify({
          campaign_id: campaignId,          // null in portfolio mode → handled by agent-converse
          messages: newMessages,
          user_id: membership?.user_id || null,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";

      const updateLast = (mut: (m: Message) => Message) => {
        setMessages((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === "assistant" && next[i].streaming) {
              next[i] = mut({ ...next[i] });
              break;
            }
          }
          return next;
        });
      };

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (!j || j === "[DONE]") continue;
          try {
            const evt = JSON.parse(j);
            if (evt.type === "delta" && typeof evt.content === "string") {
              acc += evt.content;
              updateLast((m) => ({ ...m, content: acc }));
            } else if (evt.type === "tool_call_start") {
              updateLast((m) => ({
                ...m,
                toolEvents: [...(m.toolEvents ?? []), { tool: evt.tool, status: "start" }],
              }));
            } else if (evt.type === "tool_call_end") {
              updateLast((m) => {
                const evts = [...(m.toolEvents ?? [])];
                for (let i = evts.length - 1; i >= 0; i--) {
                  if (evts[i].tool === evt.tool && evts[i].status === "start") {
                    evts[i] = { tool: evt.tool, status: evt.ok ? "ok" : "err" };
                    break;
                  }
                }
                return { ...m, toolEvents: evts };
              });
            } else if (evt.type === "error") {
              acc = acc || `Erreur agent: ${evt.message ?? "inconnue"}`;
              updateLast((m) => ({ ...m, content: acc }));
            }
          } catch {
            // ignore malformed line
          }
        }
      }

      updateLast((m) => ({ ...m, streaming: false }));
    } catch (e) {
      console.warn("Agent error:", e);
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "assistant" && next[i].streaming) {
            next[i] = { role: "assistant", content: "Erreur de connexion à l'agent. Réessayez.", streaming: false };
            return next;
          }
        }
        return [...next, { role: "assistant", content: "Erreur de connexion à l'agent. Réessayez." }];
      });
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const getMomentumBadge = (momentum: string) => {
    if (momentum === "rising")    return <Badge className="bg-accent/15 text-accent-foreground border-accent/30">↑ Rising</Badge>;
    if (momentum === "declining") return <Badge className="bg-destructive/15 text-destructive border-destructive/30">↓ Declining</Badge>;
    return <Badge className="bg-warning/15 text-warning-foreground border-warning/30">→ Stable</Badge>;
  };

  // Tabs only in single-deal + full density (compact + portfolio hide them).
  const showTabs = !isPortfolio && !isCompact;
  const showSidebar = !isPortfolio && !isCompact;

  const QUICK_PROMPTS = isPortfolio ? QUICK_PROMPTS_PORTFOLIO : QUICK_PROMPTS_DEAL;

  // Typography & padding scale based on density.
  const bubbleText  = isCompact ? "text-[13px]" : "text-sm";
  const bubblePad   = isCompact ? "px-3 py-2" : "px-3.5 py-2.5";
  const inputText   = isCompact ? "text-[13px]" : "text-sm";

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Ekko Agent</p>
            <p className="text-[10px] text-muted-foreground">
              {isPortfolio ? "Execution Amplifier · portfolio" : `Execution Amplifier · ${campaignName}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showTabs && (["agent", "deal", "committee"] as const).map((t) => (
            <Button
              key={t}
              variant={activeTab === t ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setActiveTab(t)}
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
        {/* Sidebar (single-deal, full density only) */}
        {showSidebar && (
          <div className="w-56 border-r overflow-y-auto flex-shrink-0 hidden lg:block">
            <div className="p-3 border-b">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Deal actif</p>
              <p className="text-sm font-semibold truncate">{campaignName}</p>
              <div className="flex gap-2 mt-3">
                <div className="flex-1 bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-accent-foreground">{dealScore?.des ?? "—"}</p>
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

            {dealScore?.alerts && Array.isArray(dealScore.alerts) && (dealScore.alerts as any[]).length > 0 && (
              <div className="p-3 border-b space-y-2">
                {(dealScore.alerts as any[]).slice(0, 3).map((a: any, i: number) => (
                  <div key={i} className={`text-[11px] p-2 rounded-md border ${
                    a.type === "danger" ? "bg-destructive/10 border-destructive/20 text-destructive" :
                    a.type === "warning" ? "bg-warning/10 border-warning/20 text-warning-foreground" :
                    "bg-info/10 border-info/20 text-info"
                  }`}>
                    {a.text}
                  </div>
                ))}
              </div>
            )}

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
        )}

        {/* Main content */}
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

              {/* Chat */}
              <div className={`flex-1 overflow-y-auto px-4 ${isCompact ? "py-3 space-y-3" : "py-4 space-y-4"}`}>
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    {m.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-xl ${bubblePad} ${bubbleText} leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm whitespace-pre-wrap"
                        : "bg-card border text-foreground rounded-bl-sm"
                    }`}>
                      {m.role === "assistant"
                        ? <div className="space-y-1.5">
                            {m.toolEvents && m.toolEvents.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1.5">
                                {m.toolEvents.map((te, k) => (
                                  <span
                                    key={k}
                                    className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] bg-background/60"
                                    title={te.tool}
                                  >
                                    <span className="font-mono">{te.tool}</span>
                                    <span aria-hidden>
                                      {te.status === "start" ? "…" : te.status === "ok" ? "✓" : "✗"}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}
                            {parseAgentMessage(m.content).map((part, j) =>
                              part.text.trim() === "" ? null : (
                                <div key={j} className="flex items-start gap-1.5">
                                  {part.badge && (
                                    <span
                                      className="inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium shrink-0 mt-1 border"
                                      style={{
                                        backgroundColor: BADGE_STYLE[part.badge].bg,
                                        color: BADGE_STYLE[part.badge].fg,
                                        borderColor: BADGE_STYLE[part.badge].border,
                                      }}
                                    >
                                      {BADGE_STYLE[part.badge].label}
                                    </span>
                                  )}
                                  <div className="prose prose-sm max-w-none prose-p:my-0 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-1 prose-strong:text-foreground prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-pre:bg-muted prose-pre:text-foreground">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      components={{
                                        a: ({ href, children }) => (
                                          <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="link-action"
                                          >
                                            {children}
                                          </a>
                                        ),
                                      }}
                                    >
                                      {part.text}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              )
                            )}
                            {m.streaming && m.content === "" && (m.toolEvents?.length ?? 0) === 0 && (
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <EkkoLoader mode="loop" size={12} /> Analyse…
                              </span>
                            )}
                          </div>
                        : m.content
                      }
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                    <div className="bg-card border rounded-xl px-4 py-3 flex items-center gap-1.5">
                      <EkkoLoader mode="loop" size={14} />
                      <span className="text-xs text-muted-foreground ml-1.5">Analyse en cours...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-2.5 border-t bg-background">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={isPortfolio ? "Pose une question sur ton portfolio…" : "Pose une question sur ce deal…"}
                    disabled={loading}
                    rows={isCompact ? 1 : 2}
                    className={`flex-1 bg-background border border-input rounded-lg px-3 py-2 ${inputText} resize-none outline-none focus:ring-2 focus:ring-ring focus:border-ring text-foreground placeholder:text-muted-foreground`}
                  />
                  <Button
                    size="icon"
                    className="h-10 w-10 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={() => sendMessage()}
                    disabled={loading || !input.trim()}
                    aria-label="Envoyer"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {activeTab === "deal" && !isPortfolio && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {dealScore && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "DES",         value: dealScore.des ?? "—",                                                  icon: Zap },
                    { label: "Breadth",     value: `${Math.round((dealScore.breadth ?? 0) * 100) / 100}%`,                  icon: Users },
                    { label: "Velocity",    value: dealScore.event_velocity ?? "—",                                        icon: TrendingUp },
                    { label: "Multi-thread", value: dealScore.multi_threading_score ?? "—",                                 icon: Shield },
                  ].map((s) => (
                    <div key={s.label} className="bg-muted/50 rounded-lg p-3 text-center">
                      <s.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-lg font-bold">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {dealScore?.cold_start_regime && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <Sparkles className="h-4 w-4 text-warning-foreground" />
                  <div>
                    <p className="text-xs font-medium text-warning-foreground">
                      Régime : {dealScore.cold_start_regime === "cold_global" ? "Cold Global" :
                        dealScore.cold_start_regime === "cold_account" ? "Cold Account" :
                        dealScore.cold_start_regime === "warm_account" ? "Warm Account" : "Mature"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
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

          {activeTab === "committee" && !isPortfolio && (
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
                        <p className={`text-xl font-bold ${selectedViewer.contact_score > 70 ? "text-accent-foreground" : selectedViewer.contact_score > 40 ? "text-warning-foreground" : "text-destructive"}`}>
                          {selectedViewer.contact_score}
                        </p>
                        <p className="text-[9px] text-muted-foreground">Contact</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: "Watch depth",   value: `${selectedViewer.total_watch_depth ?? 0}%` },
                      { label: "Partages",      value: selectedViewer.share_count ?? 0 },
                      { label: "Sponsor score", value: selectedViewer.sponsor_score ?? "N/A" },
                      { label: "Replays",       value: selectedViewer.replay_count ?? 0 },
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
