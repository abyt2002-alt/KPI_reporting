import { useMemo, useState } from "react";
import {
  BarChart3,
  DollarSign,
  Megaphone,
  Search,
  ShoppingCart,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import shopifyImage from "../../image_resources/shopify.jpg";
import googleAnalyticsImage from "../../image_resources/ga.jpg";
import amazonImage from "../../image_resources/amazon.jpg";
import metaAdsImage from "../../image_resources/meta ads.jpg";
import { useStore } from "../store/useStore";
import type { SummaryTimeRange } from "../store/useStore";
import { FY25_END_DATE, FY25_START_DATE } from "./summaryConfig";

type Market = "US" | "UK" | "UAE";
type DetailTab = "bars" | "comparison" | "breakdown";
type MetricKind = "currency" | "integer" | "percent" | "ratio" | "duration";
type PlatformView = "shopify" | "ga" | "meta" | "amazon";
type MetricKey =
  | "revenue"
  | "orders"
  | "media_spend"
  | "google_spend"
  | "aov"
  | "new_customers_pct"
  | "meta_roas"
  | "google_roas";

interface DailyMarketRow {
  date: string;
  market: Market;
  revenue: number;
  orders: number;
  mediaSpend: number;
  googleSpend: number;
  metaSpend: number;
  googleRevenue: number;
  metaRevenue: number;
  newCustomers: number;
}

interface MetricDefinition {
  key: MetricKey;
  label: string;
  subtitle: string;
  kind: MetricKind;
  icon: LucideIcon;
  accent: string;
}

interface MetricTotals {
  revenue: number;
  orders: number;
  mediaSpend: number;
  googleSpend: number;
  metaSpend: number;
  googleRevenue: number;
  metaRevenue: number;
  newCustomers: number;
}

interface BreakdownItem {
  label: string;
  value: number;
  kind: MetricKind;
  tone?: "default" | "negative" | "positive";
}

interface DailyMetricPoint {
  date: string;
  label: string;
  revenue: number;
  orders: number;
  media_spend: number;
  google_spend: number;
  aov: number;
  new_customers_pct: number;
  meta_roas: number;
  google_roas: number;
}

interface PlatformMetricDefinition {
  id: string;
  label: string;
  kind: MetricKind;
  accent: string;
  rollup?: "sum" | "avg";
  compute: (point: DailyMetricPoint) => number;
}

interface PlatformMetricCard extends PlatformMetricDefinition {
  value: number;
  trend: number | null;
  sparkline: Array<{ label: string; value: number }>;
}

interface PlatformOption {
  id: PlatformView;
  label: string;
  image: string;
}

const TIME_RANGE_DAYS: Partial<Record<SummaryTimeRange, number>> = {
  last_7: 7,
  last_13: 13,
  last_30: 30,
  last_90: 90,
  last_180: 180,
  last_365: 365,
};

const PLATFORM_OPTIONS: PlatformOption[] = [
  { id: "shopify", label: "Shopify", image: shopifyImage },
  { id: "ga", label: "Google Analytics", image: googleAnalyticsImage },
  { id: "meta", label: "Meta Ads", image: metaAdsImage },
  { id: "amazon", label: "Amazon", image: amazonImage },
];

const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "revenue", label: "Revenue", subtitle: "Total sales", kind: "currency", icon: DollarSign, accent: "#0ea5e9" },
  { key: "orders", label: "Orders", subtitle: "Placed orders", kind: "integer", icon: ShoppingCart, accent: "#22c55e" },
  { key: "media_spend", label: "Media Spend", subtitle: "Total ad spend", kind: "currency", icon: Megaphone, accent: "#f59e0b" },
  { key: "google_spend", label: "Google Spend", subtitle: "Google channel spend", kind: "currency", icon: Search, accent: "#3b82f6" },
  { key: "aov", label: "AOV", subtitle: "Average order value", kind: "currency", icon: Wallet, accent: "#8b5cf6" },
  { key: "new_customers_pct", label: "New Customers %", subtitle: "New customer share", kind: "percent", icon: Users, accent: "#10b981" },
  { key: "meta_roas", label: "Meta ROAS", subtitle: "Meta return on ad spend", kind: "ratio", icon: Target, accent: "#14b8a6" },
  { key: "google_roas", label: "Google ROAS", subtitle: "Google return on ad spend", kind: "ratio", icon: BarChart3, accent: "#06b6d4" },
];

const MARKET_SCALE: Record<Market, number> = {
  US: 1.42,
  UK: 1,
  UAE: 0.84,
};

