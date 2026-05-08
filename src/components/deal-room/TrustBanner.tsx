import { ShieldCheck } from "lucide-react";

interface Props {
  aeName?: string | null;
}

export function TrustBanner({ aeName }: Props) {
  return (
    <footer className="border-t border-foreground/5 bg-card">
      <div className="mx-auto max-w-[1100px] px-6 py-10">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-[12.5px] text-foreground/55">
            <ShieldCheck className="h-4 w-4 shrink-0 text-foreground/45" />
            <p>
              Espace privé · lien expirable · vos questions visibles seulement par{" "}
              <span className="font-medium text-foreground/75">{aeName || "votre interlocuteur"}</span>
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
