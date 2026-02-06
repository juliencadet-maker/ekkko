
-- Fix search_path on update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix overly permissive RLS policies for audit_logs
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Fix overly permissive RLS policies for view_events  
DROP POLICY IF EXISTS "Anyone can insert view events" ON public.view_events;
CREATE POLICY "Users can insert view events for active videos" ON public.view_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.videos
      WHERE videos.id = view_events.video_id
        AND videos.is_active = TRUE
    )
  );
