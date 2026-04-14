import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  DollarSign,
  Megaphone,
  Search,
  ShoppingCart,
  RefreshCw,
  SlidersHorizontal,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useStore } from "../store/useStore";
import type { SummaryCategoryFilter, SummaryMarketFilter, SummarySourceFilter, SummaryTimeRange } from "../store/useStore";
import { generateKpiCompareSummary, generateKpiSummary, generateAIInsights, type KpiSummaryResponse } from "../services/api";
import { FY25_END_DATE, FY25_START_DATE } from "./summaryConfig";

type Market = "US" | "UK" | "UAE";
type DetailTab = "bars" | "comparison" | "breakdown";
type MetricKind = "currency" | "integer" | "percent" | "ratio" | "duration";
type CompareSide = "left" | "right";
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

interface MetricCardView {
  definition: MetricDefinition;
  currentValue: number;
  previousValue: number;
  trend: number | null;
  sparkline: Array<{ label: string; value: number }>;
}

interface SummarySelection {
  timeRange: SummaryTimeRange;
  market: SummaryMarketFilter;
  category: SummaryCategoryFilter;
  source: SummarySourceFilter;
  startDate: string;
  endDate: string;
}

interface SummaryView {
  selectedDates: string[];
  previousDates: string[];
  currentRows: DailyMarketRow[];
  previousRows: DailyMarketRow[];
  dailyPoints: DailyMetricPoint[];
  metricCards: MetricCardView[];
}

const TIME_RANGE_DAYS: Partial<Record<SummaryTimeRange, number>> = {
  last_7: 7,
  last_13: 13,
  last_30: 30,
  last_90: 90,
  last_180: 180,
  last_365: 365,
};

const SUMMARY_TIME_OPTIONS: Array<{ value: SummaryTimeRange; label: string }> = [
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7", label: "Last 7 days" },
  { value: "last_13", label: "Last 13 days" },
  { value: "last_30", label: "Last 30 days" },
  { value: "last_90", label: "Last 90 days" },
  { value: "last_180", label: "Last 180 days" },
  { value: "last_365", label: "Last 365 days" },
  { value: "custom", label: "Custom range" },
];

const SUMMARY_MARKET_OPTIONS: Array<{ value: SummaryMarketFilter; label: string }> = [
  { value: "all", label: "All markets" },
  { value: "US", label: "US" },
  { value: "UK", label: "UK" },
  { value: "UAE", label: "UAE" },
];

const SUMMARY_CATEGORY_OPTIONS: Array<{ value: SummaryCategoryFilter; label: string }> = [
  { value: "all", label: "All products" },
  { value: "ring", label: "Ring" },
  { value: "necklace", label: "Necklace" },
  { value: "bracelet", label: "Bracelet" },
  { value: "earring", label: "Earring" },
];

const SUMMARY_SOURCE_OPTIONS: Array<{ value: SummarySourceFilter; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "shopify", label: "Shopify" },
  { value: "amazon", label: "Amazon" },
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

const CATEGORY_SCALE: Record<SummaryCategoryFilter, { demand: number; aov: number; spend: number; newCustomer: number }> = {
  all: { demand: 1, aov: 1, spend: 1, newCustomer: 1 },
  ring: { demand: 1, aov: 1, spend: 1, newCustomer: 1 },
  necklace: { demand: 0.78, aov: 1.34, spend: 1.12, newCustomer: 0.94 },
  bracelet: { demand: 1.16, aov: 0.82, spend: 0.9, newCustomer: 1.08 },
  earring: { demand: 1.28, aov: 0.74, spend: 0.86, newCustomer: 1.12 },
};

const SOURCE_SCALE: Record<SummarySourceFilter, { revenue: number; orders: number; spend: number; googleShare: number; roas: number }> = {
  all: { revenue: 1, orders: 1, spend: 1, googleShare: 0.56, roas: 1 },
  shopify: { revenue: 0.68, orders: 0.72, spend: 0.38, googleShare: 0.42, roas: 1.12 },
  amazon: { revenue: 0.34, orders: 0.31, spend: 0.26, googleShare: 0.76, roas: 0.92 },
};

const DETAIL_TAB_LABELS: Array<{ key: DetailTab; label: string }> = [
  { key: "bars", label: "Trend" },
  { key: "comparison", label: "Lagged" },
  { key: "breakdown", label: "Components" },
];

const SUMMARY_TIME_LABELS: Record<SummaryTimeRange, string> = {
  yesterday: "Yesterday",
  last_7: "Last 7 days",
  last_13: "Last 13 days",
  last_30: "Last 30 days",
  last_90: "Last 90 days",
  last_180: "Last 180 days",
  last_365: "Last 365 days",
  custom: "Custom range",
};

const SUMMARY_CATEGORY_LABELS: Record<SummaryCategoryFilter, string> = {
  all: "All products",
  ring: "Ring",
  necklace: "Necklace",
  bracelet: "Bracelet",
  earring: "Earring",
};

const SUMMARY_SOURCE_LABELS: Record<SummarySourceFilter, string> = {
  all: "All sources",
  shopify: "Shopify",
  amazon: "Amazon",
};

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

const sanitizeAiText = (value: string) =>
  value
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

