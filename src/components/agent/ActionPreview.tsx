// Phase 4 — 7 lightweight preview components for pending actions.
// Pure presentational: render the payload of each action_type honestly,
// without paraphrasing or pretending the side-effect already happened.
import type { PendingAction } from "@/hooks/useAgentNotifications";

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-3 py-1 text-xs">
    <span className="text-muted-foreground">{k}</span>
    <span className="text-foreground text-right truncate max-w-[60%]">{v}</span>
  </div>
);

function Box({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      {children}
    </div>
  );
}

export function VoiceSourcePreview({ p }: { p: PendingAction }) {
  return (
    <Box label="Changer la source vocale">
      <Row k="Nouvelle source" v={p.payload?.new_voice_source ?? "—"} />
      <Row k="Source actuelle" v={p.payload?.current_voice_source ?? "—"} />
    </Box>
  );
}

export function PublishDealRoomPreview({ p }: { p: PendingAction }) {
  return (
    <Box label="Publier le deal room">
      <Row k="Mode" v={p.payload?.layout_mode ?? "full"} />
      <Row k="Version" v={p.payload?.version_label ?? "—"} />
    </Box>
  );
}

export function MessagePreview({ p }: { p: PendingAction }) {
  return (
    <Box label="Envoyer un message externe">
      <Row k="Canal" v={p.payload?.channel ?? "email"} />
      <Row k="Destinataire" v={p.payload?.recipient ?? "—"} />
      {p.payload?.preview && (
        <p className="mt-2 text-xs italic text-muted-foreground line-clamp-3">"{p.payload.preview}"</p>
      )}
    </Box>
  );
}

export function ExecEmailPreview({ p }: { p: PendingAction }) {
  return (
    <Box label="Email exec">
      <Row k="Destinataire" v={p.payload?.recipient ?? "—"} />
      <Row k="Sujet" v={p.payload?.subject ?? "—"} />
      {p.payload?.body_preview && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-4 whitespace-pre-line">{p.payload.body_preview}</p>
      )}
    </Box>
  );
}

export function GateModePreview({ p }: { p: PendingAction }) {
  return (
    <Box label="Changer le mode de gate">
      <Row k="Avant" v={p.payload?.from ?? "—"} />
      <Row k="Après" v={p.payload?.to ?? "—"} />
    </Box>
  );
}

export function CloneDealRoomPreview({ p }: { p: PendingAction }) {
  return (
    <Box label="Cloner le deal room">
      <Row k="Source" v={p.payload?.source_deal ?? "—"} />
      <Row k="Vers" v={p.payload?.target_deal ?? "nouveau deal"} />
    </Box>
  );
}

export function ArchiveDealRoomPreview({ p }: { p: PendingAction }) {
  return (
    <Box label="Archiver le deal room">
      <Row k="Raison" v={p.payload?.reason ?? "—"} />
    </Box>
  );
}

export function ActionPreview({ p }: { p: PendingAction }) {
  switch (p.action_type) {
    case "change_voice_source":  return <VoiceSourcePreview p={p} />;
    case "publish_deal_room":    return <PublishDealRoomPreview p={p} />;
    case "send_external_message":return <MessagePreview p={p} />;
    case "send_exec_email":      return <ExecEmailPreview p={p} />;
    case "change_gate_mode":     return <GateModePreview p={p} />;
    case "clone_deal_room":      return <CloneDealRoomPreview p={p} />;
    case "archive_deal_room":    return <ArchiveDealRoomPreview p={p} />;
    default: return null;
  }
}
