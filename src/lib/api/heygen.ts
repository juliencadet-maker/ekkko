import { supabase } from "@/integrations/supabase/client";

export const heygenApi = {
  /**
   * Create a HeyGen digital twin from an identity's training + consent videos
   */
  async createAvatar(identityId: string, trainingVideoUrl?: string, consentVideoUrl?: string) {
    const { data, error } = await supabase.functions.invoke("heygen-create-avatar", {
      body: { identity_id: identityId, training_video_url: trainingVideoUrl, consent_video_url: consentVideoUrl },
    });
    if (error) throw new Error(error.message);
    return data as { success: boolean; avatar_id: string; status: string; message: string };
  },

  /**
   * Generate videos for all recipients in a campaign
   */
  async generateVideo(campaignId: string, videoJobId?: string) {
    const { data, error } = await supabase.functions.invoke("heygen-generate-video", {
      body: { campaign_id: campaignId, video_job_id: videoJobId },
    });
    if (error) throw new Error(error.message);
    return data as {
      success: boolean;
      results: Array<{
        recipient_id: string;
        success: boolean;
        heygen_video_id?: string;
        error?: string;
      }>;
      message: string;
    };
  },
};
