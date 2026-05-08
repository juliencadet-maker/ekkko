import { BlockProps } from "../types";

/**
 * Pricing block — each asset = a plan.
 * block_title = plan name, block_description = description, file_url ignored,
 * label_fr could carry "Recommandé" tag.
 */
export function PricingBlock({ assets }: BlockProps) {
  if (!assets.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {assets.map((a) => {
        const popular = (a.label_fr || "").toLowerCase().includes("recommand");
        return (
          <div
            key={a.id}
            className={[
              "rounded-xl border bg-card p-6 transition-all",
              popular
                ? "border-foreground/20 shadow-[0_8px_24px_-12px_rgba(13,27,42,0.18)]"
                : "border-foreground/8 hover:border-foreground/15",
            ].join(" ")}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
                {a.block_title || "Plan"}
              </h3>
              {popular && (
                <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">
                  Recommandé
                </span>
              )}
            </div>
            {a.block_description && (
              <p className="mt-3 text-[13px] leading-relaxed text-foreground/65">
                {a.block_description}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