const stripAiPrefix = (value: string, type: "green" | "red") => {
  const cleaned = sanitizeAiText(value).replace(/^[^A-Za-z0-9]+/, "");
  if (type === "green") return cleaned.replace(/^green\s*flag\s*:\s*/i, "").trim();
  return cleaned.replace(/^red\s*flag\s*:\s*/i, "").trim();
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

const applySummaryFilters = (
  row: DailyMarketRow,
  category: SummaryCategoryFilter,
  source: SummarySourceFilter
): DailyMarketRow => {
  const categoryScale = CATEGORY_SCALE[category];
  const sourceScale = SOURCE_SCALE[source];
  const orders = Math.max(1, Math.round(row.orders * categoryScale.demand * sourceScale.orders));
  const revenue = roundCurrency(row.revenue * categoryScale.demand * categoryScale.aov * sourceScale.revenue);
  const mediaSpend = roundCurrency(row.mediaSpend * categoryScale.spend * sourceScale.spend);
  const googleSpend = roundCurrency(mediaSpend * sourceScale.googleShare);
  const metaSpend = roundCurrency(mediaSpend - googleSpend);
  const googleRoas = safeDivide(row.googleRevenue, row.googleSpend) * sourceScale.roas;
  const metaRoas = safeDivide(row.metaRevenue, row.metaSpend) * sourceScale.roas;
  const googleRevenue = roundCurrency(googleSpend * googleRoas);
  const metaRevenue = roundCurrency(metaSpend * metaRoas);
  const newCustomerRate = safeDivide(row.newCustomers, row.orders) * categoryScale.newCustomer;

  return {
    ...row,
    revenue,
    orders,
    mediaSpend,
    googleSpend,
    metaSpend,
    googleRevenue,
    metaRevenue,
    newCustomers: Math.min(orders, Math.round(orders * newCustomerRate)),
  };
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

const getSelectedDatesForSelection = (allDates: string[], selection: SummarySelection) => {
  if (allDates.length === 0) return [] as string[];

  if (selection.timeRange === "custom") {
    const start = selection.startDate < FY25_START_DATE ? FY25_START_DATE : selection.startDate;
    const end = selection.endDate > FY25_END_DATE ? FY25_END_DATE : selection.endDate;
    const boundedStart = start > end ? end : start;
    return allDates.filter((date) => date >= boundedStart && date <= end);
  }

  if (selection.timeRange === "yesterday") {
    if (allDates.length === 1) return [allDates[0]];
    return [allDates[allDates.length - 2]];
  }

  const dayCount = TIME_RANGE_DAYS[selection.timeRange] ?? 30;
  return allDates.slice(-dayCount);
};

const getPreviousDatesForSelection = (allDates: string[], selectedDates: string[]) => {
  if (allDates.length === 0 || selectedDates.length === 0) return [] as string[];
  const selectedStartIndex = allDates.indexOf(selectedDates[0]);
  if (selectedStartIndex <= 0) return [] as string[];
  const windowSize = selectedDates.length;
  const previousStartIndex = Math.max(0, selectedStartIndex - windowSize);
  return allDates.slice(previousStartIndex, selectedStartIndex);
};

const buildSummaryView = (allRows: DailyMarketRow[], allDates: string[], selection: SummarySelection): SummaryView => {
  const selectedDates = getSelectedDatesForSelection(allDates, selection);
  const previousDates = getPreviousDatesForSelection(allDates, selectedDates);
  const selectedDateSet = new Set(selectedDates);
  const previousDateSet = new Set(previousDates);
  const marketRows = selection.market === "all" ? allRows : allRows.filter((row) => row.market === selection.market);
  const scopedRows = marketRows.map((row) => applySummaryFilters(row, selection.category, selection.source));
  const currentRows = scopedRows.filter((row) => selectedDateSet.has(row.date));
  const previousRows = scopedRows.filter((row) => previousDateSet.has(row.date));
  const currentDateMap = buildDateToRowsMap(currentRows);
  const dailyPoints = selectedDates.map((date) => buildDailyMetricPoint(date, currentDateMap.get(date) ?? []));

  const metricCards = METRIC_DEFINITIONS.map((definition) => {
    const currentValue = calculateMetricValue(definition.key, currentRows);
    const previousValue = calculateMetricValue(definition.key, previousRows);
    const trend = previousValue === 0 ? null : ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
    const sparkline = sampleSeries(dailyPoints.map((point) => ({ label: point.label, value: point[definition.key] })), 18);

    return {
      definition,
      currentValue,
      previousValue,
      trend,
      sparkline,
    };
  });

  return { selectedDates, previousDates, currentRows, previousRows, dailyPoints, metricCards };
};

function MetricCardGrid({
  cards,
  dense = false,
  onMetricClick,
}: {
  cards: MetricCardView[];
  dense?: boolean;
  onMetricClick?: (key: MetricKey) => void;
}) {
  return (
    <section className={`grid gap-4 ${dense ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
      {cards.map(({ definition, currentValue, trend, sparkline }) => {
        const Icon = definition.icon;
        const content = (
          <>
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
              <p className={`${dense ? "text-2xl" : "text-3xl"} font-semibold tracking-tight text-slate-900`}>
                {formatMetricValue(definition, currentValue)}
              </p>
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
          </>
        );

        const className =
          "group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_16px_35px_rgba(2,132,199,0.12)]";

        if (onMetricClick) {
          return (
            <button key={definition.key} type="button" onClick={() => onMetricClick(definition.key)} className={className}>
              {content}
            </button>
          );
        }

        return (
          <div key={definition.key} className={className}>
            {content}
          </div>
        );
      })}
    </section>
  );
}

function CompareFilterPanel({
  label,
  tone,
  selection,
  onChange,
}: {
  label: string;
  tone: "cyan" | "emerald";
  selection: SummarySelection;
  onChange: (updates: Partial<SummarySelection>) => void;
}) {
  const accentClass =
    tone === "cyan"
      ? "border-cyan-200 bg-cyan-50/70 text-cyan-700"
      : "border-emerald-200 bg-emerald-50/70 text-emerald-700";

  return (
    <div className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
      <div className={`mb-4 flex items-center justify-between rounded-2xl border px-4 py-3 ${accentClass}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</p>
          <p className="mt-0.5 text-sm text-slate-600">This column controls its side of every card</p>
        </div>
        <SlidersHorizontal size={18} />
      </div>

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-2">
        <label className="text-xs font-semibold text-slate-500">
          Time
          <select
            value={selection.timeRange}
            onChange={(event) => onChange({ timeRange: event.target.value as SummaryTimeRange })}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          >
            {SUMMARY_TIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-slate-500">
          Region
          <select
            value={selection.market}
            onChange={(event) => onChange({ market: event.target.value as SummaryMarketFilter })}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          >
            {SUMMARY_MARKET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-slate-500">
          Product
          <select
            value={selection.category}
            onChange={(event) => onChange({ category: event.target.value as SummaryCategoryFilter })}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          >
            {SUMMARY_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-slate-500">
          Source
          <select
            value={selection.source}
            onChange={(event) => onChange({ source: event.target.value as SummarySourceFilter })}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          >
            {SUMMARY_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selection.timeRange === "custom" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-500">
            Start
            <input
              type="date"
              min={FY25_START_DATE}
              max={selection.endDate || FY25_END_DATE}
              value={selection.startDate}
              onChange={(event) => {
                const startDate = event.target.value;
                onChange({ startDate, endDate: startDate > selection.endDate ? startDate : selection.endDate });
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            End
            <input
              type="date"
              min={selection.startDate || FY25_START_DATE}
              max={FY25_END_DATE}
              value={selection.endDate}
              onChange={(event) => {
                const endDate = event.target.value;
                onChange({ endDate, startDate: endDate < selection.startDate ? endDate : selection.startDate });
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function CompareMetricSplitGrid({
  leftCards,
  rightCards,
  onMetricClick,
}: {
  leftCards: MetricCardView[];
  rightCards: MetricCardView[];
  onMetricClick: (key: MetricKey, side: CompareSide) => void;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {leftCards.map((leftCard, index) => {
        const rightCard = rightCards[index] ?? leftCard;
        const Icon = leftCard.definition.icon;

        return (
          <div
            key={leftCard.definition.key}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_16px_35px_rgba(2,132,199,0.12)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">{leftCard.definition.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{leftCard.definition.subtitle}</p>
              </div>
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <Icon size={16} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 divide-x divide-slate-200">
              {[
                { label: "View A", side: "left" as const, card: leftCard, tone: "cyan" },
                { label: "View B", side: "right" as const, card: rightCard, tone: "emerald" },
              ].map(({ label, side, card, tone }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onMetricClick(card.definition.key, side)}
                  className={`group/side rounded-2xl py-2 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-200 ${
                    label === "View A" ? "mr-2 pr-3" : "ml-2 pl-3"
                  }`}
                >
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
                      tone === "cyan" ? "bg-cyan-50 text-cyan-700" : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {label}
                  </span>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {formatMetricValue(card.definition, card.currentValue)}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold">
                    {card.trend !== null ? (
                      <>
                        {card.trend >= 0 ? <TrendingUp size={12} className="text-emerald-600" /> : <TrendingDown size={12} className="text-red-500" />}
                        <span className={card.trend >= 0 ? "text-emerald-600" : "text-red-500"}>{Math.abs(card.trend).toFixed(1)}%</span>
                        <span className="text-slate-500">vs prev</span>
                      </>
                    ) : (
                      <span className="text-slate-500">No trend</span>
                    )}
                  </div>
                  <div className="mt-3 h-12">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={card.sparkline}>
                        <Line type="monotone" dataKey="value" stroke={card.definition.accent} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 opacity-0 transition group-hover/side:opacity-100">
                    Open trend
                  </p>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

const buildAiSummaryMetrics = (cards: MetricCardView[]) =>
  cards.map(({ definition, currentValue, trend }) => ({
    label: definition.label,
    value: Number(currentValue.toFixed(4)),
    formatted_value: formatMetricValue(definition, currentValue),
    trend_percent: trend === null ? null : Number(trend.toFixed(2)),
    kind: definition.kind,
  }));

export function SummaryPage() {
  const summaryTimeRange = useStore((state) => state.summaryTimeRange);
  const summaryMarketFilter = useStore((state) => state.summaryMarketFilter);
  const summaryCategoryFilter = useStore((state) => state.summaryCategoryFilter);
  const summarySourceFilter = useStore((state) => state.summarySourceFilter);
  const summaryStartDate = useStore((state) => state.summaryStartDate);
  const summaryEndDate = useStore((state) => state.summaryEndDate);
  
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("bars");
  const [aiSummary, setAiSummary] = useState<KpiSummaryResponse | null>(null);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);
  const [isAiSummaryLoading, setIsAiSummaryLoading] = useState(false);
  const [aiSummarySignature, setAiSummarySignature] = useState<string | null>(null);
  const [marketingChannel, setMarketingChannel] = useState<'blended' | 'meta' | 'google'>('blended');
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [activeCompareSide, setActiveCompareSide] = useState<CompareSide | null>(null);
  const [compareLeft, setCompareLeft] = useState<SummarySelection>({
    timeRange: "last_30",
    market: "all",
    category: "all",
    source: "all",
    startDate: FY25_START_DATE,
    endDate: FY25_END_DATE,
  });
  const [compareRight, setCompareRight] = useState<SummarySelection>({
    timeRange: "last_30",
    market: "US",
    category: "all",
    source: "shopify",
    startDate: FY25_START_DATE,
    endDate: FY25_END_DATE,
  });

  const allRows = useMemo(() => generateMockRows(), []);

  const allDates = useMemo(
    () => Array.from(new Set(allRows.map((row) => row.date))).sort((a, b) => a.localeCompare(b)),
    [allRows]
  );

  const globalSelection = useMemo<SummarySelection>(
    () => ({
      timeRange: summaryTimeRange,
      market: summaryMarketFilter,
      category: summaryCategoryFilter,
      source: summarySourceFilter,
      startDate: summaryStartDate,
      endDate: summaryEndDate,
    }),
    [summaryCategoryFilter, summaryEndDate, summaryMarketFilter, summarySourceFilter, summaryStartDate, summaryTimeRange]
  );

  const primaryView = useMemo(() => buildSummaryView(allRows, allDates, globalSelection), [allDates, allRows, globalSelection]);
  const compareLeftView = useMemo(() => buildSummaryView(allRows, allDates, compareLeft), [allDates, allRows, compareLeft]);
  const compareRightView = useMemo(() => buildSummaryView(allRows, allDates, compareRight), [allDates, allRows, compareRight]);
  const selectedDates = primaryView.selectedDates;
  const currentRows = primaryView.currentRows;
  const dailyPoints = primaryView.dailyPoints;
  const metricCards = primaryView.metricCards;

  const openCompareMode = () => {
    setCompareLeft(globalSelection);
    setActiveCompareSide(null);
    setIsCompareMode(true);
  };

  const selectedMetricDefinition = useMemo(
    () => METRIC_DEFINITIONS.find((item) => item.key === activeMetric) ?? null,
    [activeMetric]
  );

  const detailDailyPoints =
    activeCompareSide === "left" ? compareLeftView.dailyPoints : activeCompareSide === "right" ? compareRightView.dailyPoints : dailyPoints;
  const detailCurrentRows =
    activeCompareSide === "left" ? compareLeftView.currentRows : activeCompareSide === "right" ? compareRightView.currentRows : currentRows;
  const detailSelectedDates =
    activeCompareSide === "left" ? compareLeftView.selectedDates : activeCompareSide === "right" ? compareRightView.selectedDates : selectedDates;
  const detailSelection = activeCompareSide === "left" ? compareLeft : activeCompareSide === "right" ? compareRight : globalSelection;
  const detailSideLabel = activeCompareSide === "left" ? "View A" : activeCompareSide === "right" ? "View B" : "Current view";

  const selectedMetricSeries = useMemo(() => {
    if (!activeMetric) return [];
    return detailDailyPoints.map((point) => ({ label: point.label, value: point[activeMetric] }));
  }, [activeMetric, detailDailyPoints]);
  const selectedMetricChartSeries = useMemo(() => sampleObjects(selectedMetricSeries, 22), [selectedMetricSeries]);

  const selectedMetricTotals = useMemo(() => aggregateTotals(detailCurrentRows), [detailCurrentRows]);

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

  const aiSummaryMetrics = useMemo(
    () => buildAiSummaryMetrics(metricCards),
    [metricCards]
  );

  const compareLeftAiSummaryMetrics = useMemo(
    () => buildAiSummaryMetrics(compareLeftView.metricCards),
    [compareLeftView.metricCards]
  );

  const compareRightAiSummaryMetrics = useMemo(
    () => buildAiSummaryMetrics(compareRightView.metricCards),
    [compareRightView.metricCards]
  );

  const formatSelectionTimeRange = (selection: SummarySelection) =>
    selection.timeRange === "custom"
      ? `${selection.startDate} to ${selection.endDate}`
      : SUMMARY_TIME_LABELS[selection.timeRange];

  const formatSelectionMarket = (selection: SummarySelection) =>
    selection.market === "all" ? "All markets" : selection.market;

  const aiSummaryRequest = useMemo(
    () => ({
      time_range:
        summaryTimeRange === "custom"
          ? `${summaryStartDate} to ${summaryEndDate}`
          : SUMMARY_TIME_LABELS[summaryTimeRange],
      market: summaryMarketFilter === "all" ? "All markets" : summaryMarketFilter,
      category: SUMMARY_CATEGORY_LABELS[summaryCategoryFilter],
      source: SUMMARY_SOURCE_LABELS[summarySourceFilter],
      metrics: aiSummaryMetrics,
    }),
    [aiSummaryMetrics, summaryCategoryFilter, summaryEndDate, summaryMarketFilter, summarySourceFilter, summaryStartDate, summaryTimeRange]
  );

  const aiCompareSummaryRequest = useMemo(
    () => ({
      left: {
        label: "View A",
        time_range: formatSelectionTimeRange(compareLeft),
        market: formatSelectionMarket(compareLeft),
        category: SUMMARY_CATEGORY_LABELS[compareLeft.category],
        source: SUMMARY_SOURCE_LABELS[compareLeft.source],
        metrics: compareLeftAiSummaryMetrics,
      },
      right: {
        label: "View B",
        time_range: formatSelectionTimeRange(compareRight),
        market: formatSelectionMarket(compareRight),
        category: SUMMARY_CATEGORY_LABELS[compareRight.category],
        source: SUMMARY_SOURCE_LABELS[compareRight.source],
        metrics: compareRightAiSummaryMetrics,
      },
    }),
    [compareLeft, compareLeftAiSummaryMetrics, compareRight, compareRightAiSummaryMetrics]
  );

  const currentAiSummarySignature = useMemo(
    () => JSON.stringify(isCompareMode ? { mode: "compare", request: aiCompareSummaryRequest } : { mode: "single", request: aiSummaryRequest }),
    [aiCompareSummaryRequest, aiSummaryRequest, isCompareMode]
  );
  const isAiSummaryStale = Boolean(aiSummary && aiSummarySignature && aiSummarySignature !== currentAiSummarySignature);

  const refreshAiSummary = useCallback(async () => {
    if (isCompareMode) {
      if (compareLeftAiSummaryMetrics.length === 0 || compareRightAiSummaryMetrics.length === 0) return;
    } else if (aiSummaryMetrics.length === 0) {
      return;
    }

    const requestSignature = currentAiSummarySignature;
    setIsAiSummaryLoading(true);
    setAiSummaryError(null);

    // For non-compare mode, use the new Gemini AI insights
    if (!isCompareMode && aiSummaryMetrics.length === 8) {
      try {
        // Extract the 8 metrics with their values and % changes
        const metricsMap = aiSummaryMetrics.reduce((acc, m) => {
          acc[m.label] = m;
          return acc;
        }, {} as Record<string, typeof aiSummaryMetrics[0]>);

        const insightsRequest = {
          revenue: {
            value: metricsMap['Revenue']?.formatted_value || '$0',
            change_percent: metricsMap['Revenue']?.trend_percent || 0
          },
          orders: {
            value: metricsMap['Orders']?.formatted_value || '0',
            change_percent: metricsMap['Orders']?.trend_percent || 0
          },
          media_spend: {
            value: metricsMap['Media Spend']?.formatted_value || '$0',
            change_percent: metricsMap['Media Spend']?.trend_percent || 0
          },
          google_spend: {
            value: metricsMap['Google Spend']?.formatted_value || '$0',
            change_percent: metricsMap['Google Spend']?.trend_percent || 0
          },
          aov: {
            value: metricsMap['AOV']?.formatted_value || '$0',
            change_percent: metricsMap['AOV']?.trend_percent || 0
          },
          new_customers_pct: {
            value: metricsMap['New Customers %']?.formatted_value || '0%',
            change_percent: metricsMap['New Customers %']?.trend_percent || 0
          },
          meta_roas: {
            value: metricsMap['Meta ROAS']?.formatted_value || '0.00',
            change_percent: metricsMap['Meta ROAS']?.trend_percent || 0
          },
          google_roas: {
            value: metricsMap['Google ROAS']?.formatted_value || '0.00',
            change_percent: metricsMap['Google ROAS']?.trend_percent || 0
          },
          region: summaryMarketFilter === "all" ? "All Markets" : summaryMarketFilter,
          product: SUMMARY_CATEGORY_LABELS[summaryCategoryFilter],
          period: summaryTimeRange === "custom"
            ? `${summaryStartDate} to ${summaryEndDate}`
            : SUMMARY_TIME_LABELS[summaryTimeRange],
        };

        const result = await generateAIInsights(insightsRequest);

        if (result.error) {
          setAiSummaryError(result.error);
        } else if (result.data) {
          // Transform AI insights response to match the expected format
          setAiSummary({
            headline: sanitizeAiText(result.data.headline),
            overview: sanitizeAiText(result.data.bullets[0] || ''),
            insights: (result.data.bullets || []).map((line) => sanitizeAiText(line)),
            actions: [stripAiPrefix(result.data.green_flag, "green")],
            watchout: stripAiPrefix(result.data.red_flag, "red"),
            model_used: 'gemini-2.0-flash-exp'
          });
          setAiSummarySignature(requestSignature);
        }
      } catch (error) {
        setAiSummaryError(error instanceof Error ? error.message : 'Failed to generate insights');
      }
    } else {
      // Fallback to old compare mode logic
      const result = isCompareMode
        ? await generateKpiCompareSummary(aiCompareSummaryRequest)
        : await generateKpiSummary(aiSummaryRequest);

      if (result.error) {
        setAiSummaryError(result.error);
      } else {
        setAiSummary(result.data ?? null);
        setAiSummarySignature(requestSignature);
      }
    }
    
    setIsAiSummaryLoading(false);
  }, [
    aiCompareSummaryRequest,
    aiSummaryMetrics,
    aiSummaryRequest,
    compareLeftAiSummaryMetrics.length,
    compareRightAiSummaryMetrics.length,
    currentAiSummarySignature,
    isCompareMode,
    summaryCategoryFilter,
    summaryEndDate,
    summaryMarketFilter,
    summaryStartDate,
    summaryTimeRange,
  ]);

  useEffect(() => {
    if (!aiSummary && !aiSummaryError && !isAiSummaryLoading) {
      void refreshAiSummary();
    }
  }, [aiSummary, aiSummaryError, isAiSummaryLoading, refreshAiSummary]);

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_20%_0%,rgba(14,165,233,0.14),transparent_36%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.12),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#ffffff_56%,#eef2ff_100%)] px-6 py-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">KPI Summary</p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              {isCompareMode ? "Compare two KPI views" : "Performance cards"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isCompareMode) {
                setIsCompareMode(false);
                setActiveCompareSide(null);
                return;
              }
              openCompareMode();
            }}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
              isCompareMode
                ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                : "border border-slate-950 bg-slate-950 text-white hover:bg-slate-800"
            }`}
          >
            <SlidersHorizontal size={16} />
            {isCompareMode ? "Exit compare mode" : "Compare mode"}
          </button>
        </div>

        {isCompareMode ? (
          <section className="relative overflow-hidden rounded-[32px] border border-cyan-100 bg-white/80 p-5 shadow-[0_22px_60px_rgba(15,23,42,0.10)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(14,165,233,0.13),transparent_28%),radial-gradient(circle_at_92%_0%,rgba(16,185,129,0.13),transparent_28%)]" />
            <div className="relative mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Comparison setup</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">Choose filters by column, then open any side of a card.</h3>
              </div>
              <p className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm">
                Cards split: View A left / View B right
              </p>
            </div>
            <div className="relative grid gap-4 xl:grid-cols-2">
              <CompareFilterPanel
                label="View A Filters"
                tone="cyan"
                selection={compareLeft}
                onChange={(updates) => setCompareLeft((current) => ({ ...current, ...updates }))}
              />
              <CompareFilterPanel
                label="View B Filters"
                tone="emerald"
                selection={compareRight}
                onChange={(updates) => setCompareRight((current) => ({ ...current, ...updates }))}
              />
            </div>
            <div className="relative mt-5">
              <CompareMetricSplitGrid
                leftCards={compareLeftView.metricCards}
                rightCards={compareRightView.metricCards}
                onMetricClick={(key, side) => {
                  setActiveMetric(key);
                  setActiveCompareSide(side);
                  setDetailTab("bars");
                }}
              />
            </div>
          </section>
        ) : (
          <MetricCardGrid
            cards={metricCards}
            onMetricClick={(key) => {
              setActiveMetric(key);
              setActiveCompareSide(null);
              setDetailTab("bars");
            }}
          />
        )}

        <section className="relative overflow-hidden rounded-[28px] border border-cyan-100/80 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(14,165,233,0.16),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(16,185,129,0.16),transparent_28%),linear-gradient(135deg,rgba(248,250,252,0.98),rgba(255,255,255,0.78))]" />
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-cyan-200/70 bg-cyan-100/30 blur-sm" />
          <div className="relative">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-semibold">
                {isCompareMode ? (
                  <>
                    <span className="rounded-full border border-cyan-200 bg-white/80 px-3 py-1.5 text-cyan-700 shadow-sm">
                      View A: {formatSelectionMarket(compareLeft)} / {SUMMARY_SOURCE_LABELS[compareLeft.source]}
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-emerald-700 shadow-sm">
                      View B: {formatSelectionMarket(compareRight)} / {SUMMARY_SOURCE_LABELS[compareRight.source]}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="rounded-full border border-cyan-200 bg-white/80 px-3 py-1.5 text-cyan-700 shadow-sm">
                      {summaryTimeRange === "custom" ? "Custom range" : SUMMARY_TIME_LABELS[summaryTimeRange]}
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-emerald-700 shadow-sm">
                      {summaryMarketFilter === "all" ? "All markets" : summaryMarketFilter}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-slate-700 shadow-sm">
                      {SUMMARY_CATEGORY_LABELS[summaryCategoryFilter]}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-slate-700 shadow-sm">
                      {SUMMARY_SOURCE_LABELS[summarySourceFilter]}
                    </span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void refreshAiSummary()}
                  disabled={isAiSummaryLoading}
                  className={`ml-1 inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold shadow-sm transition ${
                    isAiSummaryStale
                      ? "border border-amber-300 bg-amber-300 text-slate-950 hover:bg-amber-200"
                      : "border border-slate-900 bg-slate-950 text-white hover:bg-slate-800"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <RefreshCw size={14} className={isAiSummaryLoading ? "animate-spin" : ""} />
                  {isAiSummaryStale
                    ? isCompareMode
                      ? "Regenerate comparison"
                      : "Regenerate insights"
                    : isCompareMode
                      ? "Refresh comparison"
                      : "Refresh insights"}
                </button>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Trinity Insights</p>
                <h3 className="mt-1 text-[2.05rem] font-semibold leading-tight tracking-tight text-slate-950">
                  {isAiSummaryLoading
                    ? isCompareMode
                      ? "Comparing the KPI views"
                      : "Reading the KPI movement"
                    : isAiSummaryStale
                      ? isCompareMode
                        ? "Comparison changed, regenerate insights"
                        : "Filters changed, regenerate insights"
                      : aiSummary?.headline ?? (isCompareMode ? "Comparison summary" : "Performance summary")}
                </h3>
                {!isAiSummaryLoading && !isAiSummaryStale && aiSummary?.overview ? (
                  <p className="mt-3 text-sm leading-6 text-slate-600">{aiSummary.overview}</p>
                ) : null}
              </div>
            </div>

            {isAiSummaryStale ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Filters changed</p>
                  <p className="mt-0.5 text-sm text-amber-800">
                    {isCompareMode
                      ? "Trinity Insights is still showing the previous comparison. Regenerate to compare the current split cards."
                      : "Trinity Insights is still showing the previous filter view. Regenerate to summarize the current cards."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshAiSummary()}
                  disabled={isAiSummaryLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw size={15} className={isAiSummaryLoading ? "animate-spin" : ""} />
                  Regenerate now
                </button>
              </div>
            ) : null}

            {aiSummaryError ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {aiSummaryError}
              </div>
            ) : null}

            {!aiSummaryError && isAiSummaryLoading ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl border border-white/80 bg-white/70 p-5 shadow-sm">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-5/6 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/70 p-5 shadow-sm">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-3/5 animate-pulse rounded bg-slate-200" />
                </div>
              </div>
            ) : null}

            {!aiSummaryError && !isAiSummaryLoading && aiSummary ? (
              <div className="mt-6 grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
                {/* Left side: 3 Insight Bullets */}
                <div className="rounded-3xl border border-cyan-100/80 bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.07)]">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Key Signals</p>
                  <div className="grid gap-3">
                    {aiSummary.insights.map((bullet, index) => (
                      <div
                        key={index}
                        className="group rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md"
                      >
                        <span className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-50 text-[11px] font-bold text-cyan-700">
                          {index + 1}
                        </span>
                        {bullet}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right side: Green Flag and Red Flag */}
                <div className="space-y-4">
                  {/* Green Flag */}
                  <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.07)]">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Green Flag</p>
                    <div className="text-sm leading-6 text-slate-700">
                      {aiSummary.actions[0]}
                    </div>
                  </div>

                  {/* Red Flag */}
                  <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.07)]">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Watchout</p>
                    <div className="text-sm leading-6 text-slate-700">
                      {aiSummary.watchout}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Sales Deep Dive Section */}
        <section className="mt-8">
          <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sales deep dive</p>
              <p className="mt-1 text-sm text-slate-600">
                Weekly sales - last {selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'}
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Revenue over time */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Revenue over time</p>
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sampleObjects(dailyPoints, 30)}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(v)} />
                      <Tooltip formatter={(v) => formatCurrencyCompact(Number(v))} />
                      <Line type="monotone" dataKey="revenue" name="Shopify" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="media_spend" name="Amazon" stroke="#06b6d4" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span className="text-slate-600">Shopify</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
                    <span className="text-slate-600">Amazon</span>
                  </div>
                </div>
              </div>

              {/* Orders & AOV over time */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Orders & AOV over time</p>
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sampleObjects(dailyPoints, 30)}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip />
                      <Line yAxisId="left" type="monotone" dataKey="orders" name="Orders" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="aov" name="AOV" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span className="text-slate-600">Orders</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                    <span className="text-slate-600">AOV</span>
                  </div>
                </div>
              </div>

              {/* New vs Returning customers */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">New vs returning customers</p>
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sampleObjects(dailyPoints.map(p => ({ 
                      ...p, 
                      new_pct: p.new_customers_pct,
                      returning_pct: 100 - p.new_customers_pct 
                    })), 30)}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                      <Line type="monotone" dataKey="new_pct" name="New" stroke="#10b981" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="returning_pct" name="Returning" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600">New</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    <span className="text-slate-600">Returning</span>
                  </div>
                </div>
              </div>

              {/* Repeat purchase rate */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Repeat purchase rate</p>
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sampleObjects(dailyPoints.map((p, i) => ({ 
                      ...p, 
                      repeat_rate: 68 + Math.sin(i / 3) * 8 
                    })), 30)}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} domain={[60, 80]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                      <Line type="monotone" dataKey="repeat_rate" name="Repeat rate" stroke="#059669" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    <span className="text-slate-600">Repeat rate</span>
                  </div>
                </div>
              </div>

              {/* Top 5 products by revenue */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Top 5 products by revenue contribution</p>
                <div className="mt-4 space-y-3">
                  {(() => {
                    const allProducts = [
                      { name: 'Ring', shopify: '28.4%', amazon: '31.2%' },
                      { name: 'Necklace', shopify: '24.1%', amazon: '22.8%' },
                      { name: 'Bracelet', shopify: '19.7%', amazon: '18.5%' },
                      { name: 'Earring', shopify: '16.3%', amazon: '17.9%' },
                      { name: 'Pendant', shopify: '11.5%', amazon: '9.6%' },
                    ];
                    
                    if (summaryCategoryFilter !== 'all') {
                      const selectedCategory = SUMMARY_CATEGORY_LABELS[summaryCategoryFilter];
                      return allProducts.filter(p => p.name === selectedCategory).concat(
                        allProducts.filter(p => p.name !== selectedCategory).slice(0, 4)
                      );
                    }
                    
                    return allProducts;
                  })().map((product) => (
                    <div key={product.name} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{product.name}</span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-600">
                          <span className="font-semibold text-blue-600">{product.shopify}</span> Shopify
                        </span>
                        <span className="text-slate-600">
                          <span className="font-semibold text-cyan-600">{product.amazon}</span> Amazon
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 5 regions by revenue */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Top 5 regions by revenue contribution</p>
                <div className="mt-4 space-y-3">
                  {(() => {
                    const usDmas = [
                      { name: 'New York', shopify: '24.7%', amazon: '21.9%' },
                      { name: 'Los Angeles', shopify: '19.8%', amazon: '20.3%' },
                      { name: 'Chicago', shopify: '14.3%', amazon: '13.8%' },
                      { name: 'Dallas', shopify: '11.6%', amazon: '12.4%' },
                      { name: 'Houston', shopify: '8.2%', amazon: '7.9%' },
                    ];
                    
                    const ukDmas = [
                      { name: 'London', shopify: '42.3%', amazon: '38.7%' },
                      { name: 'Manchester', shopify: '18.4%', amazon: '19.2%' },
                      { name: 'Birmingham', shopify: '14.7%', amazon: '15.3%' },
                      { name: 'Leeds', shopify: '12.1%', amazon: '13.6%' },
                      { name: 'Glasgow', shopify: '8.5%', amazon: '9.2%' },
                    ];
                    
                    const uaeDmas = [
                      { name: 'Dubai', shopify: '58.3%', amazon: '54.2%' },
                      { name: 'Abu Dhabi', shopify: '24.7%', amazon: '26.8%' },
                      { name: 'Sharjah', shopify: '9.4%', amazon: '10.3%' },
                      { name: 'Ajman', shopify: '4.8%', amazon: '5.1%' },
                      { name: 'Ras Al Khaimah', shopify: '2.8%', amazon: '3.6%' },
                    ];
                    
                    if (summaryMarketFilter === 'US') return usDmas;
                    if (summaryMarketFilter === 'UK') return ukDmas;
                    if (summaryMarketFilter === 'UAE') return uaeDmas;
                    
                    // All markets - show top from each
                    return [
                      { name: 'New York (US)', shopify: '18.2%', amazon: '16.4%' },
                      { name: 'London (UK)', shopify: '15.7%', amazon: '14.9%' },
                      { name: 'Dubai (UAE)', shopify: '12.3%', amazon: '11.8%' },
                      { name: 'Los Angeles (US)', shopify: '10.8%', amazon: '11.2%' },
                      { name: 'Manchester (UK)', shopify: '8.4%', amazon: '9.1%' },
                    ];
                  })().map((region) => (
                    <div key={region.name} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{region.name}</span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-600">
                          <span className="font-semibold text-blue-600">{region.shopify}</span> Shopify
                        </span>
                        <span className="text-slate-600">
                          <span className="font-semibold text-cyan-600">{region.amazon}</span> Amazon
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Marketing Deep Dive Section */}
        <section className="mt-8">
          <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Marketing deep dive</p>
              <p className="mt-1 text-sm text-slate-600">
                Weekly view — last {selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'}
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              {/* Ad spend over time */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Ad spend over time</p>
                  <select 
                    value={marketingChannel}
                    onChange={(e) => setMarketingChannel(e.target.value as 'blended' | 'meta' | 'google')}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    <option value="blended">Blended</option>
                    <option value="meta">Meta</option>
                    <option value="google">Google</option>
                  </select>
                </div>
                <div className="mt-4 h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sampleObjects(dailyPoints, 30)}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => formatCurrencyCompact(Number(v))} />
                      {marketingChannel === 'blended' && (
                        <>
                          <Line type="monotone" dataKey="media_spend" name="Total ad spend" stroke="#0f172a" strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="google_spend" name="Google CPC" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </>
                      )}
                      {marketingChannel === 'meta' && (
                        <Line type="monotone" dataKey="media_spend" name="Meta Ads" stroke="#ef4444" strokeWidth={2.5} dot={false} />
                      )}
                      {marketingChannel === 'google' && (
                        <Line type="monotone" dataKey="google_spend" name="Google CPC" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  {marketingChannel === 'blended' && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-slate-900" />
                        <span className="text-slate-600">Total ad spend</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                        <span className="text-slate-600">Google CPC</span>
                      </div>
                    </>
                  )}
                  {marketingChannel === 'meta' && (
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      <span className="text-slate-600">Meta Ads</span>
                    </div>
                  )}
                  {marketingChannel === 'google' && (
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      <span className="text-slate-600">Google CPC</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Spend split donut */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Spend split</p>
                <div className="mt-4 flex items-center justify-center">
                  <div className="relative h-[140px] w-[140px]">
                    <svg viewBox="0 0 100 100" className="transform -rotate-90">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#3b82f6" strokeWidth="20" strokeDasharray="188.5 251.3" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#ef4444" strokeWidth="20" strokeDasharray="62.8 251.3" strokeDashoffset="-188.5" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-lg font-bold text-slate-900">100%</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                      <span className="text-slate-600">Google CPC</span>
                    </div>
                    <span className="font-semibold text-slate-900">75%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-red-500" />
                      <span className="text-slate-600">Meta Ads</span>
                    </div>
                    <span className="font-semibold text-slate-900">25%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Key metrics - Full width below */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Key metrics</p>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setMarketingChannel('blended')}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold ${marketingChannel === 'blended' ? 'bg-slate-100 text-slate-700' : 'text-slate-500'}`}
                  >
                    Blended
                  </button>
                  <button 
                    onClick={() => setMarketingChannel('meta')}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold ${marketingChannel === 'meta' ? 'bg-rose-100 text-rose-700' : 'text-slate-500'}`}
                  >
                    Meta
                  </button>
                  <button 
                    onClick={() => setMarketingChannel('google')}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold ${marketingChannel === 'google' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}
                  >
                    Google
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">ROAS</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {marketingChannel === 'meta' ? '2.42x' : marketingChannel === 'google' ? '3.18x' : '2.80x'}
                  </p>
                  <p className="text-[10px] text-slate-500">{marketingChannel === 'blended' ? 'Avg' : ''}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">CPA</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {marketingChannel === 'meta' ? '$16.80' : marketingChannel === 'google' ? '$12.40' : '$14.60'}
                  </p>
                  <p className="text-[10px] text-slate-500">{marketingChannel === 'blended' ? 'Avg' : ''}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">CTR</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {marketingChannel === 'meta' ? '3.18%' : marketingChannel === 'google' ? '1.94%' : '2.56%'}
                  </p>
                  <p className="text-[10px] text-slate-500">{marketingChannel === 'blended' ? 'Avg' : ''}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">CPC</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {marketingChannel === 'meta' ? '$0.94' : marketingChannel === 'google' ? '$1.32' : '$1.13'}
                  </p>
                  <p className="text-[10px] text-slate-500">{marketingChannel === 'blended' ? 'Avg' : ''}</p>
                </div>
              </div>
            </div>

            {/* Marketing funnel + Top campaigns */}
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {/* Marketing funnel */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Marketing — sales funnel</p>
                  <div className="flex gap-1 text-[10px] font-semibold">
                    <button 
                      onClick={() => setMarketingChannel('blended')}
                      className={`rounded-md px-2 py-1 ${marketingChannel === 'blended' ? 'bg-rose-50 text-rose-700' : 'text-slate-500'}`}
                    >
                      Blended
                    </button>
                    <button 
                      onClick={() => setMarketingChannel('meta')}
                      className={`rounded-md px-2 py-1 ${marketingChannel === 'meta' ? 'bg-rose-50 text-rose-700' : 'text-slate-500'}`}
                    >
                      Meta
                    </button>
                    <button 
                      onClick={() => setMarketingChannel('google')}
                      className={`rounded-md px-2 py-1 ${marketingChannel === 'google' ? 'bg-rose-50 text-rose-700' : 'text-slate-500'}`}
                    >
                      Google
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {(() => {
                    const metaData = [
                      { stage: 'Impressions', value: '1.8M', pct: 100 },
                      { stage: 'Clicks', value: '48.2k', pct: 82 },
                      { stage: 'Site sessions', value: '38.7k', pct: 67 },
                      { stage: 'Add to cart', value: '9.8k', pct: 41 },
                      { stage: 'Checkout initiated', value: '6.7k', pct: 28 },
                      { stage: 'Orders', value: '3.4k', pct: 18 },
                    ];
                    
                    const googleData = [
                      { stage: 'Impressions', value: '1.2M', pct: 100 },
                      { stage: 'Clicks', value: '38.4k', pct: 82 },
                      { stage: 'Site sessions', value: '29.2k', pct: 67 },
                      { stage: 'Add to cart', value: '7.2k', pct: 41 },
                      { stage: 'Checkout initiated', value: '5.1k', pct: 28 },
                      { stage: 'Orders', value: '2.8k', pct: 18 },
                    ];
                    
                    // Blended = sum of Meta + Google
                    const blendedData = [
                      { stage: 'Impressions', value: '3.0M', pct: 100 },
                      { stage: 'Clicks', value: '86.6k', pct: 82 },
                      { stage: 'Site sessions', value: '67.9k', pct: 67 },
                      { stage: 'Add to cart', value: '17.0k', pct: 41 },
                      { stage: 'Checkout initiated', value: '11.8k', pct: 28 },
                      { stage: 'Orders', value: '6.2k', pct: 18 },
                    ];
                    
                    const data = marketingChannel === 'meta' ? metaData : marketingChannel === 'google' ? googleData : blendedData;
                    
                    return data.map((item) => (
                      <div key={item.stage}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">{item.stage}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{item.value}</span>
                            <span className="text-slate-500">{item.pct}%</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div className={`h-2 rounded-full bg-rose-${600 - item.pct}`} style={{ width: `${item.pct}%` }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Top campaigns */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Top 5 campaigns by share of spend</p>
                <div className="mt-6 space-y-5">
                  {[
                    { name: 'Summer sale — LA', meta: '24.7%', google: '28.4%' },
                    { name: 'Retargeting — ATC', meta: '18.8%', google: '22.7%' },
                    { name: 'Broad — interest stack', meta: '16.3%', google: '18.6%' },
                    { name: 'DPA — catalog', meta: '14.1%', google: '15.3%' },
                    { name: 'UGC — new creative', meta: '9.7%', google: '8.9%' },
                  ].map((campaign) => (
                    <div key={campaign.name}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{campaign.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-slate-600">
                            <span className="font-semibold text-blue-600">{campaign.google}</span> Google
                          </span>
                          <span className="text-slate-600">
                            <span className="font-semibold text-rose-600">{campaign.meta}</span> Meta
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>

      {activeMetric && selectedMetricDefinition ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/40 px-3 py-3 backdrop-blur-[1px]">
          <div className="flex h-[76vh] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-[0_24px_72px_rgba(15,23,42,0.28)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
                  {detailSideLabel} / {detailSelection.market === "all" ? "All markets" : detailSelection.market} / {SUMMARY_CATEGORY_LABELS[detailSelection.category]} / {SUMMARY_SOURCE_LABELS[detailSelection.source]}
                </p>
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
                  <p className="text-sm text-slate-500">{detailSelectedDates[detailSelectedDates.length - 1] ? formatDayLabel(detailSelectedDates[detailSelectedDates.length - 1]) : "-"}</p>
                  <p className="text-3xl font-semibold text-slate-900">{formatMetricValue(selectedMetricDefinition, selectedMetricLatest)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">{detailSelectedDates[detailSelectedDates.length - 2] ? formatDayLabel(detailSelectedDates[detailSelectedDates.length - 2]) : "-"}</p>
                  <p className="text-3xl font-semibold text-slate-700">{formatMetricValue(selectedMetricDefinition, selectedMetricPrevious)}</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 p-3">
              {detailTab === "bars" ? (
                <div className="h-full rounded-xl border border-slate-200 bg-white p-2.5">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedMetricChartSeries}>
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} tickMargin={8} minTickGap={18} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} width={70} />
                      <Tooltip
                        formatter={(value) => formatTooltipValue(selectedMetricDefinition, value)}
                        labelStyle={{ fontWeight: 600, color: "#0f172a" }}
                        contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1", boxShadow: "0 8px 24px rgba(15,23,42,0.12)" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name={selectedMetricDefinition.label}
                        stroke={selectedMetricDefinition.accent}
                        strokeWidth={2.8}
                        dot={false}
                      />
                    </LineChart>
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
