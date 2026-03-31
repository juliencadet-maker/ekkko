// =============================================
// EKKO - Database Types (Extended from Supabase)
// =============================================

export type OrgRole = "org_owner" | "org_admin" | "org_manager" | "org_user";
export type IdentityType = "executive" | "sales_rep" | "hr" | "marketing" | "other";
export type IdentityStatus = "draft" | "pending_approval" | "ready" | "suspended";
export type CampaignStatus = "draft" | "pending_approval" | "approved" | "generating" | "completed" | "cancelled";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type VideoJobStatus = "queued" | "processing" | "completed" | "failed";
export type AuditEventType =
  | "user_signup"
  | "user_login"
  | "user_logout"
  | "onboarding_started"
  | "onboarding_profile_completed"
  | "onboarding_video_recorded"
  | "onboarding_completed"
  | "org_created"
  | "org_member_added"
  | "org_member_removed"
  | "org_member_role_changed"
  | "identity_created"
  | "identity_updated"
  | "identity_status_changed"
  | "campaign_created"
  | "campaign_updated"
  | "campaign_submitted"
  | "campaign_approved"
  | "campaign_rejected"
  | "video_job_created"
  | "video_job_completed"
  | "video_job_failed"
  | "video_viewed"
  | "video_shared"
  | "approval_requested"
  | "approval_approved"
  | "approval_rejected"
  | "policy_updated";

// Extended Types with Relations
export interface Profile {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company: string | null;
  timezone: string;
  avatar_url: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  default_identity_id: string | null;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgMembership {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  is_active: boolean;
  joined_at: string;
  created_at: string;
  updated_at: string;
  org?: Org;
  profile?: Profile;
}

export interface Provider {
  id: string;
  org_id: string;
  name: string;
  provider_type: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Identity {
  id: string;
  org_id: string;
  owner_user_id: string | null;
  provider_id: string | null;
  display_name: string;
  type: IdentityType;
  status: IdentityStatus;
  reference_video_path: string | null;
  reference_video_duration: number | null;
  provider_identity_id: string | null;
  consent_given: boolean;
  consent_given_at: string | null;
  is_shareable: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  owner?: Profile;
}

export interface Template {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  script_template: string | null;
  variables: unknown[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  org_id: string;
  created_by_user_id: string | null;
  identity_id: string;
  template_id: string | null;
  parent_campaign_id: string | null;
  name: string;
  description: string | null;
  script: string;
  is_self_campaign: boolean;
  status: CampaignStatus;
  approved_at: string | null;
  approved_by_user_id: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  identity?: Identity;
  creator?: Profile;
  recipients?: Recipient[];
  approval_requests?: ApprovalRequest[];
  sub_campaigns?: Campaign[];
}

export interface Recipient {
  id: string;
  org_id: string;
  campaign_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  variables: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequest {
  id: string;
  org_id: string;
  campaign_id: string;
  requested_by_user_id: string | null;
  assigned_to_user_id: string | null;
  approval_type: string;
  status: ApprovalStatus;
  script_snapshot: string | null;
  decision_comment: string | null;
  decided_at: string | null;
  decided_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  campaign?: Campaign;
  requester?: Profile;
  assignee?: Profile;
}

export interface VideoJob {
  id: string;
  org_id: string;
  campaign_id: string;
  recipient_id: string;
  identity_id: string;
  provider_id: string | null;
  status: VideoJobStatus;
  provider_job_id: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  org_id: string;
  campaign_id: string;
  recipient_id: string;
  video_job_id: string;
  storage_path: string;
  share_token: string;
  watermark_enabled: boolean;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  view_count: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  recipient?: Recipient;
  campaign?: Campaign;
}

export interface ViewEvent {
  id: string;
  video_id: string;
  viewer_hash: string;
  user_agent: string | null;
  referer: string | null;
  country_code: string | null;
  viewed_at: string;
}

export interface AuditLog {
  id: string;
  org_id: string | null;
  user_id: string | null;
  event_type: AuditEventType;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  profile?: Profile;
}

export interface Policy {
  id: string;
  org_id: string;
  approval_required: boolean;
  allow_self_approval_for_owners: boolean;
  identities_shareable: boolean;
  max_videos_per_campaign: number;
  link_expiration_days: number;
  watermark_required: boolean;
  created_at: string;
  updated_at: string;
}

// User Context
export interface UserContext {
  user: {
    id: string;
    email: string;
  };
  profile: Profile | null;
  membership: OrgMembership | null;
  org: Org | null;
  policy: Policy | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  isPendingApproval: boolean;
}
