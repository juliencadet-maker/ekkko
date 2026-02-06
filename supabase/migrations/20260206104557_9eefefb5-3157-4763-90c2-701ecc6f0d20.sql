
-- =============================================
-- EKKO - Enterprise Identity-Safe Video Platform
-- Complete Database Schema
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================

-- User roles within an organization
CREATE TYPE public.org_role AS ENUM ('org_owner', 'org_admin', 'org_manager', 'org_user');

-- Identity types
CREATE TYPE public.identity_type AS ENUM ('executive', 'sales_rep', 'hr', 'marketing', 'other');

-- Identity status
CREATE TYPE public.identity_status AS ENUM ('draft', 'pending_approval', 'ready', 'suspended');

-- Campaign status
CREATE TYPE public.campaign_status AS ENUM ('draft', 'pending_approval', 'approved', 'generating', 'completed', 'cancelled');

-- Approval request status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Video job status
CREATE TYPE public.video_job_status AS ENUM ('queued', 'processing', 'completed', 'failed');

-- Audit event types
CREATE TYPE public.audit_event_type AS ENUM (
  'user_signup', 'user_login', 'user_logout',
  'onboarding_started', 'onboarding_profile_completed', 'onboarding_video_recorded', 'onboarding_completed',
  'org_created', 'org_member_added', 'org_member_removed', 'org_member_role_changed',
  'identity_created', 'identity_updated', 'identity_status_changed',
  'campaign_created', 'campaign_updated', 'campaign_submitted', 'campaign_approved', 'campaign_rejected',
  'video_job_created', 'video_job_completed', 'video_job_failed',
  'video_viewed', 'video_shared',
  'approval_requested', 'approval_approved', 'approval_rejected',
  'policy_updated'
);

-- =============================================
-- ORGANIZATIONS
-- =============================================

CREATE TABLE public.orgs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES (Extended User Data)
-- =============================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  title TEXT,
  company TEXT,
  timezone TEXT DEFAULT 'Europe/Paris',
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INTEGER DEFAULT 0,
  default_identity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ORGANIZATION MEMBERSHIPS
-- =============================================

CREATE TABLE public.org_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.org_role NOT NULL DEFAULT 'org_user',
  is_active BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;

-- =============================================
-- VIDEO PROVIDERS
-- =============================================

CREATE TABLE public.providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'mock',
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

-- =============================================
-- IDENTITIES (Digital Personas)
-- =============================================

CREATE TABLE public.identities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  type public.identity_type NOT NULL DEFAULT 'other',
  status public.identity_status NOT NULL DEFAULT 'draft',
  reference_video_path TEXT,
  reference_video_duration INTEGER,
  provider_identity_id TEXT,
  consent_given BOOLEAN DEFAULT FALSE,
  consent_given_at TIMESTAMPTZ,
  is_shareable BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.identities ENABLE ROW LEVEL SECURITY;

-- Add foreign key for default_identity_id after identities table exists
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_default_identity_id_fkey 
FOREIGN KEY (default_identity_id) REFERENCES public.identities(id) ON DELETE SET NULL;

-- =============================================
-- TEMPLATES
-- =============================================

CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  script_template TEXT,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CAMPAIGNS
-- =============================================

CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  identity_id UUID REFERENCES public.identities(id) ON DELETE RESTRICT NOT NULL,
  template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  script TEXT NOT NULL,
  is_self_campaign BOOLEAN DEFAULT TRUE,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  approved_at TIMESTAMPTZ,
  approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RECIPIENTS
-- =============================================

CREATE TABLE public.recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  variables JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;

-- =============================================
-- APPROVAL REQUESTS
-- =============================================

CREATE TABLE public.approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  requested_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_type TEXT NOT NULL DEFAULT 'script',
  status public.approval_status NOT NULL DEFAULT 'pending',
  script_snapshot TEXT,
  decision_comment TEXT,
  decided_at TIMESTAMPTZ,
  decided_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- =============================================
-- VIDEO JOBS
-- =============================================

CREATE TABLE public.video_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES public.recipients(id) ON DELETE CASCADE NOT NULL,
  identity_id UUID REFERENCES public.identities(id) ON DELETE RESTRICT NOT NULL,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  status public.video_job_status NOT NULL DEFAULT 'queued',
  provider_job_id TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- VIDEOS
-- =============================================

CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES public.recipients(id) ON DELETE CASCADE NOT NULL,
  video_job_id UUID REFERENCES public.video_jobs(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  share_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  watermark_enabled BOOLEAN DEFAULT TRUE,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  view_count INTEGER DEFAULT 0,
  first_viewed_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- =============================================
-- VIEW EVENTS (Video Analytics)
-- =============================================

CREATE TABLE public.view_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  viewer_hash TEXT NOT NULL,
  user_agent TEXT,
  referer TEXT,
  country_code TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.view_events ENABLE ROW LEVEL SECURITY;

-- =============================================
-- AUDIT LOGS
-- =============================================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type public.audit_event_type NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ORGANIZATION POLICIES
-- =============================================

CREATE TABLE public.policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE NOT NULL UNIQUE,
  approval_required BOOLEAN DEFAULT TRUE,
  allow_self_approval_for_owners BOOLEAN DEFAULT TRUE,
  identities_shareable BOOLEAN DEFAULT FALSE,
  max_videos_per_campaign INTEGER DEFAULT 100,
  link_expiration_days INTEGER DEFAULT 30,
  watermark_required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- Function to check if user has a specific role in any org
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _role public.org_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = TRUE
  )
$$;

-- Function to check if user has minimum role level in an org
CREATE OR REPLACE FUNCTION public.has_min_role_in_org(_user_id UUID, _org_id UUID, _min_role public.org_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND is_active = TRUE
      AND (
        role = 'org_owner' OR
        (_min_role = 'org_admin' AND role IN ('org_owner', 'org_admin')) OR
        (_min_role = 'org_manager' AND role IN ('org_owner', 'org_admin', 'org_manager')) OR
        (_min_role = 'org_user')
      )
  )
$$;

-- Function to get user's org_id
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id
  FROM public.org_memberships
  WHERE user_id = _user_id
    AND is_active = TRUE
  LIMIT 1
$$;

-- Function to get user's role in org
CREATE OR REPLACE FUNCTION public.get_user_role_in_org(_user_id UUID, _org_id UUID)
RETURNS public.org_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.org_memberships
  WHERE user_id = _user_id
    AND org_id = _org_id
    AND is_active = TRUE
  LIMIT 1
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- ORGS policies
CREATE POLICY "Users can view their orgs" ON public.orgs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_memberships.org_id = orgs.id
        AND org_memberships.user_id = auth.uid()
        AND org_memberships.is_active = TRUE
    )
  );

CREATE POLICY "Org owners can update their org" ON public.orgs
  FOR UPDATE USING (
    public.has_min_role_in_org(auth.uid(), id, 'org_admin')
  );

CREATE POLICY "Authenticated users can create orgs" ON public.orgs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- PROFILES policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view profiles in their org" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m1
      JOIN public.org_memberships m2 ON m1.org_id = m2.org_id
      WHERE m1.user_id = auth.uid()
        AND m2.user_id = profiles.user_id
        AND m1.is_active = TRUE
        AND m2.is_active = TRUE
    )
  );