const DETAIL_TAB_LABELS: Array<{ key: DetailTab; label: string }> = [
  { key: "bars", label: "Trend" },
  { key: "comparison", label: "Lagged" },
  { key: "breakdown", label: "Components" },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const seededNoise = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const roundCurrency = (value: number) => Number(value.toFixed(2));

const safeDivide = (numerator: number, denominator: number) => (denominator === 0 ? 0 : numerator / denominator);

const formatDayLabel = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatCurrencyCompact = (value: number) => {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

const formatValueByKind = (kind: MetricKind, value: number) => {
  if (kind === "currency") return formatCurrencyCompact(value);
  if (kind === "integer") return Math.round(value).toLocaleString("en-US");
  if (kind === "percent") return `${value.toFixed(1)}%`;
  if (kind === "duration") {
    const totalSeconds = Math.max(0, Math.round(value));
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }
  return value.toFixed(2);
};

const formatMetricValue = (definition: MetricDefinition, value: number) => formatValueByKind(definition.kind, value);
const formatTooltipValue = (definition: MetricDefinition, value: unknown) => {
  const scalarValue = Array.isArray(value) ? value[0] : value;
  const numericValue = typeof scalarValue === "number" ? scalarValue : Number(scalarValue);
  if (Number.isNaN(numericValue)) return String(value);
  if (definition.kind === "currency") return formatValueByKind(definition.kind, Number(numericValue.toFixed(2)));
  if (definition.kind === "percent" || definition.kind === "ratio") return formatValueByKind(definition.kind, Number(numericValue.toFixed(2)));
  if (definition.kind === "integer") return formatValueByKind(definition.kind, Math.round(numericValue));
  if (definition.kind === "duration") return formatValueByKind(definition.kind, Math.round(numericValue));
  return Number(numericValue.toFixed(2)).toString();
};

const aggregateTotals = (rows: DailyMarketRow[]): MetricTotals => ({
  revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
  orders: rows.reduce((sum, row) => sum + row.orders, 0),
  mediaSpend: rows.reduce((sum, row) => sum + row.mediaSpend, 0),
  googleSpend: rows.reduce((sum, row) => sum + row.googleSpend, 0),
  metaSpend: rows.reduce((sum, row) => sum + row.metaSpend, 0),
  googleRevenue: rows.reduce((sum, row) => sum + row.googleRevenue, 0),
  metaRevenue: rows.reduce((sum, row) => sum + row.metaRevenue, 0),
  newCustomers: rows.reduce((sum, row) => sum + row.newCustomers, 0),
});

const calculateMetricValue = (key: MetricKey, rows: DailyMarketRow[]) => {
  const totals = aggregateTotals(rows);
  if (key === "revenue") return totals.revenue;
  if (key === "orders") return totals.orders;
  if (key === "media_spend") return totals.mediaSpend;
  if (key === "google_spend") return totals.googleSpend;
  if (key === "aov") return safeDivide(totals.revenue, totals.orders);
  if (key === "new_customers_pct") return safeDivide(totals.newCustomers, totals.orders) * 100;
  if (key === "meta_roas") return safeDivide(totals.metaRevenue, totals.metaSpend);
  return safeDivide(totals.googleRevenue, totals.googleSpend);
};

const buildDailyMetricPoint = (date: string, rows: DailyMarketRow[]): DailyMetricPoint => ({
  date,
  label: formatDayLabel(date),
  revenue: calculateMetricValue("revenue", rows),
  orders: calculateMetricValue("orders", rows),
  media_spend: calculateMetricValue("media_spend", rows),
  google_spend: calculateMetricValue("google_spend", rows),
  aov: calculateMetricValue("aov", rows),
  new_customers_pct: calculateMetricValue("new_customers_pct", rows),
  meta_roas: calculateMetricValue("meta_roas", rows),
  google_roas: calculateMetricValue("google_roas", rows),
});

const buildDateToRowsMap = (rows: DailyMarketRow[]) => {
  const map = new Map<string, DailyMarketRow[]>();
  rows.forEach((row) => {
    const existing = map.get(row.date);
    if (existing) {
      existing.push(row);
      return;
    }
    map.set(row.date, [row]);
  });
  return map;
};

const sampleSeries = (values: Array<{ label: string; value: number }>, maxPoints: number) => {
  if (values.length <= maxPoints) return values;
  const step = values.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, index) => values[Math.floor(index * step)]);
};

const sampleObjects = <T,>(values: T[], maxPoints: number) => {
  if (values.length <= maxPoints) return values;
  const step = values.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, index) => values[Math.floor(index * step)]);
};

