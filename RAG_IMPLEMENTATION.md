# RAG Implementation for AI Insights

## Scope

This document explains how AI insight generation works in the `rag-implementation` branch.
The system now uses a lightweight Retrieval-Augmented Generation (RAG) flow with 3 seeded examples.

## Where It Is Implemented

- Backend service: `backend/services/ai_insights.py`
- API route: `backend/routes/ai_insights_routes.py`
- Frontend response typing: `src/services/api.ts`

## High-Level Flow

1. Frontend sends KPI payload to `POST /ai/generate-insights`.
2. Backend builds a query profile from filters + KPI % changes.
3. Retriever scores 3 in-code exemplars and selects top 2.
4. Backend builds prompt input:
   - compact metrics line
   - retrieved example snippets (style guidance only)
5. Gemini generates structured JSON (primary + alternatives).
6. Backend validates/normalizes output and always returns:
   - legacy fields (`headline`, `bullets`, `green_flag`, `red_flag`)
   - RAG metadata (`variants`, `retrieval_examples`, `rag_scope`)

## Data Sent to AI

The model receives:

1. `COMPACT_METRICS` string:
   - `Region|Product|Period`
   - Then 8 KPI value/change pairs:
     - Revenue
     - Orders
     - Media spend
     - Google spend
     - AOV
     - New customer %
     - Meta ROAS
     - Google ROAS

2. `RETRIEVED_EXAMPLES` (up to 2 entries), each containing:
   - exemplar `id`
   - `context` (`region|product|period_days`)
   - `pattern`
   - `green_style`
   - `red_style`

Important: raw row-level dataset is not sent to Gemini. Only compact KPI summary + short exemplar snippets are sent.

## Seeded RAG Knowledge Base (Current)

Currently hardcoded in `RAG_EXEMPLARS`:

1. `uk-necklace-30d-growth`
2. `us-all-180d-contraction`
3. `all-earring-7d-mixed`

Each exemplar stores:

- context tags: `region`, `product`, `period_days`
- expected directional signs for key metrics
- short style summaries for headline/flags patterning

## Retrieval Logic

Function: `_retrieve_examples(...)`, top_k = 2

Scoring dimensions (`_score_exemplar`):

- Region match: high weight
- Product match: high weight
- Period-day proximity: weighted by gap
- KPI direction sign match for:
  - revenue
  - orders
  - media_spend
  - aov
  - new_customers_pct
  - meta_roas
  - google_roas
  - spend_revenue_gap (`media_spend_change - revenue_change`)

Sign bucketing uses `_sign(value, neutral_band=0.3)`:

- `1` if > 0.3
- `-1` if < -0.3
- `0` otherwise

## Prompt and Generation Contract

System prompt requires:

- Facts only from current KPI payload.
- Retrieved examples as style guidance only.
- Strict JSON output.
- Headline without numbers.
- 3 metric bullets with specific coverage.
- `**Green flag:**` and `**Red flag:**` prefixes.
- 3 narrative alternatives with different emphasis.

## Model Parameters and Controls

From `_build_config()`:

- Model: `GEMINI_FLASH_MODEL` env var (default `gemini-2.5-flash`)
- Temperature: `0.2`
- `responseMimeType`: `application/json`
- `responseSchema`: `RagInsightsOutput`

Retry behavior:

- Up to 2 attempts per request.
- Parses `response.parsed` first, then JSON text fallback.

## API Request Schema

`POST /ai/generate-insights`

Required metric fields:

- `revenue`, `orders`, `media_spend`, `google_spend`, `aov`, `new_customers_pct`, `meta_roas`, `google_roas`

Each metric:

- `value: string`
- `change_percent: number`

Optional filters:

- `region?: string`
- `product?: string`
- `period?: string`

## API Response Schema

Backward-compatible fields:

- `headline: string`
- `bullets: string[]` (3)
- `green_flag: string`
- `red_flag: string`

RAG fields:

- `variants?: [{ headline, bullets, green_flag, red_flag }, ...]` (target 3)
- `retrieval_examples?: string[]` (exemplar ids)
- `rag_scope?: string`

## Fallback and Reliability

If Gemini key is missing or generation/parsing fails:

- Returns fallback primary response
- Still returns 3 variants (deterministic backfill)
- `rag_scope` marks fallback mode

## Token/Context Management

Current design keeps context small by:

- Sending compact KPI line instead of raw tables
- Retrieving only top 2 exemplar snippets
- Keeping exemplar text short and structured

This reduces token usage and keeps generation consistent for dashboard latency.

## Current Limitations

- Only 3 seeded exemplars (coverage is intentionally narrow for v1).
- Retrieval is rule-scored, not vector-semantics.
- UI currently consumes legacy primary fields; alternatives are returned and ready for UI rendering.

## Next Recommended Expansion

1. Move exemplars to a versioned JSON store.
2. Expand curated examples to 15-30.
3. Add retrieval confidence threshold + explicit low-confidence handling.
4. Expose variant selector in UI (show 3 generated options).
5. Add request/response logging for offline quality evaluation.

