
-- Update video job to completed
UPDATE public.video_jobs 
SET status = 'completed', completed_at = now() 
WHERE id = '9cd528b9-509d-4ba6-b0a1-31cc27c0cf74';

-- Create the video record with Tavus URLs
INSERT INTO public.videos (org_id, campaign_id, video_job_id, recipient_id, storage_path, is_active, metadata)
VALUES (
  'd70a710a-e8e9-4c89-934b-04e5cbb61307',
  'eba545a0-e2ea-4e96-8c6d-dd80f84d6986',
  '9cd528b9-509d-4ba6-b0a1-31cc27c0cf74',
  '9ec3d457-4705-4cd0-9e99-bcb9a52127e0',
  'https://stream.mux.com/9pMlvCWGxpVaeqtqF201G9FNKQStITvadvnG02RJTtiaA/high.mp4?download=e5b6bf33b8',
  true,
  '{"tavus_video_id":"e5b6bf33b8","download_url":"https://stream.mux.com/9pMlvCWGxpVaeqtqF201G9FNKQStITvadvnG02RJTtiaA/high.mp4?download=e5b6bf33b8","hosted_url":"https://tavus.video/e5b6bf33b8","stream_url":"https://stream.mux.com/9pMlvCWGxpVaeqtqF201G9FNKQStITvadvnG02RJTtiaA.m3u8","source":"tavus"}'
);

-- Update campaign status to completed
UPDATE public.campaigns 
SET status = 'completed', completed_at = now() 
WHERE id = 'eba545a0-e2ea-4e96-8c6d-dd80f84d6986';
