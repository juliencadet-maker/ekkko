import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { video_id, campaign_id, viewer_hash, viewer_name, viewer_email, reaction_type, emoji, comment } = await req.json();

    if (!video_id || !campaign_id || !viewer_hash || !reaction_type) {
      return new Response(
        JSON.stringify({ error: "video_id, campaign_id, viewer_hash, and reaction_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (reaction_type === "emoji" && !emoji) {
      return new Response(
        JSON.stringify({ error: "emoji is required for emoji reactions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (reaction_type === "comment" && (!comment || !comment.trim())) {
      return new Response(
        JSON.stringify({ error: "comment is required for comment reactions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("video_reactions")
      .insert({
        video_id,
        campaign_id,
        viewer_hash,
        viewer_name: viewer_name?.trim() || null,
        viewer_email: viewer_email?.trim() || null,
        reaction_type,
        emoji: reaction_type === "emoji" ? emoji : null,
        comment: reaction_type === "comment" ? comment.trim() : null,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, reaction: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("submit-video-reaction error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
