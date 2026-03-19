import { supabase } from "@/integrations/supabase/client";

export const heygenApi = {
  /**
   * Create a HeyGen avatar from an identity's reference video
   */
  async createAvatar(identityId: string) {
    const { data, error } = await supabase.functions.invoke("heygen-create-avatar", {
      body: { identity_id: identityId },
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

  /**
   * Check status of an avatar or video on HeyGen
   */
  async checkStatus(type: "avatar" | "video", id: string) {
    const { data, error } = await supabase.functions.invoke("heygen-check-status", {
      body: { type, id },
    });
    if (error) throw new Error(error.message);
    return data as {
      status: string;
      avatar_id?: string;
      video_id?: string;
      video_url?: string;
    };
  },
};
