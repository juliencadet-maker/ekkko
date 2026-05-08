import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  CheckCheck,
  Sparkles,
  ThumbsUp,
  Zap,
  HelpCircle,
  FileText,
  ShieldCheck,
  Lock,
  Clock,
  ChevronRight,
  X,
  Send,
  Eye,
  ArrowDown,
} from "lucide-react";

/**
 * Design preview — Deal Room V1.5 (north star)
 * Route: /design/deal-room
 * Mock data only. Pas de câblage. Pure UI.
 *
 * Critère D71 : "Est-ce que je l'enverrais sans honte à un VP de SAP ?"
 * Refs : Linear, Vercel, Stripe Atlas, Pitch, Notion partagées.
 */

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const DEAL = {
  prospect_first_name: "Claire",
  company: "TotalEnergies",
  company_logo_letter: "T",
  ae_first_name: "Julien",
  ae_last_name: "Moreau",
  ae_role: "Account Executive",
  ae_company: "Ekko",
  intro_message:
    "Claire, j'ai préparé cet espace pour vous et votre équipe. Tout y est — la démo, le pricing, le ROI. Prenez le temps qu'il vous faut, je reste joignable.",
  expires_in: "expire dans 12 jours",
};

type Block = {
  id: string;
  kind: "video" | "deck" | "pricing" | "roi" | "social_proof" | "docs";
  eyebrow: string;
  title: string;
  subtitle?: string;
  duration?: string;
  viewed?: boolean;
  viewed_at?: string;
};

const BLOCKS: Block[] = [
  {
    id: "intro",
    kind: "video",
    eyebrow: "01 — Introduction",
    title: "Pourquoi nous parlons aujourd'hui",
    subtitle: "Message personnel — 2 min 14",
    duration: "2:14",
    viewed: true,
    viewed_at: "vu mardi 14:32",
  },
  {
    id: "deck",
    kind: "deck",
    eyebrow: "02 — Présentation",
    title: "Ekko en 8 slides",
    subtitle: "Plateforme Deal Intelligence pour équipes Enterprise",
    viewed: true,
    viewed_at: "vu mardi 14:41",
  },
  {
    id: "pricing",
    kind: "pricing",
    eyebrow: "03 — Tarification",
    title: "Trois plans, une logique simple",
    subtitle: "Adapté à votre périmètre EMEA — 47 AEs",
  },
  {
    id: "roi",
    kind: "roi",
    eyebrow: "04 — Retour sur investissement",
    title: "Calcul ROI — votre contexte",
    subtitle: "Hypothèses TotalEnergies, ajustables",
  },
  {
    id: "trust",
    kind: "social_proof",
    eyebrow: "05 — Ils nous font confiance",
    title: "Schneider, Engie, BNP Paribas",
  },
  {
    id: "docs",
    kind: "docs",
    eyebrow: "06 — Documents techniques",
    title: "Sécurité, RGPD, intégrations",
    subtitle: "ISO 27001 · SOC 2 · Hébergement EU",
  },
];

// ---------------------------------------------------------------------------
// Small UI atoms
// ---------------------------------------------------------------------------

