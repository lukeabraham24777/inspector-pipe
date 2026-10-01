# ILI Pipeline Inspection Data Alignment System (inspector-pipe)

Aligns three in-line inspection (ILI) runs of one pipeline from a single Excel file `Pipeline_Data.xlsx`
(tabs `Summary`, `2007` baseline, `2015`, `2022`), overcoming odometer drift, heterogeneous schemas and clock
inconsistencies to produce a "Golden Thread" of anomaly lineage, growth rates, clusters and risk.
Full algorithm and API detail: `README.md`.

## Architecture & request flow
- Browser -> Cloudflare Worker `inspector-pipe` (`worker/index.js`):
  - non-`/api/*` paths -> `env.ASSETS` (Vite build in `frontend/dist`, SPA fallback).
  - `/api/*` -> proxied to `API_ORIGIN` (the Render FastAPI service) with `x-forwarded-host`/`-proto`; on a
    network error it returns 502 with a "may be waking up, try again" message.
- Frontend calls a same-origin `/api` (`frontend/src/services/api.js`, axios): `POST /api/upload`,
  `GET /api/results`, `GET /api/export`. In dev, `frontend/vite.config.js` proxies `/api` to `localhost:8000`.
- Backend: FastAPI (`backend/app/main.py`, routes in `backend/app/api/routes.py`, prefix `/api`; `GET /` health).
  CORS only allows localhost:5173/3000, which is fine because production traffic is same-origin via the Worker.

## Backend layout (FastAPI + Pandas + NumPy + SciPy)
- `app/core/normalizer.py` - ingest the workbook, map headers, clock `hh:mm:ss` -> 0.0-12.0, feature classification.
- `app/core/alignment.py` - girth-weld piecewise-linear odometer correction + Hungarian matching.
- `app/services/` - `growth.py` (growth rates, time-to-critical, severity), `clustering.py`, `prediction.py`
  (corrosion risk), `export.py` (multi-tab XLSX via xlsxwriter).
- `app/models/schemas.py` - Pydantic schemas. Tests: `backend/tests/test_core.py`.

## Data & storage
- No database and no persistent storage. The uploaded workbook is written to a temp file, processed, and the
  result is kept in a module-level global (`_latest_result` in `routes.py`).
- Consequences: results are shared by everyone hitting the instance, and are lost when the Render instance sleeps or
  restarts (then `/api/results` and `/api/export` return 404 until the file is uploaded again).
- Sample input `Pipeline_Data.xlsx` lives at the repo root.

## Hosting
- Frontend: Cloudflare Workers (free), Worker **`inspector-pipe`**, https://inspector-pipe.lukeabraham06.workers.dev
  - Built by Cloudflare Workers Builds on push to **`cloudflare-render`** (the port branch); once merged into
    `main`, the build trigger switches to `main`.
  - Build: `npm --prefix frontend ci && npm --prefix frontend run build`; deploy: `npx wrangler@4 deploy`.
  - Config `wrangler.jsonc`: assets `frontend/dist`, `run_worker_first: ["/api/*"]`, var `API_ORIGIN`.
- Backend: Render (free, Python), service `srv-dau9f2vavr4c7388ueq0`, https://inspector-pipe-api.onrender.com
  - Auto-deploys from **`main`** (not the port branch): backend changes go live only once they reach `main`.
  - Build `pip install -r backend/requirements.txt`; start
    `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
  - Free instance sleeps after 15 min idle; the first request after that waits ~30-60 s (cold start).
- Vercel is no longer used; `vercel.json` is kept for reference only.

## Env vars / bindings (names only, never values)
- Worker: `ASSETS` (assets binding), `API_ORIGIN` (plain var in `wrangler.jsonc`).
- Frontend build: `VITE_MAPBOX_TOKEN` (optional, currently not set; the map shows a severity-summary fallback).
- Backend reads no env vars besides Render's `PORT` (used in the start command).

## Commands
- Backend setup: `cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt`
- Backend dev: `cd backend && uvicorn app.main:app --reload --port 8000`
- Backend tests: `cd backend && python -m pytest` (pytest + httpx are in requirements.txt)
- Frontend: `cd frontend && npm install`, then `npm run dev` (http://localhost:5173), `npm run build`,
  `npm run lint`, `npm run preview`.
- Local Worker check (optional): build the frontend, then `npx wrangler@4 dev`.

## Gotchas
- Workers free plan: 10 ms CPU per invocation, 50 subrequests per invocation, 100k requests/day for the whole
  Cloudflare account (static asset requests are free). The Worker only streams the proxy request, so it stays cheap.
- Render free: 750 instance-hours/month per workspace, **shared with Ledger** (job-applications), which is kept
  awake most of the day; nothing pings this service, so expect cold starts.
- In-memory results (see Data & storage): don't assume `/api/results` survives between sessions.
- Stray files in the repo root (`*.jsx.tmp`, `response.json`, `test_export.xlsx`, `backend/*.log`, committed
  `__pycache__`) are leftovers, not part of the build.

## Original implementation plan (kept for context)
- **Normalization:** dynamic header mapping across years:
  - Distance: `log dist. [ft]` (2007), `Log Dist. [ft]` (2015), `ILI Wheel Count [ft.]` (2022) -> `odometer_ft`
  - Wall thickness: `t [in]` (2007), `Wt [in]` (2015), `WT [in]` (2022) -> `wall_thickness_in`
  - Events: `event` / `Event Description` -> `feature_description`
  - Reference points: `Girth Weld` / `GirthWeld` / `GW` -> `girth_weld`
- **Alignment:** global girth-weld alignment (piecewise linear correction; DTW was the alternative considered), then
  local bipartite (Hungarian) matching with cost = corrected distance 0.5 + normalized clock 0.3 +
  feature type/dimensions 0.2.
- **Reporting:** absolute and annual depth growth (2007-2015, 2015-2022); flag new (2022-only) and missing
  anomalies; time-to-critical until 80% wall loss; severity classification and priority ranking.
- **Frontend:** React + Tailwind + Lucide + Plotly + Mapbox: dashboard, drift/growth/cluster/prediction charts,
  pipeline map, lineage table, anomaly profile, XLSX export.
