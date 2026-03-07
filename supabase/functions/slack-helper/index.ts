import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    
    if (!LOVABLE_API_KEY || !SLACK_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing Slack credentials" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json",
    };

    const { action, channel_name, channel_id } = await req.json();

    if (action === "list_channels") {
      const res = await fetch(`${SLACK_GATEWAY_URL}/conversations.list?types=public_channel&limit=200`, { headers });
      const data = await res.json();
      return new Response(JSON.stringify({ channels: (data.channels || []).map((c: any) => ({ id: c.id, name: c.name })) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "find_channel") {
      const res = await fetch(`${SLACK_GATEWAY_URL}/conversations.list?types=public_channel&limit=200`, { headers });
      const data = await res.json();
      const channel = (data.channels || []).find((c: any) => c.name === (channel_name || "general"));
      return new Response(JSON.stringify({ channel: channel ? { id: channel.id, name: channel.name } : null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "join_channel") {
      const res = await fetch(`${SLACK_GATEWAY_URL}/conversations.join`, {
        method: "POST",
        headers,
        body: JSON.stringify({ channel: channel_id }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
