# Blocked.fyi frontend

React 19, Vite, Tailwind CSS 3, Lucide React, and React Router DOM. A dark, responsive civic evidence dashboard backed by the existing FastAPI API. No client-side fixture data is inserted: every feed, statistic, and dossier comes from the API.

## Start both services

From the repository root, use two terminals:

```powershell
# Terminal 1 — API and its embedded verification worker
./.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

```powershell
# Terminal 2 — frontend
cd frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite forwards `/api` to `http://localhost:8000`. If the repository virtual environment has not been installed, run `uv sync` from the repository root first. On macOS/Linux, use `uv run uvicorn backend.main:app --host 127.0.0.1 --port 8000` for Terminal 1.

For separate worker operation, set `EMBEDDED_WORKER=false` in `backend/.env` and run `uv run python -m backend.worker` in a third terminal. The default embedded worker requires no third process.

## Pages

- `/`: API statistics, status/platform/region filters, pagination, and telemetry across all retained samples. Filters are stored in URL query parameters for Back/Forward navigation.
- `/submit`: Three-step citizen intake with client validation, preserved fields, server error handling, submission status, and direct dossier redirect.
- `/dossier/:id`: Incident overview, all raw probe samples, frameworks, tri-state procedural indicators, source citations, evidence completeness, JSON export, and print-to-PDF.
- `/about`: Five-stage methodology, interpretation limits, and requested attributions. The old `/methodology` URL redirects here.

The backend has `WebDomain`, not `News`, as a platform enum. **News / Websites maps to WebDomain** and includes all website reports; no news-only classification is claimed. Existing `Other` records remain accessible.

The confidence bar labels the backend's `confidence_score` as HTTP observation completeness. It is never presented as legal certainty. `null` indicators remain unknown; `false` is shown as not established rather than proof of an absent safeguard. Simulation labels and research disclaimers are retained in the dossier, JSON, and print output.

## Build and checks

```sh
npm test
npm run build
```

`dist/` is the static production output. A production host must serve `index.html` for React Router paths and forward `/api/v1` to FastAPI. Vite's development proxy is not included in the static build. Alternatively set `VITE_API_BASE_URL=https://your-api.example/api/v1` at build time, and configure the backend's allowed CORS origins accordingly. No credentials belong in frontend environment variables.

Print to PDF opens the browser print dialog; choose Save as PDF. Print styles show all evidence, hide controls/navigation, include source URLs and disclaimers, and use landscape A4 for the telemetry table. JSON export downloads the full loaded dossier with an additional export disclaimer.

Frontend tests cover intake state and submission, API validation errors, server-side filters, mixed telemetry samples, unknown legal indicators, safe URL handling, missing dossiers, and the print action. These are component/unit tests, not browser or live-proxy verification.
