import { CheckCheck } from "lucide-react";
import { ReactNode } from "react";
import { Reactions } from "./Reactions";
import { BLOCK_LABELS, BlockGroup } from "./types";

interface Props {
  id: string;
  blockGroup: BlockGroup;
  index: number;
  total: number;
  title: string;
  subtitle?: string | null;
  viewedAt?: string | null;
  campaignId: string;
  orgId?: string | null;
  viewerHash: string | null;
  prospectEmail: string | null;
  children: ReactNode;
}

function ReadReceipt({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/45">
      <CheckCheck className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
      {label}
    </span>
  );
}

export function BlockShell({
  id,
  blockGroup,
  index,
  total,
  title,
  subtitle,
  viewedAt,
  campaignId,
  orgId,
  viewerHash,
  prospectEmail,
  children,
}: Props) {
  const eyebrow = `${String(index + 1).padStart(2, "0")} — ${BLOCK_LABELS[blockGroup]}`;
  return (
    <section
      id={id}
      data-block-group={blockGroup}
      className="scroll-mt-24 border-b border-foreground/5 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-[1100px] px-6">
        <div className="mb-7 flex items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/45">
              {eyebrow}
            </p>
            <h2 className="font-[Instrument_Serif] text-[32px] leading-[1.1] tracking-tight text-foreground sm:text-[40px]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-2 text-[14px] leading-relaxed text-foreground/55 sm:text-[15px]">
                {subtitle}
              </p>
            )}
          </div>
          {viewedAt && (
            <div className="hidden shrink-0 sm:block">
              <ReadReceipt label={viewedAt} />
            </div>
          )}
        </div>

        {children}

        <div className="mt-6 flex items-center justify-between">
          <Reactions
            campaignId={campaignId}
            orgId={orgId}
            blockGroup={blockGroup}
            viewerHash={viewerHash}
            prospectEmail={prospectEmail}
          />
          {viewedAt && (
            <div className="sm:hidden">
              <ReadReceipt label={viewedAt} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
