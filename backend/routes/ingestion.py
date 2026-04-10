from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


SourceKey = Literal["google_ads", "google_analytics", "meta_ads", "shopify", "amazon_ads"]


class AccountOption(BaseModel):
    id: str
    label: str
    detail: str


class TemplateOption(BaseModel):
    key: str
    label: str
    description: str
    required_columns: List[str]
    optional_columns: List[str]


class SourceConfig(BaseModel):
    label: str
    description: str
    accounts: List[AccountOption]
    templates: List[TemplateOption]


SOURCE_CONFIGS: Dict[SourceKey, SourceConfig] = {
    "google_ads": SourceConfig(
        label="Google Ads",
        description="Search, shopping, and campaign exports for paid media performance.",
        accounts=[
            AccountOption(id="gads-search-main", label="Search Main", detail="Core acquisition account"),
            AccountOption(id="gads-brand-defense", label="Brand Defense", detail="Brand and conquesting"),
            AccountOption(id="gads-performance-max", label="Performance Max", detail="Automated product feed account"),
        ],
        templates=[
            TemplateOption(
                key="search_export",
                label="Search Export",
                description="Proxy format for standard search campaign reporting.",
                required_columns=["date", "campaign_name", "impressions", "clicks", "spend", "conversions", "revenue"],
                optional_columns=["ad_group", "keyword", "match_type", "device", "region"],
            ),
            TemplateOption(
                key="shopping_export",
                label="Shopping Export",
                description="Proxy format for shopping feed and product level reporting.",
                required_columns=["date", "campaign_name", "item_id", "impressions", "clicks", "spend", "conversions", "revenue"],
                optional_columns=["feed_label", "merchant_id", "device", "region"],
            ),
            TemplateOption(
                key="pmax_export",
                label="Performance Max",
                description="Proxy format for asset-group based exports.",
                required_columns=["date", "campaign_name", "asset_group", "impressions", "clicks", "spend", "conversions", "revenue"],
                optional_columns=["audience", "campaign_id", "device", "region"],
            ),
        ],
    ),
    "google_analytics": SourceConfig(
        label="Google Analytics",
        description="Traffic, engagement, and conversion exports for web analytics.",
        accounts=[
            AccountOption(id="ga-primary-property", label="Primary Property", detail="Main GA4 property"),
            AccountOption(id="ga-ecommerce-property", label="Ecommerce Property", detail="Store and checkout behavior"),
            AccountOption(id="ga-content-property", label="Content Property", detail="Landing page and content signals"),
        ],
        templates=[
            TemplateOption(
                key="acquisition_export",
                label="Acquisition Export",
                description="Proxy format for traffic source and session reporting.",
                required_columns=["date", "source_medium", "sessions", "users", "engaged_sessions", "conversions", "revenue"],
                optional_columns=["landing_page", "campaign", "device_category", "country"],
            ),
            TemplateOption(
                key="funnel_export",
                label="Funnel Export",
                description="Proxy format for event and funnel analysis.",
                required_columns=["date", "event_name", "sessions", "events", "engaged_sessions", "conversions", "revenue"],
                optional_columns=["landing_page", "source_medium", "device_category", "country"],
            ),
            TemplateOption(
                key="content_export",
                label="Content Export",
                description="Proxy format for page and content performance.",
                required_columns=["date", "page_path", "views", "users", "avg_engagement_time", "conversions", "revenue"],
                optional_columns=["source_medium", "device_category", "country", "landing_page"],
            ),
        ],
    ),
    "meta_ads": SourceConfig(
        label="Meta Ads",
        description="Paid social exports with business manager and account-level views.",
        accounts=[
            AccountOption(id="meta-business-main", label="Business Main", detail="Primary acquisition business"),
            AccountOption(id="meta-catalog-retargeting", label="Catalog Retargeting", detail="Dynamic product remarketing"),
            AccountOption(id="meta-advantage-plus", label="Advantage Plus", detail="Automation focused account"),
            AccountOption(id="meta-app-install", label="App Install", detail="App growth and retention campaigns"),
        ],
        templates=[
            TemplateOption(
                key="prospecting_export",
                label="Prospecting Export",
                description="Proxy format for upper funnel campaign reporting.",
                required_columns=["date", "campaign_name", "adset_name", "impressions", "clicks", "spend", "purchases", "revenue"],
                optional_columns=["reach", "frequency", "placement", "country"],
            ),
            TemplateOption(
                key="retargeting_export",
                label="Retargeting Export",
                description="Proxy format for audience retargeting reporting.",
                required_columns=["date", "campaign_name", "ad_name", "impressions", "clicks", "spend", "purchases", "revenue"],
                optional_columns=["adset_name", "reach", "frequency", "country"],
            ),
            TemplateOption(
                key="advantage_export",
                label="Advantage Plus",
                description="Proxy format for automated campaign exports.",
                required_columns=["date", "campaign_name", "creative_name", "impressions", "clicks", "spend", "purchases", "revenue"],
                optional_columns=["adset_name", "reach", "frequency", "country"],
            ),
        ],
    ),
    "shopify": SourceConfig(
        label="Shopify",
        description="Commerce exports for sales, products, and discount tracking.",
        accounts=[
            AccountOption(id="shopify-usa-store", label="USA Store", detail="Primary US storefront"),
            AccountOption(id="shopify-uk-store", label="UK Store", detail="UK storefront"),
        ],
        templates=[
            TemplateOption(
                key="sales_export",
                label="Sales Export",
                description="Proxy format for orders, sales, and channel mix.",
                required_columns=["date", "order_id", "net_sales", "orders", "discounts", "product_title", "channel"],
                optional_columns=["customer_type", "sku", "quantity", "region"],
            ),
            TemplateOption(
                key="product_export",
                label="Product Export",
                description="Proxy format for product and SKU level reporting.",
                required_columns=["date", "product_title", "sku", "quantity", "net_sales", "orders", "channel"],
                optional_columns=["customer_type", "region", "discounts", "collection"],
            ),
            TemplateOption(
                key="discount_export",
                label="Discount Export",
                description="Proxy format for promotion and discount tracking.",
                required_columns=["date", "order_id", "discount_code", "discounts", "net_sales", "orders", "channel"],
                optional_columns=["customer_type", "sku", "region", "product_title"],
            ),
        ],
    ),
    "amazon_ads": SourceConfig(
        label="Amazon Ads",
        description="Sponsored products, brands, and display exports for marketplace media.",
        accounts=[
            AccountOption(id="amazon-us-seller", label="US Seller Central", detail="Main US marketplace account"),
            AccountOption(id="amazon-eu-vendor", label="EU Vendor Central", detail="Vendor managed account"),
            AccountOption(id="amazon-global-brand", label="Global Brand", detail="Brand protection and retargeting"),
        ],
        templates=[
            TemplateOption(
                key="sponsored_products",
                label="Sponsored Products",
                description="Proxy format for product-level marketplace exports.",
                required_columns=["date", "campaign_name", "keyword", "impressions", "clicks", "spend", "orders", "revenue"],
                optional_columns=["asin", "match_type", "device", "region"],
            ),
            TemplateOption(
                key="sponsored_brands",
                label="Sponsored Brands",
                description="Proxy format for brand-level Amazon exports.",
                required_columns=["date", "campaign_name", "ad_group", "impressions", "clicks", "spend", "orders", "revenue"],
                optional_columns=["asin", "keyword", "device", "region"],
            ),
            TemplateOption(
                key="sponsored_display",
                label="Sponsored Display",
                description="Proxy format for display and retargeting exports.",
                required_columns=["date", "campaign_name", "asin", "impressions", "clicks", "spend", "orders", "revenue"],
                optional_columns=["placement", "audience", "device", "region"],
            ),
            TemplateOption(
                key="sales_summary",
                label="Sales Summary",
                description="Proxy format for product sales and order totals.",
                required_columns=["date", "asin", "product_title", "orders", "revenue", "quantity", "channel"],
                optional_columns=["customer_type", "region", "discounts"],
            ),
            TemplateOption(
                key="sales_detail",
                label="Sales Detail",
                description="Proxy format for order-level sales reporting.",
                required_columns=["date", "order_id", "asin", "product_title", "orders", "revenue", "channel"],
                optional_columns=["customer_type", "sku", "region", "quantity"],
            ),
            TemplateOption(
                key="promo_sales",
                label="Promo Sales",
                description="Proxy format for promotional sales analysis.",
                required_columns=["date", "product_title", "discount_code", "orders", "revenue", "quantity", "channel"],
                optional_columns=["asin", "customer_type", "region"],
            ),
        ],
    ),
}