function Reactions({ blockId }: { blockId: string }) {
  const [active, setActive] = useState<string | null>(null);
  const opts: { key: string; emoji: string; label: string }[] = [
    { key: "up", emoji: "👍", label: "Pertinent" },
    { key: "think", emoji: "🤔", label: "À discuter" },
    { key: "spark", emoji: "⚡", label: "Wow" },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {opts.map((o) => {
        const on = active === o.key;
        return (
          <button
            key={o.key}
            onClick={() => setActive(on ? null : o.key)}
            className={[
              "group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all",
              on
                ? "border-foreground/20 bg-foreground/[0.04] text-foreground"
                : "border-foreground/10 bg-transparent text-foreground/55 hover:border-foreground/20 hover:bg-foreground/[0.03] hover:text-foreground/80",
            ].join(" ")}
            aria-label={o.label}
          >
            <span className="text-[13px] leading-none">{o.emoji}</span>
            <span className="hidden text-[11px] font-medium tracking-tight sm:inline">
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ReadReceipt({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/45">
      <CheckCheck className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-foreground/5 bg-card">
      {/* subtle radial */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          background:
            "radial-gradient(1200px 600px at 80% -10%, hsl(var(--accent) / 0.10), transparent 60%), radial-gradient(800px 400px at 0% 100%, hsl(var(--primary) / 0.06), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-[1100px] px-6 pt-16 pb-14 sm:pt-24 sm:pb-20">
        {/* logos row */}
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-[15px] font-semibold text-background">
            {DEAL.company_logo_letter}
          </div>
          <div className="h-5 w-px bg-foreground/15" />
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[hsl(var(--accent))] text-[12px] font-bold text-foreground">
              e
            </div>
            <span className="text-[13px] font-medium tracking-tight text-foreground/65">
              Ekko
            </span>
          </div>
        </div>

        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-foreground/50">
          Espace préparé pour {DEAL.company}
        </p>

        <h1
          className="mb-5 max-w-[820px] font-[Instrument_Serif] text-[44px] font-normal leading-[1.05] tracking-tight text-foreground sm:text-[64px]"
          style={{ fontFeatureSettings: '"ss01"' }}
        >
          Bonjour {DEAL.prospect_first_name},<br />
          <span className="italic text-foreground/70">tout est là.</span>
        </h1>

        <p className="mb-10 max-w-[600px] text-[15px] leading-[1.65] text-foreground/65 sm:text-[17px]">
          {DEAL.intro_message}
        </p>

        {/* video preview */}
        <div className="group relative mb-8 overflow-hidden rounded-2xl border border-foreground/8 bg-foreground shadow-[0_12px_40px_-12px_rgba(13,27,42,0.25)]">
          <div className="relative aspect-[16/9] w-full">
            {/* fake gradient frame */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, hsl(210 48% 14%) 0%, hsl(210 35% 22%) 60%, hsl(153 30% 30%) 100%)",
              }}
            />
            <div
              aria-hidden
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 40%, rgba(255,255,255,0.18), transparent 40%)",
              }}
            />
            <button className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-[1.01]">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-background/95 shadow-xl ring-1 ring-foreground/5 backdrop-blur transition-all group-hover:scale-110">
                <Play className="h-6 w-6 translate-x-[1px] fill-foreground text-foreground" />
              </span>
            </button>
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between text-background">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] opacity-70">
                  {DEAL.ae_first_name} {DEAL.ae_last_name} · {DEAL.ae_role}
                </p>
                <p className="text-[15px] font-medium opacity-95">
                  Pourquoi nous parlons aujourd'hui
                </p>
              </div>
              <span className="rounded-md bg-background/15 px-2 py-1 text-[11px] font-medium tabular-nums backdrop-blur">
                2:14
              </span>
            </div>
          </div>
        </div>

        {/* meta strip */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[12px] text-foreground/55">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Espace privé
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> {DEAL.expires_in}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" /> 3 / 6 sections vues
          </span>
        </div>

        <button className="mt-10 inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground/55 transition-colors hover:text-foreground">
          Faire défiler <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Block renderer
// ---------------------------------------------------------------------------

function BlockShell({
  block,
  children,
}: {
  block: Block;
  children: React.ReactNode;
}) {
  return (
    <section
      id={block.id}
      className="scroll-mt-24 border-b border-foreground/5 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-[1100px] px-6">
        <div className="mb-7 flex items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/45">
              {block.eyebrow}
            </p>
            <h2 className="font-[Instrument_Serif] text-[32px] leading-[1.1] tracking-tight text-foreground sm:text-[40px]">
              {block.title}
            </h2>
            {block.subtitle && (
              <p className="mt-2 text-[14px] leading-relaxed text-foreground/55 sm:text-[15px]">
                {block.subtitle}
              </p>
            )}
          </div>
          {block.viewed && (
            <div className="hidden shrink-0 sm:block">
              <ReadReceipt label={block.viewed_at!} />
            </div>
          )}
        </div>

        {children}

        <div className="mt-6 flex items-center justify-between">
          <Reactions blockId={block.id} />
          {block.viewed && (
            <div className="sm:hidden">
              <ReadReceipt label={block.viewed_at!} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function VideoBlock({ block }: { block: Block }) {
  return (
    <div className="overflow-hidden rounded-xl border border-foreground/8 bg-foreground shadow-[0_8px_30px_-12px_rgba(13,27,42,0.2)]">
      <div className="relative aspect-[16/9]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, hsl(210 48% 16%), hsl(210 30% 28%))",
          }}
        />
        <button className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background/95 shadow-lg">
            <Play className="h-5 w-5 translate-x-[1px] fill-foreground text-foreground" />
          </span>
        </button>
        <span className="absolute bottom-3 right-3 rounded bg-background/20 px-2 py-0.5 text-[11px] font-medium text-background backdrop-blur">
          {block.duration}
        </span>
      </div>
    </div>
  );
}

function DeckBlock() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="group aspect-[4/3] overflow-hidden rounded-lg border border-foreground/8 bg-card transition-all hover:border-foreground/15 hover:shadow-md"
        >
          <div className="flex h-full flex-col p-3">
            <div className="mb-2 h-1 w-6 rounded-full bg-foreground/15" />
            <div className="space-y-1.5">
              <div className="h-1.5 w-3/4 rounded-full bg-foreground/12" />
              <div className="h-1.5 w-1/2 rounded-full bg-foreground/8" />
            </div>
            <div className="mt-auto flex items-end justify-between">
              <div className="h-8 w-8 rounded-md bg-foreground/8" />
              <span className="text-[10px] tabular-nums text-foreground/35">
                {String(i + 1).padStart(2, "0")} / 08
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PricingBlock() {
  const plans = [
    { name: "Starter", price: "12", desc: "5 AEs · pilote 30 jours", popular: false },
    { name: "Growth", price: "39", desc: "20 AEs · multi-équipes", popular: true },
    { name: "Enterprise", price: "Sur mesure", desc: "47 AEs EMEA · SSO", popular: false },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {plans.map((p) => (
        <div
          key={p.name}
          className={[
            "rounded-xl border bg-card p-6 transition-all",
            p.popular
              ? "border-foreground/20 shadow-[0_8px_24px_-12px_rgba(13,27,42,0.18)]"
              : "border-foreground/8 hover:border-foreground/15",
          ].join(" ")}
        >
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
              {p.name}
            </h3>
            {p.popular && (
              <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">
                Recommandé
              </span>
            )}
          </div>
          <p className="mb-5 text-[12px] text-foreground/55">{p.desc}</p>
          <div className="mb-5 flex items-baseline gap-1">
            {p.price === "Sur mesure" ? (
              <span className="font-[Instrument_Serif] text-[28px] leading-none text-foreground">
                Sur mesure
              </span>
            ) : (
              <>
                <span className="font-[Instrument_Serif] text-[44px] leading-none tracking-tight text-foreground">
                  {p.price}
                </span>
                <span className="text-[13px] text-foreground/55">€/AE/mois</span>
              </>
            )}
          </div>
          <ul className="space-y-1.5 text-[13px] text-foreground/65">
            <li>· Deal Intelligence complet</li>
            <li>· Read receipts & heatmaps</li>
            <li>· Intégrations CRM</li>
          </ul>
        </div>
      ))}
    </div>
  );
}

function RoiBlock() {
  const rows = [
    { k: "AEs équipés", v: "47" },
    { k: "Deals annuels par AE", v: "32" },
    { k: "Win-rate actuel", v: "21 %" },
    { k: "Win-rate projeté Ekko", v: "28 %", up: true },
    { k: "Deal value moyen", v: "84 k€" },
  ];
  return (
    <div className="grid gap-6 sm:grid-cols-[1.1fr_1fr]">
      <div className="rounded-xl border border-foreground/8 bg-card p-6">
        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-foreground/45">
          Hypothèses
        </p>
        <dl className="divide-y divide-foreground/8">
          {rows.map((r) => (
            <div key={r.k} className="flex items-baseline justify-between py-2.5">
              <dt className="text-[13px] text-foreground/65">{r.k}</dt>
              <dd
                className={[
                  "text-[14px] font-medium tabular-nums",
                  r.up ? "text-[hsl(var(--success))]" : "text-foreground",
                ].join(" ")}
              >
                {r.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-col justify-center rounded-xl border border-foreground/8 bg-foreground p-8 text-background">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] opacity-60">
          Impact 12 mois
        </p>
        <p className="font-[Instrument_Serif] text-[56px] leading-none tracking-tight">
          + 8,4 M€
        </p>
        <p className="mt-3 text-[13px] leading-relaxed opacity-70">
          Revenu additionnel sur la base des hypothèses ci-contre. Modèle ajustable
          en session, transparence des formules.
        </p>
      </div>
    </div>
  );
}

function SocialProofBlock() {
  const logos = ["Schneider", "Engie", "BNP", "Axa", "Orange", "L'Oréal"];
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {logos.map((l) => (
        <div
          key={l}
          className="flex h-16 items-center justify-center rounded-lg border border-foreground/8 bg-card text-[13px] font-semibold tracking-tight text-foreground/55"
        >
          {l}
        </div>
      ))}
    </div>
  );
}

function DocsBlock() {
  const docs = [
    { name: "ISO 27001 — Certificat", size: "PDF · 1,2 Mo", viewed: true },
    { name: "Architecture sécurité", size: "PDF · 3,4 Mo", viewed: false },
    { name: "DPA RGPD", size: "PDF · 0,8 Mo", viewed: false },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-foreground/8 bg-card">
      {docs.map((d, i) => (
        <button
          key={d.name}
          className={[
            "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-foreground/[0.03]",
            i > 0 && "border-t border-foreground/8",
          ].join(" ")}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/[0.05]">
            <FileText className="h-4.5 w-4.5 text-foreground/60" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-foreground">{d.name}</p>
            <p className="text-[12px] text-foreground/50">{d.size}</p>
          </div>
          {d.viewed && <ReadReceipt label="vu" />}
          <ChevronRight className="h-4 w-4 text-foreground/35" />
        </button>
      ))}
    </div>
  );
}

function renderBlock(b: Block) {
  switch (b.kind) {
    case "video":
      return <VideoBlock block={b} />;
    case "deck":
      return <DeckBlock />;
    case "pricing":
      return <PricingBlock />;
    case "roi":
      return <RoiBlock />;
    case "social_proof":
      return <SocialProofBlock />;
    case "docs":
      return <DocsBlock />;
  }
}

// ---------------------------------------------------------------------------
// Sticky TOC (desktop) + bottom sheet (mobile)
// ---------------------------------------------------------------------------

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

function DesktopTOC() {
  const ids = useMemo(() => BLOCKS.map((b) => b.id), []);
  const active = useActiveSection(ids);
  return (
    <aside className="sticky top-24 hidden w-[200px] shrink-0 lg:block">
      <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-foreground/40">
        Sommaire
      </p>
      <nav className="space-y-1">
        {BLOCKS.map((b, i) => {
          const on = active === b.id;
          return (
            <a
              key={b.id}
              href={`#${b.id}`}
              className={[
                "group flex items-center gap-3 rounded-md py-1.5 pl-2 pr-3 text-[12.5px] transition-all",
                on
                  ? "bg-foreground/[0.04] text-foreground"
                  : "text-foreground/45 hover:text-foreground/80",
              ].join(" ")}
            >
              <span
                className={[
                  "h-1 w-1 shrink-0 rounded-full transition-all",
                  on ? "scale-150 bg-[hsl(var(--accent))]" : "bg-foreground/20",
                ].join(" ")}
              />
              <span className="truncate">
                {String(i + 1).padStart(2, "0")} · {b.title}
              </span>
            </a>
          );
        })}
      </nav>
      <div className="mt-8 rounded-lg border border-foreground/8 bg-card p-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="text-foreground/55">Progression</span>
          <span className="font-medium tabular-nums text-foreground">3 / 6</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-foreground/8">
          <div
            className="h-full rounded-full bg-[hsl(var(--accent))]"
            style={{ width: "50%" }}
          />
        </div>
      </div>
    </aside>
  );
}

function MobileTOC() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="fixed inset-x-3 bottom-3 z-30 lg:hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-full border border-foreground/10 bg-background/95 px-4 py-3 text-[13px] shadow-lg backdrop-blur"
        >
          <span className="flex items-center gap-2 font-medium text-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-[10px] font-bold text-foreground">
              ▾
            </span>
            Sommaire
          </span>
          <span className="text-[11px] tabular-nums text-foreground/55">3 / 6</span>
        </button>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-background p-5 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[14px] font-semibold">Sommaire</p>
              <button onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-foreground/55" />
              </button>
            </div>
            <nav className="space-y-1">
              {BLOCKS.map((b, i) => (
                <a
                  key={b.id}
                  href={`#${b.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-md px-2 py-2.5 text-[14px] text-foreground/80 hover:bg-foreground/[0.04]"
                >
                  <span>
                    {String(i + 1).padStart(2, "0")} · {b.title}
                  </span>
                  <ChevronRight className="h-4 w-4 text-foreground/35" />
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Floating "Une question ?" + Assistant drawer
// ---------------------------------------------------------------------------

function AssistantFAB() {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <div className="fixed bottom-20 right-4 z-30 lg:bottom-6 lg:right-6">
        {pulse && !open && (
          <div className="absolute -top-12 right-0 hidden animate-[fade-in_300ms_ease-out] whitespace-nowrap rounded-lg border border-foreground/10 bg-background px-3 py-2 text-[12px] text-foreground/75 shadow-md sm:block">
            Une question ? Je suis là.
            <span className="absolute -bottom-1 right-5 h-2 w-2 rotate-45 border-b border-r border-foreground/10 bg-background" />
          </div>
        )}
        <button
          onClick={() => setOpen(true)}
          className="group flex h-12 items-center gap-2 rounded-full bg-foreground px-4 text-background shadow-[0_8px_24px_-6px_rgba(13,27,42,0.4)] transition-all hover:scale-[1.03]"
        >
          <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" />
          <span className="text-[13px] font-medium">Synthèse rapide</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-foreground/30 backdrop-blur-sm sm:items-stretch">
          <div
            className="absolute inset-0"
            onClick={() => setOpen(false)}
          />
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
              <button onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-foreground/55" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="rounded-xl border border-foreground/8 bg-card p-4">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-foreground/45">
                  En 3 points
                </p>
                <ul className="space-y-2 text-[14px] leading-relaxed text-foreground/80">
                  <li>· Plateforme Deal Intelligence pour équipes Enterprise.</li>
                  <li>· ROI projeté +8,4 M€ sur 12 mois pour 47 AEs.</li>
                  <li>· Sécurité ISO 27001, hébergement EU, DPA RGPD.</li>
                </ul>
              </div>
              <div className="space-y-2">
                {["Quel ROI sur 6 mois ?", "Comment fonctionne le pilote ?", "Quelles intégrations CRM ?"].map((q) => (
                  <button
                    key={q}
                    className="flex w-full items-center justify-between rounded-lg border border-foreground/8 bg-card px-3 py-2.5 text-left text-[13px] text-foreground/75 hover:border-foreground/15 hover:text-foreground"
                  >
                    {q}
                    <ChevronRight className="h-3.5 w-3.5 text-foreground/40" />
                  </button>
                ))}
              </div>
              <p className="px-1 text-[11px] leading-relaxed text-foreground/45">
                Réponse générée à partir des contenus de cette page. Vos questions
                restent visibles uniquement par {DEAL.ae_first_name}.
              </p>
            </div>
            <div className="border-t border-foreground/8 p-3">
              <div className="flex items-center gap-2 rounded-full border border-foreground/10 bg-card px-3 py-2">
                <input
                  placeholder="Votre question…"
                  className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-foreground/40 focus:outline-none"
                />
                <button className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Trust banner
// ---------------------------------------------------------------------------

function TrustBanner() {
  return (
    <footer className="border-t border-foreground/5 bg-card">
      <div className="mx-auto max-w-[1100px] px-6 py-10">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-[12.5px] text-foreground/55">
            <ShieldCheck className="h-4 w-4 shrink-0 text-foreground/45" />
            <p>
              Espace privé · lien expirable · vos questions visibles seulement par{" "}
              <span className="font-medium text-foreground/75">
                {DEAL.ae_first_name} {DEAL.ae_last_name}
              </span>
              .
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-foreground/40">
            <span>ISO 27001</span>
            <span>·</span>
            <span>Hébergement EU</span>
            <span>·</span>
            <span>RGPD</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DealRoomMock() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* top thin bar */}
      <div className="sticky top-0 z-20 border-b border-foreground/5 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1100px] items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[hsl(var(--accent))] text-[10px] font-bold text-foreground">
              e
            </div>
            <span className="text-[12px] font-medium tracking-tight text-foreground/65">
              Ekko · Espace {DEAL.company}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-foreground/45">
            <span className="hidden sm:inline">Aperçu design — données fictives</span>
            <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 font-medium text-foreground/55">
              v1.5
            </span>
          </div>
        </div>
      </div>

      <Hero />

      <div className="mx-auto flex max-w-[1100px] gap-12 px-6 py-4">
        <DesktopTOC />
        <main className="min-w-0 flex-1">
          {BLOCKS.map((b) => (
            <BlockShell key={b.id} block={b}>
              {renderBlock(b)}
            </BlockShell>
          ))}
        </main>
      </div>

      <TrustBanner />

      <MobileTOC />
      <AssistantFAB />

      {/* spacing for mobile bottom sheet */}
      <div className="h-20 lg:hidden" />
    </div>
  );
}
