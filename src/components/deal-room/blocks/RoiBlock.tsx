import { BlockProps } from "../types";

/**
 * ROI Block — assets[] entries can carry pre-computed ROI lines via block_description (key:value pairs)
 * or simply attached docs/images. Phase 1d.5j enrichment: structured ROI inputs.
 */
export function RoiBlock({ assets }: BlockProps) {
  const headline = assets.find((a) => a.block_title?.toLowerCase().includes("impact"))?.block_title;
  const headlineDesc = assets.find((a) => a.block_title?.toLowerCase().includes("impact"))?.block_description;
  const rows = assets.filter((a) => !a.block_title?.toLowerCase().includes("impact"));

  return (
    <div className="grid gap-6 sm:grid-cols-[1.1fr_1fr]">
      <div className="rounded-xl border border-foreground/8 bg-card p-6">
        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-foreground/45">
          Hypothèses
        </p>
        {rows.length ? (
          <dl className="divide-y divide-foreground/8">
            {rows.map((r) => (
              <div key={r.id} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-[13px] text-foreground/65">{r.block_title || "—"}</dt>
                <dd className="text-[14px] font-medium tabular-nums text-foreground">
                  {r.block_description || ""}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-[13px] text-foreground/55">À compléter avec votre interlocuteur.</p>
        )}
      </div>
      <div className="flex flex-col justify-center rounded-xl border border-foreground/8 bg-foreground p-8 text-background">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] opacity-60">
          Impact projeté
        </p>
        <p className="font-[Instrument_Serif] text-[44px] leading-none tracking-tight sm:text-[56px]">
          {headline || "—"}
        </p>
        {headlineDesc && (
          <p className="mt-3 text-[13px] leading-relaxed opacity-70">{headlineDesc}</p>
        )}
      </div>
    </div>
  );
}
