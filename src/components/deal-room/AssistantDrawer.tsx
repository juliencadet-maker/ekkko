import { useEffect, useState } from "react";
import { Sparkles, X, Send, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  campaignId: string;
  aeFirstName?: string | null;
  viewerHash: string | null;
  prospectEmail: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pulse?: boolean;
}

interface AIResp {
  mode: "summarize" | "qa" | "async";
  ui_label: string;
  disclosure: string;
  bullets?: string[];
  answer?: string;
  question_id?: string | null;
  error?: string;
}

const SUGGESTED = [
  "Quel ROI puis-je espérer ?",
  "Comment se passe le pilote ?",
  "Quelles intégrations sont disponibles ?",
];

export function AssistantDrawer({
  campaignId,
  aeFirstName,
  viewerHash,
  prospectEmail,
  open,
  onOpenChange,
  pulse,
}: Props) {
  const [bullets, setBullets] = useState<string[] | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [lastAskedQuestion, setLastAskedQuestion] = useState<string | null>(null);
  const [asyncSent, setAsyncSent] = useState(false);
  const [asyncLoading, setAsyncLoading] = useState(false);

  // Fetch summary on first open.
  useEffect(() => {
    if (!open || bullets || loadingSummary) return;
    setLoadingSummary(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke<AIResp>("prospect-room-ai", {
          body: { mode: "summarize", campaign_id: campaignId },
        });
        if (error) throw error;
        if (data?.error) {
          if (data.error === "RATE_LIMIT_SUMMARY_HOURLY") {
            setSummaryError("Synthèse déjà générée récemment. Réessayez dans une heure.");
          } else {
            setSummaryError("Synthèse indisponible.");
          }
        } else {
          setBullets(data?.bullets || []);
        }
      } catch {
        setSummaryError("Synthèse indisponible.");
      } finally {
        setLoadingSummary(false);
      }
    })();
  }, [open, bullets, loadingSummary, campaignId]);

  const askQuestion = async (q: string) => {
    if (!q.trim()) return;
    setAskLoading(true);
    setAskError(null);
    setAnswer(null);
    setAsyncSent(false);
    setLastAskedQuestion(q);
    try {
      const { data, error } = await supabase.functions.invoke<AIResp>("prospect-room-ai", {
        body: {
          mode: "qa",
          campaign_id: campaignId,
          question: q,
          viewer_hash: viewerHash,
          prospect_email: prospectEmail,
        },
      });
      if (error) throw error;
      if (data?.error === "RATE_LIMIT_QA_24H") {
        setAskError("Limite quotidienne atteinte (5 questions / 24 h).");
      } else if (data?.error) {
        setAskError("Réponse indisponible pour le moment.");
      } else {
        setAnswer(data?.answer || "");
        setQuestion("");
      }
    } catch {
      setAskError("Réponse indisponible.");
    } finally {
      setAskLoading(false);
    }
  };

  // GC-46 — Async reply : transmettre la question à l'AE pour réponse manuelle.
  const sendAsync = async () => {
    const q = (lastAskedQuestion || question).trim();
    if (!q) return;
    setAsyncLoading(true);
    setAskError(null);
    try {
      const { data, error } = await supabase.functions.invoke<AIResp>("prospect-room-ai", {
        body: {
          mode: "async",
          campaign_id: campaignId,
          question: q,
          viewer_hash: viewerHash,
          prospect_email: prospectEmail,
        },
      });
      if (error) throw error;
      if (data?.error === "RATE_LIMIT_ASYNC_24H") {
        setAskError("Limite atteinte (3 demandes / 24 h).");
      } else if (data?.error) {
        setAskError("Envoi impossible pour le moment.");
      } else {
        setAsyncSent(true);
        setQuestion("");
      }
    } catch {
      setAskError("Envoi impossible.");
    } finally {
      setAsyncLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <div className="fixed bottom-20 right-4 z-30 lg:bottom-6 lg:right-6">
          {pulse && (
            <div className="absolute -top-12 right-0 hidden whitespace-nowrap rounded-lg border border-foreground/10 bg-background px-3 py-2 text-[12px] text-foreground/75 shadow-md sm:block">
              Une question ? Je suis là.
              <span className="absolute -bottom-1 right-5 h-2 w-2 rotate-45 border-b border-r border-foreground/10 bg-background" />
            </div>
          )}
          <button
            onClick={() => onOpenChange(true)}
            className="group flex h-12 items-center gap-2 rounded-full bg-foreground px-4 text-background shadow-[0_8px_24px_-6px_rgba(13,27,42,0.4)] transition-all hover:scale-[1.03]"
          >
            <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" />
            <span className="text-[13px] font-medium">Synthèse rapide</span>
          </button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-foreground/30 backdrop-blur-sm sm:items-stretch">
          <div className="absolute inset-0" onClick={() => onOpenChange(false)} />
          <div className="relative flex h-[85vh] w-full flex-col rounded-t-2xl bg-background shadow-2xl sm:h-full sm:w-[440px] sm:rounded-l-2xl sm:rounded-tr-none">
            <div className="flex items-center justify-between border-b border-foreground/8 px-5 py-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-foreground/45">
                  Assistant de la page
                </p>
                <p className="text-[15px] font-semibold tracking-tight text-foreground">
                  Synthèse rapide
                </p>
              </div>
              <button onClick={() => onOpenChange(false)} aria-label="Fermer">
                <X className="h-4 w-4 text-foreground/55" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="rounded-xl border border-foreground/8 bg-card p-4">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-foreground/45">
                  En quelques points
                </p>
                {loadingSummary && (
                  <div className="flex items-center gap-2 text-[13px] text-foreground/55">
                    <Loader2 className="h-4 w-4 animate-spin" /> Préparation…
                  </div>
                )}
                {summaryError && <p className="text-[13px] text-foreground/55">{summaryError}</p>}
                {bullets && bullets.length > 0 && (
                  <ul className="space-y-2 text-[14px] leading-relaxed text-foreground/80">
                    {bullets.map((b, i) => (
                      <li key={i}>· {b}</li>
                    ))}
                  </ul>
                )}
                {bullets && bullets.length === 0 && !summaryError && (
                  <p className="text-[13px] text-foreground/55">
                    Pas assez de contenu pour une synthèse.
                  </p>
                )}
              </div>

              {answer && (
                <div className="rounded-xl border border-foreground/8 bg-card p-4">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-foreground/45">
                    Réponse
                  </p>
                  <p className="whitespace-pre-line text-[14px] leading-relaxed text-foreground/80">
                    {answer}
                  </p>
                </div>
              )}

              {!answer && !askLoading && (
                <div className="space-y-2">
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      onClick={() => askQuestion(q)}
                      className="flex w-full items-center justify-between rounded-lg border border-foreground/8 bg-card px-3 py-2.5 text-left text-[13px] text-foreground/75 hover:border-foreground/15 hover:text-foreground"
                    >
                      {q}
                      <ChevronRight className="h-3.5 w-3.5 text-foreground/40" />
                    </button>
                  ))}
                </div>
              )}

              {askError && <p className="text-[13px] text-destructive">{askError}</p>}

              <p className="px-1 text-[11px] leading-relaxed text-foreground/45">
                Réponse générée à partir des contenus de cette page. Vos questions restent visibles
                uniquement par {aeFirstName || "votre interlocuteur"}.
              </p>
            </div>

            <div className="border-t border-foreground/8 p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  askQuestion(question);
                }}
                className="flex items-center gap-2 rounded-full border border-foreground/10 bg-card px-3 py-2"
              >
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Votre question…"
                  className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-foreground/40 focus:outline-none"
                  disabled={askLoading}
                  maxLength={1000}
                />
                <button
                  type="submit"
                  disabled={!question.trim() || askLoading}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"
                  aria-label="Envoyer"
                >
                  {askLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