-- ORG MEMBERSHIPS policies
CREATE POLICY "Users can view memberships in their org" ON public.org_memberships
  FOR SELECT USING (
    org_id = public.get_user_org_id(auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Org admins can manage memberships" ON public.org_memberships
  FOR ALL USING (
    public.has_min_role_in_org(auth.uid(), org_id, 'org_admin')
  );

CREATE POLICY "Users can insert their own membership" ON public.org_memberships
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- PROVIDERS policies
CREATE POLICY "Users can view providers in their org" ON public.providers
  FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org admins can manage providers" ON public.providers
  FOR ALL USING (
    public.has_min_role_in_org(auth.uid(), org_id, 'org_admin')
  );

-- IDENTITIES policies
CREATE POLICY "Users can view identities in their org" ON public.identities
  FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Identity owners can update their identity" ON public.identities
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY "Users can create identities in their org" ON public.identities
  FOR INSERT WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org admins can manage all identities" ON public.identities
  FOR ALL USING (
    public.has_min_role_in_org(auth.uid(), org_id, 'org_admin')
  );

-- TEMPLATES policies
CREATE POLICY "Users can view templates in their org" ON public.templates
  FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org managers can manage templates" ON public.templates
  FOR ALL USING (
    public.has_min_role_in_org(auth.uid(), org_id, 'org_manager')
  );

-- CAMPAIGNS policies
CREATE POLICY "Users can view campaigns in their org" ON public.campaigns
  FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can create campaigns in their org" ON public.campaigns
  FOR INSERT WITH CHECK (
    org_id = public.get_user_org_id(auth.uid())
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Campaign creators can update their campaigns" ON public.campaigns
  FOR UPDATE USING (created_by_user_id = auth.uid());

CREATE POLICY "Org managers can manage all campaigns" ON public.campaigns
  FOR ALL USING (
    public.has_min_role_in_org(auth.uid(), org_id, 'org_manager')
  );

-- RECIPIENTS policies
CREATE POLICY "Users can view recipients in their org" ON public.recipients
  FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can manage recipients in their campaigns" ON public.recipients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = recipients.campaign_id
        AND campaigns.created_by_user_id = auth.uid()
    )
  );

-- APPROVAL REQUESTS policies
CREATE POLICY "Users can view approval requests in their org" ON public.approval_requests
  FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can create approval requests" ON public.approval_requests
  FOR INSERT WITH CHECK (
    org_id = public.get_user_org_id(auth.uid())
    AND requested_by_user_id = auth.uid()
  );

CREATE POLICY "Assigned users can update approval requests" ON public.approval_requests
  FOR UPDATE USING (
    assigned_to_user_id = auth.uid()
    OR public.has_min_role_in_org(auth.uid(), org_id, 'org_admin')
  );

-- VIDEO JOBS policies
CREATE POLICY "Users can view video jobs in their org" ON public.video_jobs
  FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "System can manage video jobs" ON public.video_jobs
  FOR ALL USING (org_id = public.get_user_org_id(auth.uid()));

-- VIDEOS policies
CREATE POLICY "Users can view videos in their org" ON public.videos
  FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Public can view videos by share token" ON public.videos
  FOR SELECT USING (is_active = TRUE);

-- VIEW EVENTS policies
CREATE POLICY "Anyone can insert view events" ON public.view_events
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Org users can view video analytics" ON public.view_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.videos
      WHERE videos.id = view_events.video_id
        AND videos.org_id = public.get_user_org_id(auth.uid())
    )
  );

-- AUDIT LOGS policies
CREATE POLICY "Users can view audit logs in their org" ON public.audit_logs
  FOR SELECT USING (
    org_id = public.get_user_org_id(auth.uid())
    OR (org_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (TRUE);

-- POLICIES table policies
CREATE POLICY "Users can view policies in their org" ON public.policies
  FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org owners can manage policies" ON public.policies
  FOR ALL USING (
    public.has_min_role_in_org(auth.uid(), org_id, 'org_owner')
  );

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_orgs_updated_at BEFORE UPDATE ON public.orgs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_org_memberships_updated_at BEFORE UPDATE ON public.org_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_identities_updated_at BEFORE UPDATE ON public.identities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recipients_updated_at BEFORE UPDATE ON public.recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_approval_requests_updated_at BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_jobs_updated_at BEFORE UPDATE ON public.video_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- STORAGE BUCKETS
-- =============================================

-- Create storage bucket for identity assets (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identity_assets',
  'identity_assets',
  FALSE,
  52428800,
  ARRAY['video/webm', 'video/mp4', 'video/quicktime']
);

-- Create storage bucket for generated videos (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated_videos',
  'generated_videos',
  FALSE,
  524288000,
  ARRAY['video/mp4', 'video/webm']
);

-- Storage policies for identity_assets
CREATE POLICY "Users can upload their own identity assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'identity_assets'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view identity assets in their org"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'identity_assets'
  AND auth.uid() IS NOT NULL
);

-- Storage policies for generated_videos
CREATE POLICY "Users can view generated videos in their org"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'generated_videos'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "System can upload generated videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'generated_videos'
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_org_memberships_user_id ON public.org_memberships(user_id);
CREATE INDEX idx_org_memberships_org_id ON public.org_memberships(org_id);
CREATE INDEX idx_identities_org_id ON public.identities(org_id);
CREATE INDEX idx_identities_owner_user_id ON public.identities(owner_user_id);
CREATE INDEX idx_campaigns_org_id ON public.campaigns(org_id);
CREATE INDEX idx_campaigns_identity_id ON public.campaigns(identity_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_approval_requests_org_id ON public.approval_requests(org_id);
CREATE INDEX idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX idx_approval_requests_assigned_to ON public.approval_requests(assigned_to_user_id);
CREATE INDEX idx_video_jobs_status ON public.video_jobs(status);
CREATE INDEX idx_videos_share_token ON public.videos(share_token);
CREATE INDEX idx_audit_logs_org_id ON public.audit_logs(org_id);
CREATE INDEX idx_audit_logs_event_type ON public.audit_logs(event_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
