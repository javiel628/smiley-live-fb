import { json, CHANNEL_API_URL } from "./_lib/upstream.js";

export default function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  return json(res, 200, {
    ok: true,
    service: "Live Football live matches 2026",
    channelApi: CHANNEL_API_URL,
    footballSource: CHANNEL_API_URL,
    footballConfigured: true,
    timestamp: new Date().toISOString()
  });
}
