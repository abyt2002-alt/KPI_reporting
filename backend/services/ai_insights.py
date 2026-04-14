"""
AI Insights Generation with lightweight RAG (3 seeded exemplars) using Google Gemini.
"""
import json
import logging
import os
import re
from copy import deepcopy
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field, ValidationError

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_MODEL = os.getenv("GEMINI_FLASH_MODEL", "gemini-2.5-flash")

SYSTEM_PROMPT = """You are a D2C KPI analyst.
Use only the provided metric payload numbers for factual claims.
Use retrieved examples for style/pattern guidance only. Never copy their numbers.

Input includes:
1) COMPACT_METRICS line: Region|Product|Period + 8 KPI value/change pairs
2) RETRIEVED_EXAMPLES: up to 2 reference cases

Return valid JSON only in this structure:
{
  "selected_response": {
    "headline": "string",
    "bullets": ["s1", "s2", "s3"],
    "green_flag": "string",
    "red_flag": "string"
  },
  "alternatives": [
    {
      "headline": "string",
      "bullets": ["s1", "s2", "s3"],
      "green_flag": "string",
      "red_flag": "string"
    },
    {
      "headline": "string",
      "bullets": ["s1", "s2", "s3"],
      "green_flag": "string",
      "red_flag": "string"
    },
    {
      "headline": "string",
      "bullets": ["s1", "s2", "s3"],
      "green_flag": "string",
      "red_flag": "string"
    }
  ],
  "retrieval_ids": ["id1", "id2"]
}

Headline rule:
- "In {Region} for {Product} over {Period}, ... while ..."
- No numbers in headline.

Each bullet must include numbers from provided metrics:
1) Revenue, orders, New customer %, and direction.
2) Media spend vs revenue pacing and the percentage-point gap.
3) Google vs Meta ROAS, implied Meta spend, and budget share observation.

Green flag:
- Prefix exactly "**Green flag:**"
- Best positive pattern with supporting values.

Red flag:
- Prefix exactly "**Red flag:**"
- Main concern with supporting values.
- If no concern exists, use: "**Red flag:** No declines detected."

Alternatives rule:
- Produce 3 alternatives with different narrative emphasis:
  1. Volume growth/decline lens
  2. Spend efficiency lens
  3. Customer mix lens
- Keep all alternatives factual and consistent with input metrics.

General rules:
- No recommendations.
- No em dash.
- No duplicated sentence across sections.
- Keep language concise and business-facing.
"""


class InsightsOutput(BaseModel):
    headline: str = Field(..., min_length=8)
    bullets: list[str] = Field(..., min_length=3, max_length=3)
    green_flag: str = Field(..., min_length=8)
    red_flag: str = Field(..., min_length=8)


class RagInsightsOutput(BaseModel):
    selected_response: InsightsOutput
    alternatives: list[InsightsOutput] = Field(default_factory=list)
    retrieval_ids: list[str] = Field(default_factory=list)


FALLBACK_RESPONSE: Dict[str, Any] = {
    "headline": "Insights temporarily unavailable",
    "bullets": [
        "The system could not generate insights at this time.",
        "Please check API configuration and try again.",
        "Using placeholder content.",
    ],
    "green_flag": "**Green flag:** System is configured and ready.",
    "red_flag": "**Red flag:** Insight generation encountered an error.",
}


