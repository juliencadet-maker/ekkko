
-- Table for access control: allowed viewers and allowed domains per campaign
CREATE TABLE public.video_access_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  -- Either a specific email or a domain pattern
  access_type text NOT NULL DEFAULT 'email' CHECK (access_type IN ('email', 'domain')),
  email text, -- specific email for 'email' type
  domain text, -- e.g. 'vusion.com' for 'domain' type
  first_name text,
  last_name text,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid
);

ALTER TABLE public.video_access_list ENABLE ROW LEVEL SECURITY;

-- Org users can manage access lists for their campaigns
CREATE POLICY "Users can manage access list in their org"
  ON public.video_access_list FOR ALL
  TO public
  USING (org_id = get_user_org_id(auth.uid()));

-- Public can read access list (for landing page gate check via edge function)
-- We'll use an edge function with service role instead

-- Table for reactions/comments on videos
CREATE TABLE public.video_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  viewer_hash text NOT NULL,
  viewer_name text,
  viewer_email text,
  reaction_type text NOT NULL DEFAULT 'emoji' CHECK (reaction_type IN ('emoji', 'comment')),
  emoji text, -- e.g. '👍', '🔥', '❤️'
  comment text, -- for comment type
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert reactions (public landing page)
CREATE POLICY "Anyone can insert reactions"
  ON public.video_reactions FOR INSERT
  TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM videos WHERE videos.id = video_reactions.video_id AND videos.is_active = true
  ));

-- Org users can view reactions
CREATE POLICY "Org users can view reactions"
  ON public.video_reactions FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM videos WHERE videos.id = video_reactions.video_id AND videos.org_id = get_user_org_id(auth.uid())
  ));

-- Public can view reactions for active videos (for landing page display)
CREATE POLICY "Public can view reactions for active videos"
  ON public.video_reactions FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM videos WHERE videos.id = video_reactions.video_id AND videos.is_active = true
  ));