class IngestionRequest(BaseModel):
    source: SourceKey
    template_key: str
    account_id: str
    start_date: date
    end_date: date
    columns: List[str] = Field(default_factory=list)


class IngestionResponse(BaseModel):
    ingestion_id: str
    source: SourceKey
    source_label: str
    template_key: str
    template_label: str
    account_id: str
    account_label: str
    status: str
    start_date: str
    end_date: str
    row_count: int
    column_count: int
    requested_columns: List[str]
    required_columns: List[str]
    optional_columns: List[str]
    preview_rows: List[Dict[str, Any]]
    columns: List[Dict[str, str]]
    key_metrics: Dict[str, float]
    warnings: List[str]
    notes: List[str]
    column_groups: Dict[str, List[str]]
    received_at: str
    download_filename: str


router = APIRouter(tags=["ingestion"])


def _column_type(name: str) -> str:
    lower = name.lower()
    if lower in {"date", "start_date", "end_date"} or "date" in lower or "time" in lower:
        return "datetime"
    if "id" in lower or lower in {"asin", "sku"}:
        return "id"
    if any(
        token in lower
        for token in [
            "spend",
            "revenue",
            "sales",
            "orders",
            "click",
            "impression",
            "session",
            "user",
            "conversion",
            "purchase",
            "discount",
            "frequency",
            "reach",
            "quantity",
            "views",
            "events",
            "engaged",
            "avg_engagement",
        ]
    ):
        return "numeric"
    return "categorical"