const getIsoDatesBetween = (startIso: string, endIso: string) => {
  const output: string[] = [];
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return output;
  const cursor = new Date(start);
  while (cursor <= end) {
    output.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return output;
};

const estimateSessions = (point: DailyMetricPoint) => point.orders * 7.6 + 620;
const estimateUsers = (point: DailyMetricPoint) => estimateSessions(point) * 0.68;
const estimateAddToCartSessions = (point: DailyMetricPoint) => estimateSessions(point) * (0.028 + point.new_customers_pct / 700);
const estimateAmazonSpend = (point: DailyMetricPoint) => point.media_spend * 0.24;
const estimateAmazonSales = (point: DailyMetricPoint) => point.revenue * 0.2;
const estimateAmazonOrders = (point: DailyMetricPoint) => point.orders * 0.18;
const estimateAmazonClicks = (point: DailyMetricPoint) => estimateAmazonOrders(point) * 14.2;
const estimateAmazonImpressions = (point: DailyMetricPoint) => estimateAmazonClicks(point) * 18.5;
const estimateMetaSpend = (point: DailyMetricPoint) => Math.max(0, point.media_spend - point.google_spend);
const estimateMetaRevenue = (point: DailyMetricPoint) => estimateMetaSpend(point) * point.meta_roas;
const estimateMetaClicks = (point: DailyMetricPoint) => estimateMetaSpend(point) * 5.6;
const estimateMetaImpressions = (point: DailyMetricPoint) => estimateMetaClicks(point) * 16.4;

const SHOPIFY_PLATFORM_METRICS: PlatformMetricDefinition[] = [
  { id: "shopify_order_revenue", label: "Order Revenue", kind: "currency", accent: "#10b981", compute: (point) => point.revenue * 0.92 },
  { id: "shopify_orders", label: "Orders", kind: "integer", accent: "#06b6d4", compute: (point) => point.orders * 0.94 },
  { id: "shopify_returns", label: "Returns", kind: "currency", accent: "#f97316", compute: (point) => point.revenue * 0.12 },
  { id: "shopify_taxes", label: "Taxes", kind: "currency", accent: "#6366f1", compute: (point) => point.revenue * 0.05 },
  { id: "shopify_true_aov", label: "True AOV", kind: "currency", accent: "#0ea5e9", compute: (point) => safeDivide(point.revenue * 0.92, point.orders * 0.94) },
  { id: "shopify_avg_order_value", label: "Average Order Value", kind: "currency", accent: "#14b8a6", compute: (point) => point.aov * 0.98 },
  { id: "shopify_new_customers", label: "New Customers", kind: "percent", accent: "#22c55e", compute: (point) => point.new_customers_pct },
  { id: "shopify_gross_sales", label: "Gross Sales", kind: "currency", accent: "#0284c7", compute: (point) => point.revenue * 1.06 },
  { id: "shopify_returning_customers", label: "Returning Customers", kind: "percent", accent: "#64748b", compute: (point) => 100 - point.new_customers_pct },
  { id: "shopify_orders_gt_zero", label: "Orders > $0", kind: "integer", accent: "#16a34a", compute: (point) => Math.max(0, point.orders - 1) },
  { id: "shopify_new_customer_orders", label: "New Customer Orders", kind: "integer", accent: "#0d9488", compute: (point) => (point.orders * point.new_customers_pct) / 100 },
  { id: "shopify_units_sold", label: "Units Sold", kind: "integer", accent: "#f59e0b", compute: (point) => point.orders * 1.2 },
];

const GA_PLATFORM_METRICS: PlatformMetricDefinition[] = [
  { id: "ga_conversion_rate", label: "Conversion Rate", kind: "percent", accent: "#10b981", compute: (point) => safeDivide(point.orders, estimateSessions(point)) * 100 },
  { id: "ga_users", label: "Users", kind: "integer", accent: "#06b6d4", compute: (point) => estimateUsers(point) },
  { id: "ga_sessions", label: "Sessions", kind: "integer", accent: "#22c55e", compute: (point) => estimateSessions(point) },
  { id: "ga_pages_per_session", label: "Pages per Session", kind: "ratio", accent: "#3b82f6", rollup: "avg", compute: (point) => 1.35 + point.new_customers_pct / 140 },
  { id: "ga_session_duration", label: "Session Duration", kind: "duration", accent: "#0ea5e9", rollup: "avg", compute: (point) => 210 + point.new_customers_pct * 2.2 },
  { id: "ga_bounce_rate", label: "Bounce Rate", kind: "percent", accent: "#64748b", rollup: "avg", compute: (point) => 62 - point.new_customers_pct * 0.22 },
  { id: "ga_new_users", label: "New Users", kind: "integer", accent: "#14b8a6", compute: (point) => estimateUsers(point) * (point.new_customers_pct / 100) },
  { id: "ga_new_users_pct", label: "New Users %", kind: "percent", accent: "#10b981", rollup: "avg", compute: (point) => point.new_customers_pct },
  { id: "ga_sessions_add_to_cart", label: "Sessions with Add to Carts", kind: "integer", accent: "#06b6d4", compute: (point) => estimateAddToCartSessions(point) },
  { id: "ga_add_to_cart_pct", label: "Add to Cart %", kind: "percent", accent: "#3b82f6", rollup: "avg", compute: (point) => safeDivide(estimateAddToCartSessions(point), estimateSessions(point)) * 100 },
  { id: "ga_cost_per_add_to_cart", label: "Cost per Add to Cart", kind: "currency", accent: "#f59e0b", rollup: "avg", compute: (point) => safeDivide(point.media_spend, estimateAddToCartSessions(point)) },
  { id: "ga_cost_per_session", label: "Cost per Session", kind: "currency", accent: "#8b5cf6", rollup: "avg", compute: (point) => safeDivide(point.media_spend, estimateSessions(point)) },
];

const META_PLATFORM_METRICS: PlatformMetricDefinition[] = [
  { id: "meta_spend", label: "Meta Spend", kind: "currency", accent: "#0ea5e9", compute: (point) => estimateMetaSpend(point) },
  { id: "meta_revenue", label: "Meta Revenue", kind: "currency", accent: "#22c55e", compute: (point) => estimateMetaRevenue(point) },
  { id: "meta_roas", label: "Meta ROAS", kind: "ratio", accent: "#14b8a6", rollup: "avg", compute: (point) => point.meta_roas },
  { id: "meta_clicks", label: "Meta Clicks", kind: "integer", accent: "#06b6d4", compute: (point) => estimateMetaClicks(point) },
  { id: "meta_impressions", label: "Meta Impressions", kind: "integer", accent: "#6366f1", compute: (point) => estimateMetaImpressions(point) },
  { id: "meta_cpc", label: "Meta CPC", kind: "currency", accent: "#8b5cf6", rollup: "avg", compute: (point) => safeDivide(estimateMetaSpend(point), estimateMetaClicks(point)) },
  { id: "meta_ctr", label: "Meta CTR", kind: "percent", accent: "#10b981", rollup: "avg", compute: (point) => safeDivide(estimateMetaClicks(point), estimateMetaImpressions(point)) * 100 },
  { id: "meta_cpa", label: "Meta CPA", kind: "currency", accent: "#f59e0b", rollup: "avg", compute: (point) => safeDivide(estimateMetaSpend(point), point.orders * 0.46) },
  { id: "meta_frequency", label: "Meta Frequency", kind: "ratio", accent: "#ef4444", rollup: "avg", compute: (point) => 1.8 + point.new_customers_pct / 90 },
];

const AMAZON_PLATFORM_METRICS: PlatformMetricDefinition[] = [
  { id: "amz_sales", label: "Sales", kind: "currency", accent: "#f59e0b", compute: (point) => estimateAmazonSales(point) },
  { id: "amz_orders", label: "Orders", kind: "integer", accent: "#0ea5e9", compute: (point) => estimateAmazonOrders(point) },
  { id: "amz_spend", label: "Ad Spend", kind: "currency", accent: "#ef4444", compute: (point) => estimateAmazonSpend(point) },
  { id: "amz_roas", label: "ROAS", kind: "ratio", accent: "#10b981", compute: (point) => safeDivide(estimateAmazonSales(point), estimateAmazonSpend(point)) },
  { id: "amz_acos", label: "ACOS", kind: "percent", accent: "#f97316", compute: (point) => safeDivide(estimateAmazonSpend(point), estimateAmazonSales(point)) * 100 },
  { id: "amz_tacos", label: "TACOS", kind: "percent", accent: "#6366f1", compute: (point) => safeDivide(estimateAmazonSpend(point), point.revenue) * 100 },
  { id: "amz_impressions", label: "Impressions", kind: "integer", accent: "#06b6d4", compute: (point) => estimateAmazonImpressions(point) },
  { id: "amz_clicks", label: "Clicks", kind: "integer", accent: "#14b8a6", compute: (point) => estimateAmazonClicks(point) },
  { id: "amz_cpc", label: "CPC", kind: "currency", accent: "#3b82f6", rollup: "avg", compute: (point) => safeDivide(estimateAmazonSpend(point), estimateAmazonClicks(point)) },
];

const rollupPlatformValues = (definition: PlatformMetricDefinition, points: DailyMetricPoint[]) => {
  if (points.length === 0) return 0;
  const values = points.map(definition.compute);
  const rollup = definition.rollup ?? (definition.kind === "percent" || definition.kind === "ratio" || definition.kind === "duration" ? "avg" : "sum");
  if (rollup === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + value, 0);
};

const buildPlatformCards = (
  definitions: PlatformMetricDefinition[],
  currentPoints: DailyMetricPoint[],
  previousPoints: DailyMetricPoint[]
): PlatformMetricCard[] =>
  definitions.map((definition) => {
    const rawSeries = currentPoints.map((point) => ({ label: point.label, value: definition.compute(point) }));
    const currentValue = rollupPlatformValues(definition, currentPoints);
    const previousValue = rollupPlatformValues(definition, previousPoints);
    const trend = previousValue === 0 ? null : ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
    return {
      ...definition,
      value: currentValue,
      trend,
      sparkline: sampleSeries(rawSeries, 18),
    };
  });

const buildBreakdownItems = (metric: MetricKey, totals: MetricTotals): BreakdownItem[] => {
  const returningCustomers = Math.max(0, totals.orders - totals.newCustomers);
  const blendedRoas = safeDivide(totals.googleRevenue + totals.metaRevenue, totals.mediaSpend);
  const otherSpend = Math.max(0, totals.mediaSpend - totals.googleSpend - totals.metaSpend);
  const searchSpend = totals.googleSpend * 0.55;
  const shoppingSpend = totals.googleSpend * 0.3;
  const performanceMaxSpend = totals.googleSpend * 0.15;

  if (metric === "revenue") {
    return [
      { label: "Gross Revenue", value: totals.revenue, kind: "currency" },
      { label: "Google-attributed Revenue", value: totals.googleRevenue, kind: "currency" },
      { label: "Meta-attributed Revenue", value: totals.metaRevenue, kind: "currency" },
      { label: "Orders", value: totals.orders, kind: "integer" },
    ];
  }

  if (metric === "orders") {
    return [
      { label: "Total Orders", value: totals.orders, kind: "integer" },
      { label: "New Customer Orders", value: totals.newCustomers, kind: "integer", tone: "positive" },
      { label: "Returning Orders", value: returningCustomers, kind: "integer" },
    ];
  }

  if (metric === "media_spend") {
    return [
      { label: "Google Ads Spend", value: totals.googleSpend, kind: "currency" },
      { label: "Meta Ads Spend", value: totals.metaSpend, kind: "currency" },
      { label: "Other Spend", value: otherSpend, kind: "currency" },
      { label: "Blended ROAS", value: blendedRoas, kind: "ratio", tone: "positive" },
    ];
  }

  if (metric === "google_spend") {
    return [
      { label: "Search Campaign", value: searchSpend, kind: "currency" },
      { label: "Shopping Campaign", value: shoppingSpend, kind: "currency" },
      { label: "Performance Max", value: performanceMaxSpend, kind: "currency" },
      { label: "Total Google Spend", value: totals.googleSpend, kind: "currency" },
    ];
  }

  if (metric === "aov") {
    return [
      { label: "Gross Revenue", value: totals.revenue, kind: "currency" },
      { label: "Orders", value: totals.orders, kind: "integer" },
      { label: "AOV", value: safeDivide(totals.revenue, totals.orders), kind: "currency", tone: "positive" },
    ];
  }

  if (metric === "new_customers_pct") {
    return [
      { label: "New Customers", value: totals.newCustomers, kind: "integer", tone: "positive" },
      { label: "Returning Customers", value: returningCustomers, kind: "integer" },
      { label: "New Customer %", value: safeDivide(totals.newCustomers, totals.orders) * 100, kind: "percent" },
    ];
  }

  if (metric === "meta_roas") {
    return [
      { label: "Meta Revenue", value: totals.metaRevenue, kind: "currency" },
      { label: "Meta Spend", value: totals.metaSpend, kind: "currency", tone: "negative" },
      { label: "Meta ROAS", value: safeDivide(totals.metaRevenue, totals.metaSpend), kind: "ratio", tone: "positive" },
    ];
  }

  return [
    { label: "Google Revenue", value: totals.googleRevenue, kind: "currency" },
    { label: "Google Spend", value: totals.googleSpend, kind: "currency", tone: "negative" },
    { label: "Google ROAS", value: safeDivide(totals.googleRevenue, totals.googleSpend), kind: "ratio", tone: "positive" },
  ];
};

const generateMockRows = (): DailyMarketRow[] => {
  const rows: DailyMarketRow[] = [];
  const allFy25Dates = getIsoDatesBetween(FY25_START_DATE, FY25_END_DATE);

  allFy25Dates.forEach((isoDate, dayIndex) => {
    const currentDate = new Date(`${isoDate}T00:00:00`);
    const weekday = currentDate.getDay();
    const weekendFactor = weekday === 0 || weekday === 6 ? 1.07 : 1;
    const seasonality = 1 + 0.14 * Math.sin((dayIndex / allFy25Dates.length) * Math.PI * 2) + 0.06 * Math.sin((dayIndex / 30) * Math.PI * 2);

    (Object.keys(MARKET_SCALE) as Market[]).forEach((market, marketIndex) => {
      const seedBase = dayIndex * 13 + marketIndex * 71;
      const marketScale = MARKET_SCALE[market];
      const orderNoise = seededNoise(seedBase + 2);
      const valueNoise = seededNoise(seedBase + 4);
      const spendNoise = seededNoise(seedBase + 6);
      const roasNoise = seededNoise(seedBase + 8);
      const newCustomerNoise = seededNoise(seedBase + 10);

      const orders = Math.max(32, Math.round((88 + orderNoise * 58) * seasonality * weekendFactor * marketScale));
      const aov = 56 + marketScale * 8 + valueNoise * 22;
      const revenue = roundCurrency(orders * aov);
      const mediaSpend = roundCurrency(revenue * (0.16 + spendNoise * 0.1));

      const googleShare = clamp(0.52 + Math.sin(dayIndex / 18 + marketIndex) * 0.1, 0.34, 0.74);
      const googleSpend = roundCurrency(mediaSpend * googleShare);
      const metaSpend = roundCurrency(mediaSpend - googleSpend);

      const googleRoas = 2.18 + roasNoise * 1.6;
      const metaRoas = 1.82 + seededNoise(seedBase + 9) * 1.45;

      const googleRevenue = roundCurrency(googleSpend * googleRoas);
      const metaRevenue = roundCurrency(metaSpend * metaRoas);

      const newCustomerRate = 0.21 + newCustomerNoise * 0.18;
      const newCustomers = Math.min(orders, Math.round(orders * newCustomerRate));

      rows.push({
        date: isoDate,
        market,
        revenue,
        orders,
        mediaSpend,
        googleSpend,
        metaSpend,
        googleRevenue,
        metaRevenue,
        newCustomers,
      });
    });
  });

  return rows;
};

export function SummaryPage() {
  const summaryTimeRange = useStore((state) => state.summaryTimeRange);
  const summaryMarketFilter = useStore((state) => state.summaryMarketFilter);
  const summaryStartDate = useStore((state) => state.summaryStartDate);
  const summaryEndDate = useStore((state) => state.summaryEndDate);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformView>("shopify");
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("bars");

  const allRows = useMemo(() => generateMockRows(), []);

  const allDates = useMemo(
    () => Array.from(new Set(allRows.map((row) => row.date))).sort((a, b) => a.localeCompare(b)),
    [allRows]
  );

  const selectedDates = useMemo(() => {
    if (allDates.length === 0) return [] as string[];

    if (summaryTimeRange === "custom") {
      const start = summaryStartDate < FY25_START_DATE ? FY25_START_DATE : summaryStartDate;
      const end = summaryEndDate > FY25_END_DATE ? FY25_END_DATE : summaryEndDate;
      const boundedStart = start > end ? end : start;
      return allDates.filter((date) => date >= boundedStart && date <= end);
    }

    if (summaryTimeRange === "yesterday") {
      if (allDates.length === 1) return [allDates[0]];
      return [allDates[allDates.length - 2]];
    }

    const dayCount = TIME_RANGE_DAYS[summaryTimeRange] ?? 30;
    return allDates.slice(-dayCount);
  }, [allDates, summaryEndDate, summaryStartDate, summaryTimeRange]);

  const previousDates = useMemo(() => {
    if (allDates.length === 0 || selectedDates.length === 0) return [] as string[];
    const selectedStartIndex = allDates.indexOf(selectedDates[0]);
    if (selectedStartIndex <= 0) return [] as string[];
    const windowSize = selectedDates.length;
    const previousStartIndex = Math.max(0, selectedStartIndex - windowSize);
    return allDates.slice(previousStartIndex, selectedStartIndex);
  }, [allDates, selectedDates]);

  const selectedDateSet = useMemo(() => new Set(selectedDates), [selectedDates]);
  const previousDateSet = useMemo(() => new Set(previousDates), [previousDates]);

  const marketScopedRows = useMemo(
    () => (summaryMarketFilter === "all" ? allRows : allRows.filter((row) => row.market === summaryMarketFilter)),
    [allRows, summaryMarketFilter]
  );

  const currentRows = useMemo(
    () => marketScopedRows.filter((row) => selectedDateSet.has(row.date)),
    [marketScopedRows, selectedDateSet]
  );

  const previousRows = useMemo(
    () => marketScopedRows.filter((row) => previousDateSet.has(row.date)),
    [marketScopedRows, previousDateSet]
  );

  const currentDateMap = useMemo(() => buildDateToRowsMap(currentRows), [currentRows]);
  const previousDateMap = useMemo(() => buildDateToRowsMap(previousRows), [previousRows]);

  const dailyPoints = useMemo(
    () => selectedDates.map((date) => buildDailyMetricPoint(date, currentDateMap.get(date) ?? [])),
    [currentDateMap, selectedDates]
  );
  const previousDailyPoints = useMemo(
    () => previousDates.map((date) => buildDailyMetricPoint(date, previousDateMap.get(date) ?? [])),
    [previousDateMap, previousDates]
  );

  const metricCards = useMemo(
    () =>
      METRIC_DEFINITIONS.map((definition) => {
        const currentValue = calculateMetricValue(definition.key, currentRows);
        const previousValue = calculateMetricValue(definition.key, previousRows);
        const trend = previousValue === 0 ? null : ((currentValue - previousValue) / Math.abs(previousValue)) * 100;

        const rawSeries = dailyPoints.map((point) => ({ label: point.label, value: point[definition.key] }));
        const sparkline = sampleSeries(rawSeries, 18);

        return {
          definition,
          currentValue,
          previousValue,
          trend,
          sparkline,
        };
      }),
    [currentRows, previousRows, dailyPoints]
  );

  const selectedMetricDefinition = useMemo(
    () => METRIC_DEFINITIONS.find((item) => item.key === activeMetric) ?? null,
    [activeMetric]
  );

  const selectedMetricSeries = useMemo(() => {
    if (!activeMetric) return [];
    return dailyPoints.map((point) => ({ label: point.label, value: point[activeMetric] }));
  }, [activeMetric, dailyPoints]);
  const selectedMetricChartSeries = useMemo(() => sampleObjects(selectedMetricSeries, 22), [selectedMetricSeries]);

  const selectedMetricTotals = useMemo(() => aggregateTotals(currentRows), [currentRows]);

  const selectedMetricLatest = selectedMetricSeries[selectedMetricSeries.length - 1]?.value ?? 0;
  const selectedMetricPrevious = selectedMetricSeries[selectedMetricSeries.length - 2]?.value ?? 0;

  const laggedComparisonSeries = useMemo(
    () =>
      sampleObjects(
        selectedMetricSeries.map((point, index) => ({
          label: point.label,
          current: point.value,
          lagged: index > 0 ? selectedMetricSeries[index - 1].value : null,
        })),
        28
      ),
    [selectedMetricSeries]
  );

  const breakdownItems = useMemo(
    () => (activeMetric ? buildBreakdownItems(activeMetric, selectedMetricTotals) : []),
    [activeMetric, selectedMetricTotals]
  );

  const shopifyCards = useMemo(() => buildPlatformCards(SHOPIFY_PLATFORM_METRICS, dailyPoints, previousDailyPoints), [dailyPoints, previousDailyPoints]);
  const gaCards = useMemo(() => buildPlatformCards(GA_PLATFORM_METRICS, dailyPoints, previousDailyPoints), [dailyPoints, previousDailyPoints]);
  const metaCards = useMemo(() => buildPlatformCards(META_PLATFORM_METRICS, dailyPoints, previousDailyPoints), [dailyPoints, previousDailyPoints]);
  const amazonCards = useMemo(() => buildPlatformCards(AMAZON_PLATFORM_METRICS, dailyPoints, previousDailyPoints), [dailyPoints, previousDailyPoints]);

  const platformSections = useMemo(
    () => [
      { id: "shopify", cards: shopifyCards },
      { id: "ga", cards: gaCards },
      { id: "meta", cards: metaCards },
      { id: "amazon", cards: amazonCards },
    ],
    [amazonCards, gaCards, metaCards, shopifyCards]
  );

  const selectedPlatformSection = useMemo(
    () => platformSections.find((section) => section.id === selectedPlatform) ?? platformSections[0],
    [platformSections, selectedPlatform]
  );

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_20%_0%,rgba(14,165,233,0.14),transparent_36%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.12),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#ffffff_56%,#eef2ff_100%)] px-6 py-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map(({ definition, currentValue, trend, sparkline }) => {
            const Icon = definition.icon;
            return (
              <button
                key={definition.key}
                type="button"
                onClick={() => {
                  setActiveMetric(definition.key);
                  setDetailTab("bars");
                }}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_16px_35px_rgba(2,132,199,0.12)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-600">{definition.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{definition.subtitle}</p>
                  </div>
                  <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                    <Icon size={16} />
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-3xl font-semibold tracking-tight text-slate-900">{formatMetricValue(definition, currentValue)}</p>
                  <div className="mt-1 flex items-center gap-1 text-xs font-semibold">
                    {trend !== null ? (
                      <>
                        {trend >= 0 ? <TrendingUp size={14} className="text-emerald-600" /> : <TrendingDown size={14} className="text-red-500" />}
                        <span className={trend >= 0 ? "text-emerald-600" : "text-red-500"}>{Math.abs(trend).toFixed(1)}%</span>
                        <span className="text-slate-500">vs previous range</span>
                      </>
                    ) : (
                      <span className="text-slate-500">No previous range available</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 h-16">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparkline}>
                      <Line type="monotone" dataKey="value" stroke={definition.accent} strokeWidth={2.2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </button>
            );
          })}
        </section>

        <section className="rounded-2xl border border-white/70 bg-white/90 p-3 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {PLATFORM_OPTIONS.map((platform) => {
              const active = selectedPlatform === platform.id;
              const imageClassName =
                platform.id === "ga"
                  ? "h-12 w-12 object-contain scale-[1.85]"
                  : "h-12 w-12 object-contain";
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => setSelectedPlatform(platform.id)}
                  title={platform.label}
                  aria-label={platform.label}
                  className={`group relative flex h-20 items-center justify-center rounded-xl border transition ${
                    active
                      ? "border-cyan-400 bg-cyan-50 shadow-[0_10px_24px_rgba(6,182,212,0.2)]"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <img src={platform.image} alt={platform.label} className={imageClassName} />
                  <span
                    className={`absolute bottom-0 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full transition ${
                      active ? "bg-cyan-500" : "bg-transparent group-hover:bg-slate-200"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-white/70 bg-white/90 px-4 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {selectedPlatformSection.cards.map((card) => (
              <article key={card.id} className="rounded-2xl border border-slate-200 bg-slate-50/55 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-medium text-slate-700">{card.label}</p>
                  <div className="flex items-center gap-1 text-xs font-semibold">
                    {card.trend !== null ? (
                      <>
                        {card.trend >= 0 ? <TrendingUp size={13} className="text-emerald-600" /> : <TrendingDown size={13} className="text-red-500" />}
                        <span className={card.trend >= 0 ? "text-emerald-600" : "text-red-500"}>{Math.abs(card.trend).toFixed(1)}%</span>
                      </>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>
                </div>

                <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">{formatValueByKind(card.kind, card.value)}</p>
                <div className="mt-3 h-14">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={card.sparkline}>
                      <Line type="monotone" dataKey="value" stroke={card.accent} strokeWidth={2.2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {activeMetric && selectedMetricDefinition ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/40 px-3 py-3 backdrop-blur-[1px]">
          <div className="flex h-[76vh] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-[0_24px_72px_rgba(15,23,42,0.28)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">{summaryMarketFilter === "all" ? "All markets" : summaryMarketFilter}</p>
                <h2 className="text-[34px] font-semibold leading-none text-slate-900">{selectedMetricDefinition.label}</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveMetric(null)}
                className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="border-b border-slate-200 px-5 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {DETAIL_TAB_LABELS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setDetailTab(tab.key)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                      detailTab === tab.key ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 px-4 py-2.5">
                <div>
                  <p className="text-sm text-slate-500">{selectedDates[selectedDates.length - 1] ? formatDayLabel(selectedDates[selectedDates.length - 1]) : "-"}</p>
                  <p className="text-3xl font-semibold text-slate-900">{formatMetricValue(selectedMetricDefinition, selectedMetricLatest)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">{selectedDates[selectedDates.length - 2] ? formatDayLabel(selectedDates[selectedDates.length - 2]) : "-"}</p>
                  <p className="text-3xl font-semibold text-slate-700">{formatMetricValue(selectedMetricDefinition, selectedMetricPrevious)}</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 p-3">
              {detailTab === "bars" ? (
                <div className="h-full rounded-xl border border-slate-200 bg-white p-2.5">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedMetricChartSeries} barCategoryGap={4}>
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} tickMargin={8} minTickGap={18} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} width={70} />
                      <Tooltip
                        formatter={(value) => formatTooltipValue(selectedMetricDefinition, value)}
                        labelStyle={{ fontWeight: 600, color: "#0f172a" }}
                        contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1", boxShadow: "0 8px 24px rgba(15,23,42,0.12)" }}
                      />
                      <Bar dataKey="value" fill={selectedMetricDefinition.accent} radius={[4, 4, 0, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}

              {detailTab === "comparison" ? (
                <div className="h-full rounded-xl border border-slate-200 bg-white p-2.5">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={laggedComparisonSeries}>
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} tickMargin={8} minTickGap={20} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} width={70} />
                      <Tooltip
                        formatter={(value) => formatTooltipValue(selectedMetricDefinition, value)}
                        labelStyle={{ fontWeight: 600, color: "#0f172a" }}
                        contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1", boxShadow: "0 8px 24px rgba(15,23,42,0.12)" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="lagged"
                        name="Previous day (lagged)"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="current"
                        name="Current day"
                        stroke={selectedMetricDefinition.accent}
                        strokeWidth={2.6}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : null}

              {detailTab === "breakdown" ? (
                <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Relevant Breakdown</p>
                  </div>
                  <div className="max-h-full overflow-y-auto">
                    {breakdownItems.map((item) => (
                      <div key={item.label} className="flex items-center justify-between border-b border-slate-200 px-4 py-3 last:border-b-0">
                        <span className="text-base font-medium text-slate-700">{item.label}</span>
                        <span
                          className={`text-lg font-semibold ${
                            item.tone === "negative"
                              ? "text-rose-600"
                              : item.tone === "positive"
                                ? "text-emerald-600"
                                : "text-slate-900"
                          }`}
                        >
                          {formatValueByKind(item.kind, item.value)}
                        </span>
                      </div>
                    ))}
                    {breakdownItems.length === 0 ? (
                      <div className="px-4 py-8 text-sm text-slate-500">No breakdown available for this metric.</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
