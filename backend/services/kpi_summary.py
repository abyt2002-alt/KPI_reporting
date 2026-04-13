from __future__ import annotations

import json
import os
from typing import List, Optional

from pydantic import BaseModel, Field

try:
    from google import genai
    from google.genai import types
except Exception:  # pragma: no cover - graceful runtime error when SDK is unavailable
    genai = None
    types = None


FLASH_MODEL = os.getenv("GEMINI_FLASH_MODEL", "gemini-2.5-flash")


class KpiMetricInput(BaseModel):
    label: str
    value: float
    formatted_value: str
    trend_percent: Optional[float] = None
    kind: str


class KpiSummaryRequest(BaseModel):
    time_range: str
    market: str
    category: str
    source: str
    metrics: List[KpiMetricInput] = Field(..., min_length=1)


class KpiCompareViewInput(BaseModel):
    label: str
    time_range: str
    market: str
    category: str
    source: str
    metrics: List[KpiMetricInput] = Field(..., min_length=1)


class KpiCompareSummaryRequest(BaseModel):
    left: KpiCompareViewInput
    right: KpiCompareViewInput


class KpiSummaryOutput(BaseModel):
    headline: str = Field(..., min_length=3, max_length=80)
    overview: str = Field(..., min_length=20, max_length=420)
    insights: List[str] = Field(..., min_length=4, max_length=4)
    actions: List[str] = Field(..., min_length=3, max_length=3)
    watchout: str = Field(..., min_length=8, max_length=180)


class KpiSummaryResponse(KpiSummaryOutput):
    model_used: str


def generate_kpi_summary(request: KpiSummaryRequest) -> KpiSummaryResponse:
    if genai is None or types is None:
        raise RuntimeError("Gemini SDK is not available")

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    client = genai.Client(api_key=api_key)
    payload = request.model_dump()

    system_instruction = (
        "You are a senior ecommerce performance analyst for a jewelry KPI dashboard.\n"
        "Your role is to convert eight KPI cards into a concise business summary for a user reviewing sales, spend, ROAS, orders, AOV, and customer mix.\n"
        "Use only the JSON payload. Do not invent external causes, campaign names, or unprovided facts.\n"
        "Respect the active filters: time_range, market, category, and source.\n"
        "Compare each KPI with its trend_percent. Positive means increased versus the previous range; negative means decreased.\n"
        "Call out which KPIs improved, which weakened, and whether revenue quality is supported by ROAS, AOV, orders, and new customer share.\n"
        "Write direct executive language for a brand operator, not generic dashboard copy.\n"
        "Return valid JSON only.\n"
        "headline: 5-9 words.\n"
        "overview: 35-60 words.\n"
        "insights: exactly 4 bullets, each 10-18 words, each mentioning a KPI or trend.\n"
        "actions: exactly 3 practical next steps, each 7-15 words.\n"
        "watchout: one sentence about data interpretation or risk, under 22 words."
    )

    config = types.GenerateContentConfig(
        systemInstruction=system_instruction,
        temperature=0.2,
        responseMimeType="application/json",
        responseSchema=KpiSummaryOutput,
    )

    response = client.models.generate_content(
        model=FLASH_MODEL,
        contents=[f"KPI_PAYLOAD_JSON={json.dumps(payload, separators=(',', ':'), ensure_ascii=False)}"],
        config=config,
    )

    parsed = json.loads(response.text or "{}")
    summary = KpiSummaryOutput.model_validate(parsed)
    return KpiSummaryResponse(**summary.model_dump(), model_used=FLASH_MODEL)


def generate_kpi_compare_summary(request: KpiCompareSummaryRequest) -> KpiSummaryResponse:
    if genai is None or types is None:
        raise RuntimeError("Gemini SDK is not available")

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    client = genai.Client(api_key=api_key)
    payload = request.model_dump()

    system_instruction = (
        "You are a senior ecommerce performance analyst for a jewelry KPI comparison dashboard.\n"
        "Your role is to compare two filtered KPI views, called View A and View B, using only the provided JSON payload.\n"
        "Each view contains the same KPI set with formatted values and trend_percent versus its own previous range.\n"
        "Do not invent external causes, campaign names, audiences, or facts outside the payload.\n"
        "Respect each view's filters: time_range, market, category, and source.\n"
        "Explain where View A is stronger, where View B is stronger, and whether revenue quality is supported by ROAS, AOV, orders, spend, and new customer share.\n"
        "Use direct executive language for a brand operator comparing two regions, periods, products, or sources.\n"
        "Return valid JSON only.\n"
        "headline: 5-9 words, explicitly comparative.\n"
        "overview: 40-70 words comparing both views.\n"
        "insights: exactly 4 bullets, each 10-20 words, each mentioning View A or View B and a KPI.\n"
        "actions: exactly 3 practical next steps, each 7-16 words.\n"
        "watchout: one sentence about comparison risk or interpretation, under 24 words."
    )

    config = types.GenerateContentConfig(
        systemInstruction=system_instruction,
        temperature=0.2,
        responseMimeType="application/json",
        responseSchema=KpiSummaryOutput,
    )

    response = client.models.generate_content(
        model=FLASH_MODEL,
        contents=[f"KPI_COMPARE_PAYLOAD_JSON={json.dumps(payload, separators=(',', ':'), ensure_ascii=False)}"],
        config=config,
    )

    parsed = json.loads(response.text or "{}")
    summary = KpiSummaryOutput.model_validate(parsed)
    return KpiSummaryResponse(**summary.model_dump(), model_used=FLASH_MODEL)
