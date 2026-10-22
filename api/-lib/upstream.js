const CHANNEL_API_URL = "https://movieapi.xcasper.space/api/live";
const FOOTBALL_API_BASE = process.env.FOOTBALL_DATA_BASE_URL || "https://api.football-data.org/v4";
const cache = new Map();

export function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(payload));
}

export async function fetchJSON(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const raw = await response.text();
    if (!response.ok) {
      const error = new Error(`Upstream service returned HTTP ${response.status}`);
      error.status = 502;
      throw error;
    }
    try { return JSON.parse(raw); }
    catch {
      const error = new Error("The upstream service returned invalid JSON.");
      error.status = 502;
      throw error;
    }
  } finally { clearTimeout(timer); }
}

export async function cachedJSON(key, loader) {
  const ttl = Math.max(30, Number(process.env.CACHE_TTL_SECONDS || 90)) * 1000;
  const current = cache.get(key);
  if (current && Date.now() - current.time < ttl) return current.value;
  const value = await loader();
  cache.set(key, { time: Date.now(), value });
  return value;
}

export function sendFailure(res, error) {
  const status = error.status || (error.name === "AbortError" ? 504 : 502);
  return json(res, status, { error: error.name === "AbortError" ? "The upstream service timed out. Please try again." : (error.message || "Upstream service unavailable.") });
}

export { CHANNEL_API_URL, FOOTBALL_API_BASE };
