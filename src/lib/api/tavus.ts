import { supabase } from "@/integrations/supabase/client";

export const tavusApi = {
  /**
   * Create a Tavus replica from an identity's reference video
   */
  async createReplica(identityId: string) {
    const { data, error } = await supabase.functions.invoke("tavus-create-replica", {
      body: { identity_id: identityId },
    });
    if (error) throw new Error(error.message);
    return data as { success: boolean; replica_id: string; status: string; message: string };
  },

  /**
   * Generate videos for all recipients in a campaign
   */
  async generateVideo(campaignId: string, videoJobId?: string) {
    const { data, error } = await supabase.functions.invoke("tavus-generate-video", {
      body: { campaign_id: campaignId, video_job_id: videoJobId },
    });
    if (error) throw new Error(error.message);
    return data as {
      success: boolean;
      results: Array<{
        recipient_id: string;
        success: boolean;
        tavus_video_id?: string;
        error?: string;
      }>;
      message: string;
    };
  },

  /**
   * Check status of a replica or video on Tavus
   */
  async checkStatus(type: "replica" | "video", id: string) {
    const { data, error } = await supabase.functions.invoke("tavus-check-status", {
      body: { type, id },
    });
    if (error) throw new Error(error.message);
    return data as {
      status: string;
      replica_id?: string;
      video_id?: string;
      download_url?: string;
      hosted_url?: string;
      stream_url?: string;
    };
  },
};
