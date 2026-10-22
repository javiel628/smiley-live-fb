import { json, fetchJSON, cachedJSON, sendFailure, CHANNEL_API_URL } from "./_lib/upstream.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  try {
    const data = await cachedJSON("primary-live-api", () => fetchJSON(CHANNEL_API_URL, { Accept: "application/json", "User-Agent": "LiveFootball2026/1.0" }));
    const list = Array.isArray(data?.data?.matchList) ? data.data.matchList : [];
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return json(res, 200, { matches: list, lastUpdated: new Date().toISOString(), source: CHANNEL_API_URL });
  } catch (error) { return sendFailure(res, error); }
}
