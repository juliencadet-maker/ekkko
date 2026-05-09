// Phase 1d.5f — Deal Room V1.5 shared types.
// Source of truth = get-public-video-v3 payload.

export type BlockGroup =
  | "hero_video"
  | "documents"
  | "social_proof"
  | "roi"
  | "pricing"
  | "references"
  | "calendly"
  | "other";

export const BLOCK_ORDER: BlockGroup[] = [
  "hero_video",
  "documents",
  "social_proof",
  "roi",
  "pricing",
  "references",
  "calendly",
  "other",
];

export const BLOCK_LABELS: Record<BlockGroup, string> = {
  hero_video: "Présentation",
  documents: "Documents",
  social_proof: "Ils nous font confiance",
  roi: "Retour sur investissement",
  pricing: "Tarification",
  references: "Références",
  calendly: "Réserver un échange",
  other: "Compléments",
};

export interface V15Asset {
  id: string;
  asset_type: string;
  asset_purpose: string | null;
  file_url: string | null;
  label_fr?: string | null;
  display_order: number;
  block_group: BlockGroup | null;
  block_title: string | null;
  block_description: string | null;
}

export interface V15Payload {
  deal_room_version_id: string;
  campaign_name: string | null;
  company_display_name: string | null;
  prospect_message: string | null;
  audio_signed_url: string | null;
  video_signed_url: string | null;
  audio_duration_ms: number | null;
  video_duration_ms: number | null;
  ae_name: string;
  ae_initials: string;
  secondary_assets: V15Asset[];
  topics_enabled: string[];
  resolved_viewer: { id?: string; name?: string; email?: string | null; title?: string | null } | null;
  experience_mode: string;
  calendly_url?: string | null;
  summary_bullets?: string[] | null;
}

export interface BlockProps {
  campaignId: string;
  assets: V15Asset[];
  viewerHash: string | null;
  prospectEmail: string | null;
  blockGroup: BlockGroup;
  blockIndex: number;
  totalBlocks: number;
  onAssetView?: (assetId: string) => void;
}