RAG_EXEMPLARS: List[Dict[str, Any]] = [
    {
        "id": "uk-necklace-30d-growth",
        "region": "UK",
        "product": "Necklace",
        "period_days": 30,
        "expected_signs": {
            "revenue": 1,
            "orders": 1,
            "media_spend": 1,
            "aov": 0,
            "new_customers_pct": 1,
            "meta_roas": 1,
            "google_roas": 1,
            "spend_revenue_gap": 1,
        },
        "summary": (
            "Double-digit growth in revenue and orders while spend scaled at near-identical pace. "
            "Google ROAS improved more than Meta and held the larger share of budget."
        ),
        "green_flag": "Volume growth with stable AOV, indicating growth is coming from order expansion.",
        "red_flag": "ROAS gap widened as Google improved faster than Meta.",
    },
    {
        "id": "us-all-180d-contraction",
        "region": "US",
        "product": "All Products",
        "period_days": 180,
        "expected_signs": {
            "revenue": -1,
            "orders": -1,
            "media_spend": -1,
            "aov": 0,
            "new_customers_pct": 1,
            "meta_roas": 1,
            "google_roas": -1,
            "spend_revenue_gap": -1,
        },
        "summary": (
            "Revenue and orders declined while spend was cut more aggressively than topline decline. "
            "Platform efficiency showed mixed signal: Meta improved, Google was flat to down."
        ),
        "green_flag": "Meta ROAS was the only efficiency metric that improved in-period.",
        "red_flag": "Simultaneous decline across core volume and spend metrics.",
    },
    {
        "id": "all-earring-7d-mixed",
        "region": "All Markets",
        "product": "Earring",
        "period_days": 7,
        "expected_signs": {
            "revenue": 1,
            "orders": 1,
            "media_spend": -1,
            "aov": -1,
            "new_customers_pct": 1,
            "meta_roas": -1,
            "google_roas": -1,
            "spend_revenue_gap": -1,
        },
        "summary": (
            "Orders and acquisition rose while spend declined and AOV compressed. "
            "Both platform ROAS values softened, with a steeper drop on Meta."
        ),
        "green_flag": "More order volume generated while media spend decreased.",
        "red_flag": "AOV decline compressed revenue conversion from order growth.",
    },
]


def _get_client() -> Optional[genai.Client]:
    """Create Gemini client lazily so runtime env changes are picked up."""
    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


def _format_change(value: float) -> str:
    """Format % change with +/- prefix."""
    return f"+{value}" if value >= 0 else str(value)


def _parse_numeric_value(raw_value: Any) -> float:
    """Parse compact strings like $267.4K, 3.07, 28.3%, 2,683."""
    if isinstance(raw_value, (int, float)):
        return float(raw_value)

    text = str(raw_value).strip().lower().replace(",", "")
    multiplier = 1.0
    if text.endswith("k"):
        multiplier = 1_000.0
        text = text[:-1]
    elif text.endswith("m"):
        multiplier = 1_000_000.0
        text = text[:-1]
    elif text.endswith("b"):
        multiplier = 1_000_000_000.0
        text = text[:-1]

    text = text.replace("$", "").replace("%", "").strip()
    text = re.sub(r"[^0-9.+-]", "", text)
    if text in {"", "+", "-", ".", "+.", "-."}:
        return 0.0
    try:
        return float(text) * multiplier
    except ValueError:
        return 0.0


def _sign(value: float, neutral_band: float = 0.3) -> int:
    if value > neutral_band:
        return 1
    if value < -neutral_band:
        return -1
    return 0


def _extract_days(period: str) -> Optional[int]:
    match = re.search(r"(\d+)", period or "")
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def _normalize_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


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


def _build_query_profile(
    metrics_data: Dict[str, Any],
    region: str,
    product: str,
    period: str,
) -> Dict[str, Any]:
    changes = {
        key: float(metrics_data[key]["change_percent"])
        for key in [
            "revenue",
            "orders",
            "media_spend",
            "aov",
            "new_customers_pct",
            "meta_roas",
            "google_roas",
        ]
    }
    changes["spend_revenue_gap"] = changes["media_spend"] - changes["revenue"]

    return {
        "region": region,
        "product": product,
        "period": period,
        "period_days": _extract_days(period),
        "changes": changes,
        "signs": {key: _sign(value) for key, value in changes.items()},
    }


