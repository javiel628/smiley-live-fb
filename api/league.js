import { json, fetchJSON, cachedJSON, sendFailure, CHANNEL_API_URL } from "./_lib/upstream.js";

const LABELS = { PL: "Premier League", CL: "Champions League", PD: "La Liga", SA: "Serie A", BL1: "Bundesliga", FL1: "Ligue 1", EL: "Europa League", ECL: "Conference League", ALL: "All competitions" };
export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  const code = String(Array.isArray(req.query.code) ? req.query.code[0] : (req.query.code || "ALL")).toUpperCase();
  try {
    const data = await cachedJSON("primary-live-api", () => fetchJSON(CHANNEL_API_URL, { Accept: "application/json", "User-Agent": "LiveFootball2026/1.0" }));
    const all = Array.isArray(data?.data?.matchList) ? data.data.matchList : [];
    const label = LABELS[code] || code;
    const matches = code === "ALL" ? all : all.filter(m => String(m?.league || "").toLowerCase().includes(label.toLowerCase()));
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return json(res, 200, { matches, competition: { name: label }, lastUpdated: new Date().toISOString(), source: CHANNEL_API_URL });
  } catch (error) { return sendFailure(res, error); }
}
