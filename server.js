import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const CHANNEL_API_URL = "https://movieapi.xcasper.space/api/live";
const FOOTBALL_API_BASE = process.env.FOOTBALL_DATA_BASE_URL || "https://api.football-data.org/v4";
const FOOTBALL_API_KEY = process.env.FOOTBALL_DATA_API_KEY || "";
const CACHE_TTL_MS = Math.max(30000, Number(process.env.CACHE_TTL_SECONDS || 90) * 1000);
const cache = new Map();

app.disable("x-powered-by");
app.use(helmet({crossOriginEmbedderPolicy:false, contentSecurityPolicy:{directives:{
  defaultSrc:["'self'"], scriptSrc:["'self'","https://cdn.jsdelivr.net"], styleSrc:["'self'","'unsafe-inline'","https://fonts.googleapis.com"], fontSrc:["'self'","https://fonts.gstatic.com","data:"], imgSrc:["'self'","data:","https:"], mediaSrc:["'self'","https:","http:"], connectSrc:["'self'","https:"], frameAncestors:["'self'"], objectSrc:["'none'"], upgradeInsecureRequests:null
}}}));
app.use(rateLimit({windowMs:60000,limit:120,standardHeaders:"draft-7",legacyHeaders:false,message:{error:"Too many requests. Please wait and try again."}}));
app.use(express.static(path.join(__dirname,"public"),{extensions:["html"],maxAge:process.env.NODE_ENV==="production"?"1h":0}));

async function cachedJSON(key, ttl, loader) {
  const current=cache.get(key);
  if(current && Date.now()-current.time<ttl) return current.value;
  const value=await loader();
  cache.set(key,{time:Date.now(),value});
  return value;
}
async function fetchJSON(url, headers={}) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try {
    const res=await fetch(url,{headers,signal:controller.signal});
    const text=await res.text();
    if(!res.ok) throw Object.assign(new Error(`Upstream service returned HTTP ${res.status}`),{status:502});
    let data; try { data=JSON.parse(text); } catch { throw Object.assign(new Error("The upstream service returned invalid JSON."),{status:502}); }
    return data;
  } finally { clearTimeout(timer); }
}
function sendError(res,error) {
  const status=error.status || (error.name==="AbortError"?504:502);
  res.status(status).json({error:error.message || "Upstream service unavailable."});
}
app.get("/api/health",(req,res)=>res.json({ok:true,service:"Live Football live matches 2026",channelApi:CHANNEL_API_URL,footballConfigured:true,timestamp:new Date().toISOString()}));

app.get("/api/channels",async(req,res)=>{
  try {
    const data=await fetchJSON(CHANNEL_API_URL,{"Accept":"application/json","User-Agent":"LiveFootball2026/1.0","Cache-Control":"no-cache"});
    res.set("Cache-Control","no-store, max-age=0").json(data);
  } catch(e) { sendError(res,e); }
});

app.get("/api/matches",async(req,res)=>{
  try {
    const data=await cachedJSON("primary-live-api",CACHE_TTL_MS,()=>fetchJSON(CHANNEL_API_URL,{"Accept":"application/json","User-Agent":"LiveFootball2026/1.0"}));
    res.set("Cache-Control","public, max-age=30").json({matches:Array.isArray(data?.data?.matchList)?data.data.matchList:[],lastUpdated:new Date().toISOString(),source:CHANNEL_API_URL});
  } catch(e) { sendError(res,e); }
});

app.get("/api/league",async(req,res)=>{
  const code=String(req.query.code||"ALL").toUpperCase();
  const labels={PL:"Premier League",CL:"Champions League",PD:"La Liga",SA:"Serie A",BL1:"Bundesliga",FL1:"Ligue 1",EL:"Europa League",ECL:"Conference League",ALL:"All competitions"};
  const label=labels[code]||code;
  try {
    const data=await cachedJSON("primary-live-api",CACHE_TTL_MS,()=>fetchJSON(CHANNEL_API_URL,{"Accept":"application/json","User-Agent":"LiveFootball2026/1.0"}));
    const all=Array.isArray(data?.data?.matchList)?data.data.matchList:[];
    const matches=code==="ALL"?all:all.filter(m=>String(m?.league||"").toLowerCase().includes(label.toLowerCase()));
    res.set("Cache-Control","public, max-age=30").json({matches,competition:{name:label},lastUpdated:new Date().toISOString(),source:CHANNEL_API_URL});
  } catch(e) { sendError(res,e); }
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`Live Football 2026 running on port ${PORT}`));