def _score_exemplar(exemplar: Dict[str, Any], profile: Dict[str, Any]) -> float:
    score = 0.0

    query_region = _normalize_token(profile["region"])
    query_product = _normalize_token(profile["product"])
    exemplar_region = _normalize_token(exemplar["region"])
    exemplar_product = _normalize_token(exemplar["product"])

    if query_region == exemplar_region:
        score += 2.5
    elif exemplar_region == _normalize_token("All Markets") or query_region == _normalize_token("All Markets"):
        score += 0.8

    if query_product == exemplar_product:
        score += 2.0
    elif exemplar_product == _normalize_token("All Products") or query_product == _normalize_token("All Products"):
        score += 0.8

    query_days = profile.get("period_days")
    exemplar_days = exemplar.get("period_days")
    if query_days is not None and exemplar_days is not None:
        gap = abs(query_days - exemplar_days)
        if gap == 0:
            score += 1.5
        elif gap <= 23:
            score += 1.0
        elif gap <= 90:
            score += 0.4

    expected_signs: Dict[str, int] = exemplar.get("expected_signs", {})
    for metric_key, expected_sign in expected_signs.items():
        actual_sign = profile["signs"].get(metric_key, 0)
        if actual_sign == expected_sign:
            score += 1.0
        elif expected_sign == 0 and abs(profile["changes"].get(metric_key, 0.0)) <= 1.2:
            score += 0.7
        elif actual_sign == 0:
            score += 0.2
        else:
            score -= 0.4

    return score


def _retrieve_examples(
    metrics_data: Dict[str, Any],
    region: str,
    product: str,
    period: str,
    top_k: int = 2,
) -> List[Dict[str, Any]]:
    profile = _build_query_profile(metrics_data, region, product, period)
    scored = [
        (exemplar, _score_exemplar(exemplar, profile))
        for exemplar in RAG_EXEMPLARS
    ]
    scored.sort(key=lambda item: item[1], reverse=True)
    return [item[0] for item in scored[:top_k]]


def _build_rag_input_text(
    metrics_data: Dict[str, Any],
    region: str,
    product: str,
    period: str,
    retrieved_examples: List[Dict[str, Any]],
) -> str:
    compact_metrics = _build_input_text(metrics_data, region, product, period)
    example_blocks = []
    for example in retrieved_examples:
        example_blocks.append(
            "\n".join(
                [
                    f"id={example['id']}",
                    f"context={example['region']}|{example['product']}|{example['period_days']}d",
                    f"pattern={example['summary']}",
                    f"green_style={example['green_flag']}",
                    f"red_style={example['red_flag']}",
                ]
            )
        )

    examples_text = "\n\n".join(example_blocks) if example_blocks else "none"
    return (
        f"COMPACT_METRICS\n{compact_metrics}\n\n"
        f"RETRIEVED_EXAMPLES\n{examples_text}"
    )