def _numeric_value(name: str, row_index: int) -> float:
    lower = name.lower()
    if "spend" in lower:
        return round(120 + (row_index % 12) * 14.5, 2)
    if "revenue" in lower or "sales" in lower:
        return round(300 + (row_index % 12) * 28.9, 2)
    if "orders" in lower or "purchases" in lower or "conversions" in lower:
        return float(20 + (row_index % 9) * 3)
    if "click" in lower:
        return float(180 + (row_index % 15) * 9)
    if "impression" in lower:
        return float(2500 + (row_index % 15) * 120)
    if "session" in lower or "views" in lower or "events" in lower:
        return float(420 + (row_index % 12) * 31)
    if "user" in lower or "engaged" in lower:
        return float(260 + (row_index % 10) * 21)
    if "discount" in lower:
        return round(10 + (row_index % 6) * 1.5, 2)
    if "frequency" in lower:
        return round(1.2 + (row_index % 5) * 0.1, 2)
    if "reach" in lower:
        return float(1200 + (row_index % 13) * 70)
    if "quantity" in lower:
        return float(1 + (row_index % 4))
    if "avg_engagement" in lower:
        return round(45 + (row_index % 11) * 3.5, 1)
    return float(50 + (row_index % 9) * 5)


def _text_value(source: SourceKey, template_key: str, name: str, row_index: int) -> str:
    source_label = SOURCE_CONFIGS[source].label
    lower = name.lower()
    if "campaign" in lower and "id" in lower:
        return f"CMP-{source_label[:3].upper()}-{row_index:04d}"
    if "campaign" in lower:
        return f"{source_label} Campaign {row_index % 8 + 1}"
    if "adset" in lower or "ad_set" in lower:
        return f"Ad Set {row_index % 6 + 1}"
    if "ad_group" in lower or lower == "ad group":
        return f"Ad Group {row_index % 5 + 1}"
    if "keyword" in lower:
        return ["brand keyword", "non-brand keyword", "competitor keyword"][row_index % 3]
    if "match_type" in lower:
        return ["broad", "phrase", "exact"][row_index % 3]
    if "source_medium" in lower:
        return "paid / cpc"
    if "event_name" in lower:
        return ["view_item", "add_to_cart", "begin_checkout", "purchase"][row_index % 4]
    if "page_path" in lower:
        return ["/", "/collections/best-sellers", "/products/hero-serum", "/blogs/news"][row_index % 4]
    if "landing_page" in lower:
        return "/collections/best-sellers"
    if "device" in lower:
        return ["mobile", "desktop", "tablet"][row_index % 3]
    if "country" in lower or "region" in lower:
        return ["US", "GB", "IN", "CA"][row_index % 4]
    if "channel" in lower:
        return ["paid social", "organic", "email", "direct"][row_index % 4]
    if "customer_type" in lower:
        return ["new", "returning", "vip"][row_index % 3]
    if "product" in lower:
        return ["Hero Serum", "Daily Shampoo", "Repair Mask", "Volume Spray"][row_index % 4]
    if "creative" in lower:
        return ["Video A", "Carousel B", "Static C"][row_index % 3]
    if "asin" in lower:
        return f"B0{100000 + row_index}"
    if "discount_code" in lower:
        return f"SAVE{10 + (row_index % 4) * 5}"
    if "collection" in lower:
        return ["Hero", "Seasonal", "Clearance"][row_index % 3]
    if "placement" in lower:
        return ["feed", "stories", "reels", "audience network"][row_index % 4]
    if "audience" in lower:
        return ["prospecting", "retargeting", "lookalike"][row_index % 3]
    if "template" in lower:
        return template_key.replace("_", " ").title()
    if "sku" in lower:
        return f"SKU-{row_index:05d}"
    if "order_id" in lower:
        return f"ORD-{100000 + row_index}"
    return f"{source_label} {name.replace('_', ' ').title()} {row_index % 9 + 1}"


