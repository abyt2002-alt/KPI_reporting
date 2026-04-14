"""
AI Insights Generation using Google Gemini
"""
import json
import logging
import os
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field, ValidationError

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_MODEL = os.getenv("GEMINI_FLASH_MODEL", "gemini-2.5-flash")

SYSTEM_PROMPT = """You analyze D2C KPI data. State facts only. No opinions, no recommendations, no adjectives like strong/weak/healthy.

You receive: Region|Product|Period then 8 metrics as Value|%change pairs:
Revenue, Orders, MediaSpend, GoogleSpend, AOV, NewCust%, MetaROAS, GoogleROAS

Respond in JSON only:
{"headline":"string","bullets":["s1","s2","s3"],"green_flag":"string","red_flag":"string"}

HEADLINE: "In {Region} for {Product} over {Period}, [positive theme] while [concern theme]." No numbers. Full sentence. Pick themes from data: orders+AOV both up, revenue outpacing spend, buyer base growing, ROAS improving / spend outpacing revenue, ROAS declining, volume dropping, AOV shrinking. If no concern exists, use two positives.

BULLETS (each 1-2 sentences, must include numbers):
1. Revenue, orders, their % changes. New customer % and change. Is buyer base expanding or not.
2. Media spend and % change vs revenue and % change. State the gap in percentage points. Do not calculate ROAS.
3. Google ROAS and spend with % changes. Meta ROAS and % change. Implied Meta spend = media spend minus Google spend. ROAS gap between platforms. Which has more budget.

GREEN FLAG: Prefix "**Green flag:**" Best positive pattern. Metric values and comparison. 1-2 sentences.

RED FLAG: Prefix "**Red flag:**" Most notable concern. Metric values. 1-2 sentences. If none: "No declines detected."

Rules: No em dashes. No repeated insights across sections. Green and red flag must cover different metrics. Positive % = metric went up. Negative % = went down."""


class InsightsOutput(BaseModel):
    headline: str = Field(..., min_length=8)
    bullets: list[str] = Field(..., min_length=3, max_length=3)
    green_flag: str = Field(..., min_length=8)
    red_flag: str = Field(..., min_length=8)


FALLBACK_RESPONSE = {
    "headline": "Insights temporarily unavailable",
    "bullets": [
        "The system could not generate insights at this time.",
        "Please check API configuration and try again.",
        "Using placeholder content.",
    ],
    "green_flag": "**Green flag:** System is configured and ready.",
    "red_flag": "**Red flag:** Insight generation encountered an error.",
}


def _get_client() -> Optional[genai.Client]:
    """Create Gemini client lazily so runtime env changes are picked up."""
    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


def _format_change(value: float) -> str:
    """Format % change with +/- prefix."""
    return f"+{value}" if value >= 0 else str(value)


def _build_input_text(
    metrics: Dict[str, Any],
    region: str = "All Markets",
    product: str = "All Products",
    period: str = "30d",
) -> str:
    """Build the compact input string from metrics dictionary."""
    m = metrics
    return (
        f"{region}|{product}|{period}\n"
        f"{m['revenue']['value']}|{_format_change(m['revenue']['change_percent'])}|"
        f"{m['orders']['value']}|{_format_change(m['orders']['change_percent'])}|"
        f"{m['media_spend']['value']}|{_format_change(m['media_spend']['change_percent'])}|"
        f"{m['google_spend']['value']}|{_format_change(m['google_spend']['change_percent'])}|"
        f"{m['aov']['value']}|{_format_change(m['aov']['change_percent'])}|"
        f"{m['new_customers_pct']['value']}|{_format_change(m['new_customers_pct']['change_percent'])}|"
        f"{m['meta_roas']['value']}|{_format_change(m['meta_roas']['change_percent'])}|"
        f"{m['google_roas']['value']}|{_format_change(m['google_roas']['change_percent'])}"
    )


def _parse_response(response: Any) -> Dict[str, Any]:
    """Extract and validate JSON from the Gemini response."""
    parsed_payload = getattr(response, "parsed", None)
    if parsed_payload is not None:
        validated = InsightsOutput.model_validate(parsed_payload)
        return validated.model_dump()

    text = (getattr(response, "text", "") or "").strip()

    # Strip markdown code fences if present.
    if "```json" in text:
        text = text[text.find("```json") + 7 :]
        text = text[: text.find("```")].strip()
    elif "```" in text:
        text = text[text.find("```") + 3 :]
        text = text[: text.find("```")].strip()

    parsed_payload = json.loads(text)
    validated = InsightsOutput.model_validate(parsed_payload)
    return validated.model_dump()


def _build_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        systemInstruction=SYSTEM_PROMPT,
        temperature=0.2,
        responseMimeType="application/json",
        responseSchema=InsightsOutput,
    )


def generate_insights(
    metrics_data: Dict[str, Any],
    region: str = "All Markets",
    product: str = "All Products",
    period: str = "30d",
) -> Dict[str, Any]:
    """Generate AI insights using Gemini based on KPI metrics."""
    client = _get_client()
    if not client:
        logger.warning("Gemini API key not configured")
        return {
            **FALLBACK_RESPONSE,
            "headline": "API key not configured. Add GEMINI_API_KEY to backend/.env file.",
        }

    input_text = _build_input_text(metrics_data, region, product, period)
    config = _build_config()

    last_text = ""
    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[input_text],
                config=config,
            )
            last_text = (getattr(response, "text", "") or "")[:500]
            result = _parse_response(response)
            logger.info("Insights generated successfully")
            return result
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            logger.warning("Attempt %s/2 parse-validation failed: %s", attempt + 1, exc)
            if last_text:
                logger.warning("Raw response snippet: %s", last_text)
        except Exception as exc:
            logger.error("Attempt %s/2 insight generation failed: %s", attempt + 1, exc, exc_info=True)

    return FALLBACK_RESPONSE