def _ensure_three_variants(primary: Dict[str, Any], candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized_primary = InsightsOutput.model_validate(primary).model_dump()
    variants: List[Dict[str, Any]] = [normalized_primary]

    for candidate in candidates:
        if len(variants) >= 3:
            break
        if not isinstance(candidate, dict):
            continue
        try:
            normalized = InsightsOutput.model_validate(candidate).model_dump()
        except ValidationError:
            continue
        if normalized["headline"] == normalized_primary["headline"] and normalized["bullets"] == normalized_primary["bullets"]:
            continue
        variants.append(normalized)

    # Deterministic backfill if model returned fewer than 3 alternatives.
    while len(variants) < 3:
        synthetic = deepcopy(normalized_primary)
        synthetic["headline"] = f"{normalized_primary['headline']} (variant {len(variants) + 1})"
        if len(variants) == 1:
            synthetic["bullets"] = [normalized_primary["bullets"][1], normalized_primary["bullets"][0], normalized_primary["bullets"][2]]
        else:
            synthetic["bullets"] = [normalized_primary["bullets"][2], normalized_primary["bullets"][0], normalized_primary["bullets"][1]]
        variants.append(synthetic)

    return variants[:3]


def _normalize_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    if "selected_response" in payload:
        rag_output = RagInsightsOutput.model_validate(payload)
        selected = rag_output.selected_response.model_dump()
        alternatives = [item.model_dump() for item in rag_output.alternatives]
        variants = _ensure_three_variants(selected, alternatives)
        retrieval_examples = rag_output.retrieval_ids[:2]
        return {
            **selected,
            "variants": variants,
            "retrieval_examples": retrieval_examples,
            "rag_scope": "3-seed-exemplar-rag-v1",
        }

    # Backward-compatible payload shape
    selected = InsightsOutput.model_validate(payload).model_dump()
    return {
        **selected,
        "variants": _ensure_three_variants(selected, []),
        "retrieval_examples": [],
        "rag_scope": "legacy-single-response",
    }


def _parse_response(response: Any) -> Dict[str, Any]:
    """Extract and validate JSON from Gemini response."""
    parsed_payload = getattr(response, "parsed", None)
    if parsed_payload is not None:
        if isinstance(parsed_payload, BaseModel):
            parsed_payload = parsed_payload.model_dump()
        if isinstance(parsed_payload, dict):
            return _normalize_payload(parsed_payload)

    text = (getattr(response, "text", "") or "").strip()

    if "```json" in text:
        text = text[text.find("```json") + 7 :]
        text = text[: text.find("```")].strip()
    elif "```" in text:
        text = text[text.find("```") + 3 :]
        text = text[: text.find("```")].strip()

    parsed_payload = json.loads(text)
    if not isinstance(parsed_payload, dict):
        raise ValueError("Gemini response JSON root must be an object")
    return _normalize_payload(parsed_payload)


def _build_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        systemInstruction=SYSTEM_PROMPT,
        temperature=0.2,
        responseMimeType="application/json",
        responseSchema=RagInsightsOutput,
    )


def _fallback_with_variants(message: Optional[str] = None) -> Dict[str, Any]:
    primary = dict(FALLBACK_RESPONSE)
    if message:
        primary["headline"] = message
    variants = _ensure_three_variants(primary, [])
    return {
        **primary,
        "variants": variants,
        "retrieval_examples": [],
        "rag_scope": "fallback",
    }


def generate_insights(
    metrics_data: Dict[str, Any],
    region: str = "All Markets",
    product: str = "All Products",
    period: str = "30d",
) -> Dict[str, Any]:
    """Generate AI insights using Gemini + 3-seed exemplar retrieval."""
    client = _get_client()
    if not client:
        logger.warning("Gemini API key not configured")
        return _fallback_with_variants("API key not configured. Add GEMINI_API_KEY to backend/.env file.")

    retrieved_examples = _retrieve_examples(metrics_data, region, product, period, top_k=2)
    retrieved_ids = [example["id"] for example in retrieved_examples]
    input_text = _build_rag_input_text(metrics_data, region, product, period, retrieved_examples)
    config = _build_config()

    last_text = ""
    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[input_text],
                config=config,
            )
            last_text = (getattr(response, "text", "") or "")[:600]
            result = _parse_response(response)

            # Enforce retrieval IDs from backend scoring when model omits them.
            if not result.get("retrieval_examples"):
                result["retrieval_examples"] = retrieved_ids
            result["variants"] = _ensure_three_variants(result, result.get("variants", [])[1:])
            logger.info("Insights generated successfully with RAG examples: %s", ",".join(result["retrieval_examples"]))
            return result
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            logger.warning("Attempt %s/2 parse-validation failed: %s", attempt + 1, exc)
            if last_text:
                logger.warning("Raw response snippet: %s", last_text)
        except Exception as exc:
            logger.error("Attempt %s/2 insight generation failed: %s", attempt + 1, exc, exc_info=True)

    return _fallback_with_variants()
