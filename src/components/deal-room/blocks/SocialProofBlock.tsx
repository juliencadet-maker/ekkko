import { BlockProps } from "../types";

export function SocialProofBlock({ assets }: BlockProps) {
  // Each asset's block_title = logo label or alt text. file_url = logo image (optional).
  const items = assets.length
    ? assets.map((a) => ({ id: a.id, label: a.block_title || "Référence", url: a.file_url }))
    : [];

  if (!items.length) return null;

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {items.map((it) => (
        <div
          key={it.id}
          className="flex h-16 items-center justify-center overflow-hidden rounded-lg border border-foreground/8 bg-card text-[13px] font-semibold tracking-tight text-foreground/55"
        >
          {it.url ? (
            <img src={it.url} alt={it.label} className="max-h-10 max-w-[80%] object-contain opacity-80" />
          ) : (
            <span>{it.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}
