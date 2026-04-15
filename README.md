# KPI Reporting Workspace

KPI Reporting is a React + FastAPI analytics workspace for demoing end-to-end marketing reporting flows:

- data ingestion setup
- KPI summary and compare views
- AI-generated executive insights
- cross-platform lag/correlation analysis
- campaign assessment and ROAS playground

## Current App Scope

Sidebar workflow order:

1. `Ingestion`
2. `Summary`
3. `Cross Platform Analysis`
4. `Campaign Assessment`
5. `ROAS Playground`

## Key Frontend Behaviors

- `Summary` supports single-view and compare mode.
- Compare mode supports up to 4 views (A/B/C/D) with per-card filters.
- AI insights are **manual trigger only**:
  - first run shows `Generate insights`
  - after generation shows `Refresh insights`
  - after filter change shows `Regenerate insights`
- AI panel is hidden in compare mode as per demo UX decisions.
- Cross-platform analysis shows an auto-loaded combined table sorted by highest `Best r`.

## AI Insights (RAG-Seeded)

- Endpoint: `POST /ai/generate-insights`
- Uses 8 KPI inputs (`value` + `% change`) plus optional context (`region`, `product`, `period`)
- Backend includes a lightweight seeded RAG flow (3 curated examples)
- Response includes primary output and metadata:
  - `headline`, `bullets`, `green_flag`, `red_flag`
  - `variants`, `retrieval_examples`, `rag_scope`

See:

- `RAG_IMPLEMENTATION.md`
- `AI_INSIGHTS_SETUP.md`
- `STAGING.md`

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Zustand, Recharts
- Backend: FastAPI, Pandas, NumPy, SQLAlchemy, scikit-learn, Google GenAI SDK

## Project Layout

```text
src/
  components/
  modules/
    UploadPage.tsx
    SummaryPage.tsx
    CrossPlatformAnalysisPage.tsx
    CampaignAssessmentPage.tsx
    RoasPlaygroundPage.tsx
  services/api.ts
backend/
  main.py
  routes/
  services/
  models/
```

## Local Setup

### Prerequisites

- Node.js `20.19+` (required by Vite 7)
- Python `3.10+`
- npm

### 1) Install Frontend

```bash
npm install
```

### 2) Install Backend

```bash
cd backend
pip install -r requirements.txt
cd ..
```

### 3) Configure Environment

Create/update `backend/.env`:

```env
GEMINI_API_KEY=your_key_here
GEMINI_FLASH_MODEL=gemini-2.5-flash
```

Optional frontend override in root `.env`:

```env
VITE_API_URL=http://127.0.0.1:8002
```

If `VITE_API_URL` is not set, frontend uses same-origin/proxy behavior.

## Run Locally

### Backend (port 8002)

```bash
cd backend
python main.py
```

### Frontend (port 5173)

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Open:

- Frontend: `http://127.0.0.1:5173`
- Backend health: `http://127.0.0.1:8002/health`

## Core Backend APIs

- `GET /health`
- `POST /upload`
- `POST /analyze/correlation`
- `POST /predict`
- `POST /kalman`
- `POST /ingest`
- `POST /analysis/upload-summary`
- `POST /analysis/kpi-summary`
- `POST /analysis/kpi-compare-summary`
- `POST /ai/generate-insights`

## Notes

- Do not commit API keys or secrets.
- CORS is enabled for localhost + private LAN ranges by default.
- Existing TypeScript strict warnings in `CampaignAssessmentPage.tsx` are known and unrelated to runtime.
