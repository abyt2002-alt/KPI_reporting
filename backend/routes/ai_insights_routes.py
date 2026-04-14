"""
AI Insights API Routes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional

from services.ai_insights import generate_insights

router = APIRouter(prefix="/ai", tags=["ai-insights"])


class MetricValue(BaseModel):
    value: str
    change_percent: float


class InsightsRequest(BaseModel):
    revenue: MetricValue
    orders: MetricValue
    media_spend: MetricValue
    google_spend: MetricValue
    aov: MetricValue
    new_customers_pct: MetricValue
    meta_roas: MetricValue
    google_roas: MetricValue
    region: Optional[str] = None
    product: Optional[str] = None
    period: Optional[str] = None


class InsightsResponse(BaseModel):
    headline: str
    bullets: list[str]
    green_flag: str
    red_flag: str
    variants: Optional[list[Dict[str, Any]]] = None
    retrieval_examples: Optional[list[str]] = None
    rag_scope: Optional[str] = None


@router.post("/generate-insights", response_model=InsightsResponse)
async def generate_ai_insights(request: InsightsRequest) -> InsightsResponse:
    """
    Generate AI-powered insights based on 8 KPI metrics (16 values total)
    """
    try:
        # Convert request to dict
        metrics_data = {
            "revenue": {"value": request.revenue.value, "change_percent": request.revenue.change_percent},
            "orders": {"value": request.orders.value, "change_percent": request.orders.change_percent},
            "media_spend": {"value": request.media_spend.value, "change_percent": request.media_spend.change_percent},
            "google_spend": {"value": request.google_spend.value, "change_percent": request.google_spend.change_percent},
            "aov": {"value": request.aov.value, "change_percent": request.aov.change_percent},
            "new_customers_pct": {"value": request.new_customers_pct.value, "change_percent": request.new_customers_pct.change_percent},
            "meta_roas": {"value": request.meta_roas.value, "change_percent": request.meta_roas.change_percent},
            "google_roas": {"value": request.google_roas.value, "change_percent": request.google_roas.change_percent},
        }
        
        # Generate insights
        result = generate_insights(
            metrics_data,
            region=(request.region or "All Markets"),
            product=(request.product or "All Products"),
            period=(request.period or "30d"),
        )
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to generate insights")
        
        return InsightsResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating insights: {str(e)}")
