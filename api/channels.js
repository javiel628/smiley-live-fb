import { json, fetchJSON, cachedJSON, sendFailure, CHANNEL_API_URL } from "./_lib/upstream.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  try {
    // Fetch fresh stream paths because upstream playPath links may be short-lived.
    const data = await fetchJSON(CHANNEL_API_URL, {
      Accept: "application/json",
      "User-Agent": "LiveFootball2026/1.0",
      "Cache-Control": "no-cache"
    });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return json(res, 200, data);
  } catch (error) { return sendFailure(res, error); }
}
