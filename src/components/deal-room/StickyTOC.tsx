import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { BLOCK_LABELS, BlockGroup } from "./types";

interface SectionItem {
  id: string;
  blockGroup: BlockGroup;
  title: string;
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (!ids.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  return active;
}

interface Props {
  sections: SectionItem[];
  viewedIds: Set<string>;
}

export function StickyTOC({ sections, viewedIds }: Props) {
  const ids = sections.map((s) => s.id);
  const active = useActiveSection(ids);
  const seenCount = sections.filter((s) => viewedIds.has(s.id)).length;
  const total = sections.length;
  const pct = total ? Math.round((seenCount / total) * 100) : 0;

  return (
    <aside className="sticky top-24 hidden w-[200px] shrink-0 lg:block">
      <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-foreground/40">
        Sommaire
      </p>
      <nav className="space-y-1">
        {sections.map((s, i) => {
          const on = active === s.id;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
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
                {String(i + 1).padStart(2, "0")} · {s.title || BLOCK_LABELS[s.blockGroup]}
              </span>
            </a>
          );
        })}
      </nav>
      <div className="mt-8 rounded-lg border border-foreground/8 bg-card p-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="text-foreground/55">Progression</span>
          <span className="font-medium tabular-nums text-foreground">
            {seenCount} / {total}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-foreground/8">
          <div className="h-full rounded-full bg-[hsl(var(--accent))]" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </aside>
  );
}

export function MobileTOC({ sections, viewedIds }: Props) {
  const [open, setOpen] = useState(false);
  const seen = sections.filter((s) => viewedIds.has(s.id)).length;
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
          <span className="text-[11px] tabular-nums text-foreground/55">
            {seen} / {sections.length}
          </span>
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
              <button onClick={() => setOpen(false)} aria-label="Fermer">
                <X className="h-4 w-4 text-foreground/55" />
              </button>
            </div>
            <nav className="space-y-1">
              {sections.map((s, i) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-md px-2 py-2.5 text-[14px] text-foreground/80 hover:bg-foreground/[0.04]"
                >
                  <span>
                    {String(i + 1).padStart(2, "0")} · {s.title || BLOCK_LABELS[s.blockGroup]}
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
