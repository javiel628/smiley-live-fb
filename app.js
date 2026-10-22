(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const CHANNEL_API = "/api/channels";
  const MATCH_API = "/api/matches";
  const LEAGUE_API = "/api/league";
  const FAVORITES_KEY = "lf2026:favorites";
  const RECENT_KEY = "lf2026:recent";
  let channels = [], matches = [], matchTab = "live", selectedChannel = null, hls = null, toastTimer;
  let favorites = readStore(FAVORITES_KEY), recent = readStore(RECENT_KEY);
  function readStore(key) { try { const v = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
  function saveStore(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function toast(msg) { const el=$("toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2600); }
  async function getJSON(url) {
    const response = await fetch(url, {headers:{"Accept":"application/json"}});
    const body = await response.json().catch(()=>null);
    if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
    if (!body || typeof body !== "object") throw new Error("The server returned an unsupported response.");
    if (body.error) throw new Error(body.error);
    return body;
  }
  function normalizeChannel(raw, index) {
    // The primary API returns data.matchList items, with team objects and playPath.
    const team1 = raw?.team1?.name ?? raw?.team1Name ?? raw?.homeTeam?.name ?? "";
    const team2 = raw?.team2?.name ?? raw?.team2Name ?? raw?.awayTeam?.name ?? "";
    const name = raw?.name ?? raw?.channel_name ?? raw?.title ?? raw?.channel ?? raw?.label ?? (team1 && team2 ? `${team1} vs ${team2}` : "");
    const stream = raw?.playPath ?? raw?.stream_url ?? raw?.streamUrl ?? raw?.url ?? raw?.link ?? raw?.src ?? raw?.m3u8 ?? raw?.file;
    const logo = raw?.logo ?? raw?.logo_url ?? raw?.image ?? raw?.icon ?? raw?.thumbnail ?? raw?.team1?.avatar ?? raw?.homeTeam?.crest;
    const category = raw?.category ?? raw?.league?.name ?? raw?.league ?? raw?.group ?? raw?.genre ?? raw?.type ?? "";
    if (!name || typeof name !== "string") return null;
    let safeStream = "";
    try { const u=new URL(typeof stream === "string" ? stream.trim() : ""); if (["https:","http:"].includes(u.protocol)) safeStream=u.href; } catch {}
    let safeLogo = "";
    try { const u=new URL(typeof logo === "string" ? logo : ""); if (["https:","http:"].includes(u.protocol)) safeLogo=u.href; } catch {}
    return {id:String(raw?.id ?? raw?.channel_id ?? raw?.uuid ?? `${name}-${index}`),name:name.trim(),stream:safeStream,logo:safeLogo,category:String(category),raw};
  }
  function isFootball(c) { return /football|soccer|sport|premier|league|champions|bein|super sport|supersport|espn|sky sports|dazn|eurosport|sport tv/i.test(`${c.name} ${c.category}`); }
  async function loadChannels() {
    $("channelsStatus").textContent="Loading channels…";
    $("refreshChannels").disabled=true;
    try {
      const data=await getJSON(CHANNEL_API);
      const list=Array.isArray(data)?data:(Array.isArray(data?.data?.matchList)?data.data.matchList:(Array.isArray(data.matchList)?data.matchList:(Array.isArray(data.channels)?data.channels:(Array.isArray(data.data)?data.data:(Array.isArray(data.results)?data.results:null)))));
      if (!list) throw new Error("The channel service returned an unsupported response.");
      channels=list.map(normalizeChannel).filter(Boolean);
      $("channelCount").textContent=channels.length;
      $("channelGuideCount").textContent=`${channels.length} channels`;
      if (!channels.length) $("channelsStatus").textContent="No channels are currently available.";
      else $("channelsStatus").textContent=`${channels.length} channels loaded from the channel service.`;
      const cats=[...new Set(channels.map(c=>c.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
      const filter=$("categoryFilter"), prior=filter.value;
      filter.innerHTML='<option value="all">All channels</option><option value="football">Football-related</option>'+cats.map(c=>`<option value="cat:${esc(c)}">${esc(c)}</option>`).join("");
      if ([...filter.options].some(o=>o.value===prior)) filter.value=prior;
      renderChannels(); renderFavorites();
      if (!channels.length) $("channelsStatus").textContent="No channels are currently available.";
    } catch(e) {
      $("channelsStatus").textContent=e.message.includes("Failed to fetch")?"Unable to connect to the channel service.":e.message;
      $("channelsStatus").classList.add("error");
      $("channelCount").textContent="—";
      renderChannels();
    } finally { $("refreshChannels").disabled=false; }
  }
  function visibleChannels() {
    const q=$("channelSearch").value.trim().toLowerCase(), cat=$("categoryFilter").value, list=$("listFilter").value;
    return channels.filter(c=>(!q||c.name.toLowerCase().includes(q)||c.category.toLowerCase().includes(q))&&(cat==="all"||(cat==="football"?isFootball(c):c.category===cat.slice(4)))&&(list!=="favorites"||favorites.includes(c.id))&&(list!=="recent"||recent.includes(c.id)));
  }
  function logoHTML(c) { return c.logo?`<img src="${esc(c.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:"⚽"; }
  function renderChannels() {
    const list=visibleChannels();
    $("channelList").innerHTML=list.length?list.map(c=>`<div class="channel-item"><div class="channel-logo">${logoHTML(c)}</div><div class="channel-info"><b title="${esc(c.name)}">${esc(c.name)}</b><small>${esc(c.category||"TV channel")}${c.stream?" · stream listed":" · no stream URL"}</small></div><div class="channel-actions"><button class="${favorites.includes(c.id)?"fav":""}" data-fav="${esc(c.id)}" title="Toggle favorite" aria-label="Toggle favorite">${favorites.includes(c.id)?"★":"☆"}</button><button data-play="${esc(c.id)}" ${c.stream?"":"disabled"} title="${c.stream?"Play channel":"No stream URL supplied by the API"}" aria-label="Play ${esc(c.name)}" ${c.stream?"":"aria-disabled='true'"}>▶</button></div></div>`).join(""):`<div class="empty-state">${channels.length?"No channels match these filters.":"No channel list available. Check the service and retry."}</div>`;
  }
  function renderFavorites() {
    const fav=channels.filter(c=>favorites.includes(c.id));
    $("favoritesGrid").innerHTML=fav.length?fav.map(c=>`<div class="channel-card"><div class="channel-logo">${logoHTML(c)}</div><div class="channel-info"><b>${esc(c.name)}</b><small>${esc(c.category||"TV channel")}</small></div><button class="btn primary" data-play="${esc(c.id)}">Watch</button></div>`).join(""):'<div class="empty-state">Your favorite channels will appear here. Tap ☆ beside a channel to save it.</div>';
  }
  function toggleFavorite(id) { favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id]; saveStore(FAVORITES_KEY,favorites); renderChannels(); renderFavorites(); }
  function addRecent(id) { recent=[id,...recent.filter(x=>x!==id)].slice(0,8); saveStore(RECENT_KEY,recent); }
  function cleanupPlayer() { if(hls){hls.destroy();hls=null;} const v=$("video"); v.pause(); v.removeAttribute("src"); v.load(); v.onplaying=null; v.onerror=null; }
  async function playChannel(id) {
    const c=channels.find(x=>x.id===id); if(!c)return;
    selectedChannel=c; $("selectedTitle").textContent=c.name; $("playerMessage").textContent=c.stream?"Preparing the stream…":"This channel has no available stream URL.";
    $("playerPlaceholder").classList.remove("hidden"); $("playerLoading").classList.add("hidden"); $("playerFrame");
    const frame=document.querySelector(".player-frame"); frame.classList.remove("playing"); cleanupPlayer();
    if(!c.stream){
      $("playerPlaceholder").classList.remove("hidden");
      $("playerMessage").textContent="The API has no playPath for this match. Refresh channels or choose a match marked stream listed.";
      toast("This match has no stream URL in the API.");
      return;
    }
    addRecent(c.id); $("listFilter").value="all"; renderChannels();
    $("playerLoading").classList.remove("hidden");
    const video=$("video");
    video.onerror=()=>{ $("playerLoading").classList.add("hidden"); frame.classList.remove("playing"); $("playerMessage").textContent="Unable to play this stream. Please try again or choose another channel."; $("playerPlaceholder").classList.remove("hidden"); toast("Unable to play this stream."); };
    try {
      const isHls=/\.m3u8($|\?)/i.test(c.stream);
      if(isHls && window.Hls && Hls.isSupported()) {
        hls=new Hls({enableWorker:true,lowLatencyMode:false}); hls.loadSource(c.stream); hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED,()=>{startVideo(video,frame);});
        hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal){$("playerLoading").classList.add("hidden");$("playerMessage").textContent="Unable to play this stream. It may be offline, blocked, or unsupported.";toast("Stream playback failed.");}});
      } else if(isHls && video.canPlayType("application/vnd.apple.mpegurl")) { video.src=c.stream; video.addEventListener("loadedmetadata",()=>startVideo(video,frame),{once:true}); video.load(); }
      else { video.src=c.stream; video.addEventListener("loadedmetadata",()=>startVideo(video,frame),{once:true}); video.load(); }
    } catch { $("playerLoading").classList.add("hidden"); $("playerMessage").textContent="Unable to play this stream. Please try again or choose another channel."; }
  }
  async function startVideo(video,frame) {
    $("playerLoading").classList.add("hidden"); frame.classList.add("playing"); $("playerPlaceholder").classList.add("hidden");
    $("playerMessage").textContent="Stream loaded. Playback may depend on availability, browser support, and provider permissions.";
    try { await video.play(); } catch { $("playerMessage").textContent="Stream loaded. Press play to start playback."; }
  }
  function parseMatches(data) {
    const list=Array.isArray(data)?data:(data?.data?.matchList||data.matchList||data.matches||data.fixtures||data.data||[]);
    return list.map(m=>{
      const home=m.team1?.name??m.homeTeam?.name??m.homeTeam??m.home_team??m.home??m.teams?.home?.name;
      const away=m.team2?.name??m.awayTeam?.name??m.awayTeam??m.away_team??m.away??m.teams?.away?.name;
      if(!home||!away)return null;
      const status=String(m.status||m.fixture?.status?.short||"SCHEDULED").toUpperCase();
      const scoreHome=m.team1?.score??m.score?.fullTime?.home??m.score?.home??m.goals?.home??m.home_score;
      const scoreAway=m.team2?.score??m.score?.fullTime?.away??m.score?.away??m.goals?.away??m.away_score;
      return {id:m.id??m.fixture?.id,home:String(home),away:String(away),homeLogo:m.team1?.avatar??m.homeTeam?.crest??m.home_logo??m.teams?.home?.logo??"",awayLogo:m.team2?.avatar??m.awayTeam?.crest??m.away_logo??m.teams?.away?.logo??"",league:m.league?.name??m.league??m.competition?.name??m.competition??"Football",date:m.startTime??m.utcDate??m.date??m.fixture?.date,status,minute:m.minute??m.statusLive??m.fixture?.status?.elapsed,homeScore:scoreHome,awayScore:scoreAway,venue:m.venue??m.fixture?.venue?.name};
    }).filter(Boolean);
  }
  function matchKind(m) { if(["MATCHING","IN_PLAY","LIVE","1H","2H","HT","ET","P","LIVE"].includes(m.status))return "live"; if(["MATCHENDED","FINISHED","FT","AET","PEN","COMPLETED"].includes(m.status))return "completed"; return "upcoming"; }
  function fmtDate(v) { if(!v)return "Kickoff time unavailable"; const d=new Date(v); return Number.isNaN(+d)?"Kickoff time unavailable":d.toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"}); }
  function renderMatches(target="matchesGrid", subset=matches, showAll=false) {
    const filtered=showAll?subset:subset.filter(m=>matchKind(m)===matchTab);
    const grid=$(target);
    grid.innerHTML=filtered.length?filtered.map(m=>`<article class="match-card"><div class="match-league"><span>${esc(typeof m.league==="string"?m.league:m.league?.name||"Football")}</span><span class="match-state">${matchKind(m)==="live"?"● LIVE":matchKind(m)==="completed"?"FULL TIME":"UPCOMING"}</span></div><div class="teams"><div class="team">${m.homeLogo?`<img src="${esc(m.homeLogo)}" alt="" loading="lazy">`:""}${esc(m.home)}</div><div class="score">${m.homeScore!=null&&m.awayScore!=null?`${esc(m.homeScore)} – ${esc(m.awayScore)}`:"vs"}</div><div class="team">${m.awayLogo?`<img src="${esc(m.awayLogo)}" alt="" loading="lazy">`:""}${esc(m.away)}</div></div><div class="match-time">${matchKind(m)==="live"&&m.minute?`${esc(m.minute)}′ · `:""}${esc(fmtDate(m.date))}${m.venue?` · ${esc(m.venue)}`:""}</div></article>`).join(""):`<div class="empty-state">${matchTab==="live"?"No verified live matches are available right now. Check upcoming fixtures below.":"No fixtures are available for this selection."}</div>`;
  }
  async function loadMatches() {
    $("matchesStatus").textContent="Loading real football fixtures…"; $("matchesStatus").classList.remove("error");
    $("refreshMatches").disabled=true;
    try {
      const data=await getJSON(MATCH_API); matches=parseMatches(data);
      const updated=data.lastUpdated?new Date(data.lastUpdated):new Date();
      $("lastUpdated").textContent=updated.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});
      $("liveCount").textContent=matches.filter(m=>matchKind(m)==="live").length;
      $("upcomingCount").textContent=matches.filter(m=>matchKind(m)==="upcoming").length;
      $("liveTabCount").textContent=matches.filter(m=>matchKind(m)==="live").length;
      $("matchesStatus").textContent=matches.length?`Loaded ${matches.length} fixtures from the configured football data provider.`:"No fixtures are available for this selection.";
      renderMatches();
    } catch(e) {
      $("matchesStatus").textContent=e.message.includes("not configured")?"Football data is not configured yet. Add FOOTBALL_DATA_API_KEY to the server environment.":"Football match information is temporarily unavailable.";
      $("matchesStatus").classList.add("error"); $("liveCount").textContent="—"; $("upcomingCount").textContent="—"; $("liveTabCount").textContent="0"; $("matchesGrid").innerHTML='<div class="empty-state">No fixture data is being shown because the configured provider is unavailable. Configure a provider and retry.</div>';
    } finally { $("refreshMatches").disabled=false; }
  }
  async function loadLeague() {
    const code=$("leagueSelect").value; $("leagueStatus").textContent="Loading fixtures…"; $("leagueStatus").classList.remove("error"); $("leagueGrid").innerHTML="";
    try {
      const data=await getJSON(`${LEAGUE_API}?code=${encodeURIComponent(code)}`);
      const leagueMatches=parseMatches(data); $("leagueStatus").textContent=leagueMatches.length?`Loaded ${leagueMatches.length} fixtures for ${esc(data.competition?.name||code)}.`:"No fixtures are available for this competition.";
      // Reuse rendering with a dedicated target and current selected tab.
      renderMatches("leagueGrid",leagueMatches,true);
    } catch(e) { $("leagueStatus").textContent=e.message.includes("not configured")?"Football data is not configured yet. Add FOOTBALL_DATA_API_KEY to the server environment.":"Football match information is temporarily unavailable."; $("leagueStatus").classList.add("error"); }
  }
  document.addEventListener("click",e=>{
    const fav=e.target.closest("[data-fav]"); if(fav)toggleFavorite(fav.dataset.fav);
    const play=e.target.closest("[data-play]"); if(play)playChannel(play.dataset.play);
    const tab=e.target.closest("[data-match-tab]"); if(tab){matchTab=tab.dataset.matchTab;document.querySelectorAll("[data-match-tab]").forEach(b=>b.classList.toggle("active",b===tab));renderMatches();}
    const nav=e.target.closest(".nav-link"); if(nav){document.querySelectorAll(".nav-link").forEach(n=>n.classList.toggle("active",n===nav));$("nav").classList.remove("open");$("menuToggle").setAttribute("aria-expanded","false");}
  });
  $("menuToggle").addEventListener("click",()=>{const open=$("nav").classList.toggle("open");$("menuToggle").setAttribute("aria-expanded",String(open));});
  $("channelSearch").addEventListener("input",renderChannels); $("categoryFilter").addEventListener("change",renderChannels); $("listFilter").addEventListener("change",renderChannels);
  $("clearSearch").addEventListener("click",()=>{$("channelSearch").value="";renderChannels();$("channelSearch").focus();});
  $("refreshChannels").addEventListener("click",loadChannels); $("refreshMatches").addEventListener("click",loadMatches); $("retryPlayback").addEventListener("click",()=>selectedChannel&&playChannel(selectedChannel.id)); $("loadLeague").addEventListener("click",loadLeague);
  loadChannels(); loadMatches();
  // Keep score refresh moderate. The server applies its own cache and upstream policy.
  setInterval(loadMatches,120000);
})();