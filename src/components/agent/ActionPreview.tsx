// Phase 4-fix v2 — Rich previews for the 7 pending action types.
// Honest rendering of the payload without paraphrasing the side-effect.
// Brand: Marine #0D1B2A, Vert #1AE08A, Rouge #E24B4A, Ivoire #F7F6F3.
import type { PendingAction } from "@/hooks/useAgentNotifications";
import { Badge } from "@/components/ui/badge";
import { V15RoomPreview } from "@/components/deal-room/V15RoomPreview";

const MARINE = "#0D1B2A";
const IVOIRE = "#F7F6F3";
const RED = "#E24B4A";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 ${className}`}
      style={{ color: MARINE, fontFamily: "DM Sans, system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right max-w-[60%] break-words" style={{ color: MARINE }}>
        {v}
      </span>
    </div>
  );
}

// 1 — Publish deal room: real V15RoomPreview embed.
export function PublishDealRoomPreview({ p }: { p: PendingAction }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Aperçu du deal room (lecture seule)
      </p>
      <div
        className="border rounded-lg overflow-hidden"
        style={{ background: IVOIRE }}
      >
        <V15RoomPreview campaignId={p.campaign_id} className="h-[320px] overflow-y-auto" />
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        {p.payload?.layout_mode && <Badge variant="outline">Mode: {p.payload.layout_mode}</Badge>}
        {p.payload?.version_label && <Badge variant="outline">Version: {p.payload.version_label}</Badge>}
      </div>
    </div>
  );
}

// 2 — Voice source: native audio + before/after.
export function VoiceSourcePreview({ p }: { p: PendingAction }) {
  const sample = p.payload?.voice_sample_url as string | undefined;
  const current = p.payload?.current_voice_source ?? "—";
  const next = p.payload?.new_voice_source ?? "—";
  return (
    <Card>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        Échantillon vocal
      </p>
      {sample ? (
        <audio controls src={sample} className="w-full" />
      ) : (
        <p className="text-xs text-muted-foreground italic">Aucun échantillon fourni.</p>
      )}
      <p className="text-xs mt-3">
        Voix actuelle : <strong>{current}</strong> / Nouvelle voix : <strong>{next}</strong>
      </p>
    </Card>
  );
}

// 3 — External message: From/To/Subject + body.
export function MessagePreview({ p }: { p: PendingAction }) {
  const from = p.payload?.from ?? p.payload?.sender ?? "—";
  const to = p.payload?.to ?? p.payload?.recipient ?? "—";
  const subject = p.payload?.subject ?? "—";
  const body = p.payload?.body ?? p.payload?.preview ?? p.payload?.body_preview ?? "";
  return (
    <Card>
      <div className="border-b pb-2 space-y-1">
        <KV k="From" v={from} />
        <KV k="To" v={to} />
        <KV k="Subject" v={subject} />
      </div>
      <div className="pt-2 text-xs whitespace-pre-wrap" style={{ color: MARINE }}>
        {body || <span className="text-muted-foreground italic">Aucun corps de message.</span>}
      </div>
    </Card>
  );
}

// 4 — Exec email: red banner + From/To/Subject/body + initials avatar.
export function ExecEmailPreview({ p }: { p: PendingAction }) {
  const from = p.payload?.from ?? p.payload?.sender ?? "—";
  const to = p.payload?.to ?? p.payload?.recipient ?? "—";
  const subject = p.payload?.subject ?? "—";
  const body = p.payload?.body ?? p.payload?.body_preview ?? "";
  const initials = (p.payload?.exec_initials ?? "EX").toString().slice(0, 2).toUpperCase();
  return (
    <div className="space-y-2">
      <div
        className="rounded-lg border p-3 text-xs font-medium flex items-start gap-2"
        style={{ background: `${RED}15`, borderColor: RED, color: RED }}
      >
        <span aria-hidden>⚠</span>
        <span>Attention exec — vérifie le ton avant validation.</span>
      </div>
      <Card>
        <div className="flex items-center gap-3 mb-2">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-semibold"
            style={{ background: MARINE, color: IVOIRE }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: MARINE }}>{from}</p>
            <p className="text-[10px] text-muted-foreground truncate">→ {to}</p>
          </div>
        </div>
        <div className="border-b pb-2">
          <KV k="Subject" v={subject} />
        </div>
        <div className="pt-2 text-xs whitespace-pre-wrap" style={{ color: MARINE }}>
          {body || <span className="text-muted-foreground italic">Corps non fourni.</span>}
        </div>
      </Card>
    </div>
  );
}

// 5 — Gate mode: 2-col before/after with mock visual.
const GATE_LABELS: Record<string, string> = {
  public_no_gate: "Embed direct",
  email_capture: "📧 Champ email obligatoire",
  personalized: "Lien personnalisé",
  private_2fa: "🔒 Code 2FA email",
  nda_required: "📜 NDA à signer",
};

function GateMock({ mode, label }: { mode: string; label: string }) {
  return (
    <div
      className="rounded-lg border p-3 h-32 flex flex-col items-center justify-center text-center text-xs"
      style={{ background: IVOIRE, color: MARINE }}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <p className="font-medium">{GATE_LABELS[mode] ?? mode}</p>
    </div>
  );
}

export function GateModePreview({ p }: { p: PendingAction }) {
  const from = (p.payload?.from ?? p.payload?.current_gate_mode ?? "public_no_gate") as string;
  const to = (p.payload?.to ?? p.payload?.new_gate_mode ?? "public_no_gate") as string;
  return (
    <div className="grid grid-cols-2 gap-3">
      <GateMock mode={from} label="Avant" />
      <GateMock mode={to} label="Après" />
    </div>
  );
}

// 6 — Clone deal room: target scope + assets by block group.
export function CloneDealRoomPreview({ p }: { p: PendingAction }) {
  const targetScope = p.payload?.target_scope ?? p.payload?.scope ?? "full";
  const assets = (p.payload?.assets_by_block_group ?? {}) as Record<string, number>;
  const entries = Object.entries(assets);
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium" style={{ color: MARINE }}>Cloner le deal room</p>
        <Badge variant="outline">scope: {String(targetScope)}</Badge>
      </div>
      {entries.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {entries.map(([group, count]) => (
            <li key={group} className="flex justify-between">
              <span className="text-muted-foreground">{group}</span>
              <span style={{ color: MARINE }}>{count} asset{count > 1 ? "s" : ""}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground italic">Aucun asset à cloner.</p>
      )}
      {p.payload?.source_deal && (
        <KV k="Depuis" v={p.payload.source_deal} />
      )}
    </Card>
  );
}

// 7 — Archive deal room: red warning + reason badge.
export function ArchiveDealRoomPreview({ p }: { p: PendingAction }) {
  const reason = p.payload?.reason ?? p.payload?.archived_reason ?? "—";
  return (
    <div
      className="rounded-lg border p-4 space-y-3"
      style={{ background: `${RED}1A`, borderColor: RED, color: MARINE, fontFamily: "DM Sans, system-ui, sans-serif" }}
    >
      <p className="text-xs font-medium" style={{ color: RED }}>
        ⚠ Cette deal room ne sera plus accessible aux prospects via ce lien.
      </p>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Raison :</span>
        <Badge variant="outline" style={{ borderColor: RED, color: RED }}>
          {String(reason)}
        </Badge>
      </div>
    </div>
  );
}

export function ActionPreview({ p }: { p: PendingAction }) {
  switch (p.action_type) {
    case "publish_deal_room":     return <PublishDealRoomPreview p={p} />;
    case "change_voice_source":   return <VoiceSourcePreview p={p} />;
    case "send_external_message": return <MessagePreview p={p} />;
    case "send_exec_email":       return <ExecEmailPreview p={p} />;
    case "change_gate_mode":      return <GateModePreview p={p} />;
    case "clone_deal_room":       return <CloneDealRoomPreview p={p} />;
    case "archive_deal_room":     return <ArchiveDealRoomPreview p={p} />;
    default: return null;
  }
}
