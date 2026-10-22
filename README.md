# LIVE FOOTBALL LIVE MATCHES 2026

**Developed by 𝐒𝚳𝚰𝐋𝚵 𝚳𝚯𝐃𝚵 · © 2026**

Responsive football TV/channel browser with a player, search/filtering, favorites, recently watched channels, and football fixtures from the same primary channel API. Includes Vercel serverless API routes and a local Express server for development.

## Deploy to Vercel (recommended)

1. Upload this project to a GitHub repository, or import the project folder using the Vercel CLI.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Framework preset: **Other**. Leave the build command blank (the site is static HTML/JS and the API routes are serverless functions). The root directory should be the project root.
4. Under **Project → Settings → Environment Variables**, add:
   - `FOOTBALL_DATA_API_KEY` = your personal API token from [football-data.org](https://www.football-data.org/client/register)
   - Optional `FOOTBALL_DATA_BASE_URL` = `https://api.football-data.org/v4`
   - Optional `CACHE_TTL_SECONDS` = `90`
5. Apply the variables to Production (and Preview if desired), then deploy or redeploy.
6. Open the generated Vercel URL. Check `/api/health` and `/api/channels`.

Do not put the football API key in `app.js`, `index.html`, or any public file. Only configure it in Vercel's server-side environment variables. If no key is configured, the site shows an honest configuration message rather than fake fixtures.

### Deploy with Vercel CLI

Install Node.js 20+, then run from the project folder:

```bash
npm install
npx vercel
```

Follow the prompts. For production deployment:

```bash
npx vercel --prod
```

Set environment variables in the Vercel dashboard or using `vercel env add FOOTBALL_DATA_API_KEY` before deploying.

## Run locally

```bash
npm install
cp .env.example .env
```

Set `FOOTBALL_DATA_API_KEY` in `.env`, then run:

```bash
npm start
```

Open `http://localhost:3000`. The Express server serves `public/`; root copies of the static assets are included for Vercel's static deployment.

## Serverless API routes

- `GET /api/health` — service status and whether football data credentials are configured
- `GET /api/channels` — server-side request to the exact primary TV endpoint below
- `GET /api/matches` — football-data.org matches for today through the next seven days
- `GET /api/league?code=PL` — competition fixtures over the next 30 days

## Data sources and limitations

Primary TV channel endpoint (exact URL): `https://movieapi.xcasper.space/api/live`

Football fixtures provider: `https://api.football-data.org/v4` (requires a token and offers coverage subject to the provider's plan and rate limits).

The app uses https://movieapi.xcasper.space/api/live as its single data source for channel entries, match scores, and league filtering. It reads data.matchList, team1, team2, league, startTime, and playPath. The API currently returns empty playPath values for many matches; those entries cannot be played until the provider supplies a stream URL. Signed stream URLs can expire and the provider may restrict browser playback. Only use streams you have permission to distribute.

Playback depends on browser format support, provider availability, CORS/hotlink rules, URL expiry, codecs, network conditions, and any applicable access controls. This site does not bypass DRM, authentication, geo-restrictions, or CORS protections.

## Honest verification status

Verified in the project build:
- [x] Vercel project configuration added.
- [x] Static frontend assets available at project root.
- [x] Serverless functions added for health, channels, matches, and leagues.
- [x] Football API token remains server-side.
- [x] JavaScript syntax checked locally (see delivery notes).

Not verified in this environment:
- [ ] Live response from `movieapi.xcasper.space` (hostname did not resolve during the earlier test).
- [ ] Actual stream playback.
- [ ] Football provider response with your own API key.
- [ ] A live Vercel deployment and mobile/browser playback.

After deploying, check `/api/health`, then `/api/channels`. If channels fail, the upstream service may be offline or inaccessible. If channel JSON uses a different schema, adapt `normalizeChannel()` in `app.js` and `public/app.js`. Test playback only with an authorized, currently available stream.

## Branding

**LIVE FOOTBALL LIVE MATCHES 2026**  
Developed by **𝐒𝚳𝚰𝐋𝚵 𝚳𝚯𝐃𝚵**  
© 2026 𝐒𝚳𝚰𝐋𝚵 𝚳𝚯𝐃𝚵. All rights reserved.
