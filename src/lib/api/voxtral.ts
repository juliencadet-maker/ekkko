import { supabase } from "@/integrations/supabase/client";

export const voxtralApi = {
  /**
   * Generate voice-cloned audio via Voxtral TTS (Mistral AI)
   * Uses the identity's reference video as voice prompt for zero-shot cloning
   */
  async generateAudio(identityId: string, script: string, campaignId?: string) {
    const { data, error } = await supabase.functions.invoke("voxtral-tts", {
      body: { identity_id: identityId, script, campaign_id: campaignId },
    });
    if (error) throw new Error(error.message);
    return data as {
      success: boolean;
      audio_url: string;
      audio_path: string;
      duration_chars: number;
    };
  },
};