def _resolve_source_and_template(source: SourceKey, template_key: str) -> tuple[SourceConfig, TemplateOption]:
    config = SOURCE_CONFIGS.get(source)
    if not config:
        raise HTTPException(status_code=400, detail="Unsupported source.")

    template = next((item for item in config.templates if item.key == template_key), None)
    if not template:
        raise HTTPException(status_code=400, detail="Unsupported template.")

    return config, template


def _resolve_account(config: SourceConfig, account_id: str) -> AccountOption:
    account = next((item for item in config.accounts if item.id == account_id), None)
    if not account:
        raise HTTPException(status_code=400, detail="Unsupported account.")
    return account


@router.post("/ingest", response_model=IngestionResponse)
async def ingest_data(request: IngestionRequest) -> IngestionResponse:
    if request.start_date > request.end_date:
        raise HTTPException(status_code=400, detail="Start date must be on or before end date.")

    config, template = _resolve_source_and_template(request.source, request.template_key)
    account = _resolve_account(config, request.account_id)

    required_columns = list(template.required_columns)
    optional_columns = list(template.optional_columns)

    selected_columns = list(dict.fromkeys(request.columns))
    missing_columns = [column for column in required_columns if column not in selected_columns]
    if missing_columns:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing_columns)}")

    day_count = max((request.end_date - request.start_date).days + 1, 1)
    row_count = max(24, min(day_count * 4, 120))
    date_span = max(day_count - 1, 0)

    preview_rows: List[Dict[str, Any]] = []
    for index in range(row_count):
        offset = index % (date_span + 1 if date_span >= 0 else 1)
        current_date = request.start_date + timedelta(days=offset)
        row: Dict[str, Any] = {
            "date": current_date.isoformat(),
            "source": config.label,
            "template": template.label,
            "account": account.label,
            "ingestion_status": "synced",
        }

        for column in selected_columns:
            if column == "date":
                row[column] = current_date.isoformat()
            elif _column_type(column) == "numeric":
                row[column] = _numeric_value(column, index)
            else:
                row[column] = _text_value(request.source, template.key, column, index)

        preview_rows.append(row)

    unique_columns = list(dict.fromkeys(["source", "template", "account", "ingestion_status", *selected_columns]))
    column_meta = [{"name": column, "type": _column_type(column)} for column in unique_columns]

    key_metrics = {
        "spend": round(sum(_numeric_value("spend", i) for i in range(row_count)), 2),
        "revenue": round(sum(_numeric_value("revenue", i) for i in range(row_count)), 2),
        "conversions": round(sum(_numeric_value("conversions", i) for i in range(row_count)), 2),
        "orders": round(sum(_numeric_value("orders", i) for i in range(row_count)), 2),
    }

    warnings: List[str] = []
    if day_count > 90:
        warnings.append("Long date range detected. Returning a compact preview batch for the demo workspace.")

    notes = [
        f"{config.label} data prepared for {account.label}.",
        f"Template {template.label} validated with {len(selected_columns)} selected columns.",
        "Preview batch generated successfully and is ready for downstream reporting.",
    ]

    download_filename = (
        f"{request.source}_{template.key}_{account.id}_{request.start_date.isoformat()}_to_{request.end_date.isoformat()}.xlsx"
    ).replace(" ", "_")

    return IngestionResponse(
        ingestion_id=f"ING-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        source=request.source,
        source_label=config.label,
        template_key=template.key,
        template_label=template.label,
        account_id=account.id,
        account_label=account.label,
        status="completed",
        start_date=request.start_date.isoformat(),
        end_date=request.end_date.isoformat(),
        row_count=row_count,
        column_count=len(unique_columns),
        requested_columns=selected_columns,
        required_columns=required_columns,
        optional_columns=optional_columns,
        preview_rows=preview_rows,
        columns=column_meta,
        key_metrics=key_metrics,
        warnings=warnings,
        notes=notes,
        column_groups={
            "required": required_columns,
            "optional": optional_columns,
            "selected": selected_columns,
        },
        received_at=datetime.utcnow().isoformat() + "Z",
        download_filename=download_filename,
    )
