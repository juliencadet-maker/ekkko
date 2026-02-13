
-- Table pour tracker la progression de visionnage
CREATE TABLE public.watch_progress (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  viewer_hash text NOT NULL,
  watch_percentage integer NOT NULL DEFAULT 0,
  total_watch_seconds integer NOT NULL DEFAULT 0,
  max_percentage_reached integer NOT NULL DEFAULT 0,
  viewer_name text,
  viewer_email text,
  viewer_title text,
  viewer_company text,
  referred_by_hash text,
  session_count integer NOT NULL DEFAULT 1,
  first_watched_at timestamp with time zone NOT NULL DEFAULT now(),
  last_watched_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index pour performance
CREATE INDEX idx_watch_progress_video_id ON public.watch_progress(video_id);
CREATE INDEX idx_watch_progress_viewer_hash ON public.watch_progress(viewer_hash);
CREATE UNIQUE INDEX idx_watch_progress_video_viewer ON public.watch_progress(video_id, viewer_hash);

-- Enable RLS
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;

-- Org users can view watch progress for their videos
CREATE POLICY "Org users can view watch progress"
ON public.watch_progress
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM videos
  WHERE videos.id = watch_progress.video_id
    AND videos.org_id = get_user_org_id(auth.uid())
));

-- Anyone can insert/update watch progress for active videos (public landing page)
CREATE POLICY "Anyone can insert watch progress"
ON public.watch_progress
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM videos
  WHERE videos.id = watch_progress.video_id
    AND videos.is_active = true
));

CREATE POLICY "Anyone can update watch progress"
ON public.watch_progress
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM videos
  WHERE videos.id = watch_progress.video_id
    AND videos.is_active = true
));

-- Trigger updated_at
CREATE TRIGGER update_watch_progress_updated_at
BEFORE UPDATE ON public.watch_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add referred_by_hash to view_events for tracking referrals
ALTER TABLE public.view_events ADD COLUMN IF NOT EXISTS referred_by_hash text;
ALTER TABLE public.view_events ADD COLUMN IF NOT EXISTS viewer_name text;
ALTER TABLE public.view_events ADD COLUMN IF NOT EXISTS viewer_email text;
