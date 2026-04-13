import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { runPrediction } from "../services/api";
import { FY25_DEFAULT_CUSTOM_END, FY25_DEFAULT_CUSTOM_START, FY25_END_DATE, FY25_START_DATE } from "./summaryConfig";

type Market = "US" | "UK";
type CampaignType = "youtube" | "google_pmax";

const MARKET_OPTIONS: Market[] = ["US", "UK"];

const DMA_OPTIONS: Record<Market, string[]> = {
  US: ["New York", "Chicago", "Boston", "Los Angeles", "San Francisco", "San Diego", "Dallas", "Houston"],
  UK: ["London", "Manchester", "Birmingham", "Glasgow", "Edinburgh", "Leeds", "Liverpool", "Bristol"],
};

interface CampaignOption {
  id: string;
  name: string;
  platform: CampaignType;
  activeDmas: string[];
  similarDmaGroups: Record<string, string[]>;
}

const CAMPAIGN_LIBRARY: Record<Market, CampaignOption[]> = {
  US: [
    {
      id: "us_yt_reach",
      name: "US YouTube Reach",
      platform: "youtube",
      activeDmas: ["New York", "Chicago"],
      similarDmaGroups: {
        "New York": ["Chicago", "Boston"],
        Chicago: ["New York", "Boston"],
      },
    },
    {
      id: "us_yt_creators",
      name: "Creator Prospecting",
      platform: "youtube",
      activeDmas: ["Los Angeles", "San Francisco"],
      similarDmaGroups: {
        "Los Angeles": ["San Francisco", "San Diego"],
        "San Francisco": ["Los Angeles", "San Diego"],
      },
    },
    {
      id: "us_pmax_scale",
      name: "PMax Scale Up",
      platform: "google_pmax",
      activeDmas: ["Dallas", "Houston"],
      similarDmaGroups: {
        Dallas: ["Houston", "Chicago"],
        Houston: ["Dallas", "Chicago"],
      },
    },
  ],
  UK: [
    {
      id: "uk_yt_awareness",
      name: "UK YouTube Awareness",
      platform: "youtube",
      activeDmas: ["London", "Manchester"],
      similarDmaGroups: {
        London: ["Manchester", "Birmingham"],
        Manchester: ["London", "Birmingham"],
      },
    },
    {
      id: "uk_pmax_core",
      name: "PMax Core",
      platform: "google_pmax",
      activeDmas: ["London", "Manchester"],
      similarDmaGroups: {
        London: ["Manchester", "Birmingham"],
        Manchester: ["London", "Birmingham"],
      },
    },
    {
      id: "uk_pmax_gifting",
      name: "PMax Gifting Push",
      platform: "google_pmax",
      activeDmas: ["Glasgow", "Edinburgh"],
      similarDmaGroups: {
        Glasgow: ["Edinburgh", "Leeds"],
        Edinburgh: ["Glasgow", "Leeds"],
      },
    },
  ],
};

interface AnalysisConfig {
  market: Market;
  platform: CampaignType;
  campaignId: string;
  dma: string;
  startDate: string;
  endDate: string;
}

interface DailyMarketRow {
  date: string;
  market: Market;
  dma: string;
  revenue: number;
  orders: number;
  mediaSpend: number;
  googleSpend: number;
  metaSpend: number;
  googleRevenue: number;
  metaRevenue: number;
  newCustomers: number;
}

interface CampaignAssessmentRow {
  date: string;
  label: string;
  google_spend: number;
  meta_spend: number;
  meta_revenue: number;
  meta_effectiveness_factor: number;
  youtube_spend: number;
  campaign_revenue: number;
  weekend_flag: number;
  trend_index: number;
  seasonality_sin: number;
  seasonality_cos: number;
  actual_revenue: number;
  actual_orders: number;
}

interface CampaignAssessmentResult {
  baselineDays: number;
  campaignDays: number;
  campaignSpend: number;
  metaSpend: number;
  campaignRevenue: number;
  metaRevenue: number;
  actualRevenue: number;
  actualOrders: number;
  previousOrders: number;
  previousRevenue: number;
  predictedWithoutCampaignRevenue: number;
  predictedMetaReallocationRevenue: number;
  incrementalRevenue: number;
  incrementalRoas: number;
  metaScenarioLift: number;
  metaScenarioRoas: number;
  baselineMetaEffectiveness: number;
  overlapMetaEffectiveness: number;
  metaEffectivenessChange: number;
  betas: Record<string, number>;
  metrics: Record<string, number>;
  chartRows: Array<{
    label: string;
    actual: number;
    predicted: number | null;
    isCampaign: boolean;
    weekStart: string;
  }>;
  campaignStartIndex: number;
}

const CAMPAIGN_FEATURE_COLUMNS = ["google_spend", "meta_spend", "weekend_flag", "trend_index", "seasonality_sin", "seasonality_cos"];

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

const getWeekLabel = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  return `${month} ${day}`;
};

const getMondayOfWeek = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days, otherwise go to Monday
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday.toISOString().slice(0, 10);
};

const aggregateToWeekly = (rows: Array<{ label: string; actual: number; predicted: number; isCampaign: boolean; date: string }>) => {
  const weekMap = new Map<string, { actual: number; predicted: number; count: number; isCampaign: boolean; startDate: string }>();
  
  rows.forEach((row) => {
    const weekKey = getMondayOfWeek(row.date);
    
    const existing = weekMap.get(weekKey);
    if (existing) {
      existing.actual += row.actual;
      existing.predicted += row.predicted;
      existing.count += 1;
      if (row.isCampaign) existing.isCampaign = true;
    } else {
      weekMap.set(weekKey, {
        actual: row.actual,
        predicted: row.predicted,
        count: 1,
        isCampaign: row.isCampaign,
        startDate: weekKey,
      });
    }
  });
  
  const sortedWeeks = Array.from(weekMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  // Find the first campaign week index
  const firstCampaignIndex = sortedWeeks.findIndex(([_, data]) => data.isCampaign);
  
  return sortedWeeks.map(([weekKey, data], index) => {
    let predictedValue = null;
    
    if (firstCampaignIndex >= 0) {
      if (index === firstCampaignIndex - 1) {
        // Week before campaign: use actual value
        predictedValue = roundCurrency(data.actual);
      } else if (index >= firstCampaignIndex) {
        // Campaign weeks: use predicted value
        predictedValue = roundCurrency(data.predicted);
      }
    }
    
    return {
      label: getWeekLabel(data.startDate),
      actual: roundCurrency(data.actual),
      predicted: predictedValue,
      isCampaign: data.isCampaign,
      weekStart: data.startDate,
    };
  });
};

const formatCurrencyCompact = (value: number) => {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

const getCampaignLabel = (campaign: CampaignType) => (campaign === "youtube" ? "YouTube" : "Google Performance Max");
const getMetaScenarioLabel = (campaign: CampaignType) => (campaign === "youtube" ? "Advantage+ Meta Campaign" : "Meta continuation");

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

const generateMockRows = (): DailyMarketRow[] => {
  const rows: DailyMarketRow[] = [];
  const allDates = getIsoDatesBetween(FY25_START_DATE, FY25_END_DATE);
  const marketScale: Record<Market, number> = { US: 1.42, UK: 1 };

  allDates.forEach((isoDate, dayIndex) => {
    const currentDate = new Date(`${isoDate}T00:00:00`);
    const weekday = currentDate.getDay();
    const weekendFactor = weekday === 0 || weekday === 6 ? 1.07 : 1;
    const seasonality = 1 + 0.14 * Math.sin((dayIndex / allDates.length) * Math.PI * 2) + 0.06 * Math.sin((dayIndex / 30) * Math.PI * 2);

    (Object.keys(marketScale) as Market[]).forEach((market, marketIndex) => {
      DMA_OPTIONS[market].forEach((dma, dmaIndex) => {
        const seedBase = dayIndex * 13 + marketIndex * 71 + dmaIndex * 131;
        const dmaScale = 0.84 + dmaIndex * 0.12 + seededNoise(seedBase + 1) * 0.08;
        const scale = marketScale[market] * dmaScale;
        const orderNoise = seededNoise(seedBase + 2);
        const valueNoise = seededNoise(seedBase + 4);
        const spendNoise = seededNoise(seedBase + 6);
        const roasNoise = seededNoise(seedBase + 8);
        const newCustomerNoise = seededNoise(seedBase + 10);

        const orders = Math.max(32, Math.round((88 + orderNoise * 58) * seasonality * weekendFactor * scale));
        const aov = 56 + scale * 8 + valueNoise * 22;
        const revenue = roundCurrency(orders * aov);
        const mediaSpend = roundCurrency(revenue * (0.16 + spendNoise * 0.1));
        const googleShare = Math.max(0.34, Math.min(0.74, 0.52 + Math.sin(dayIndex / 18 + marketIndex + dmaIndex * 0.35) * 0.1));
        const googleSpend = roundCurrency(mediaSpend * googleShare);
        const metaSpend = roundCurrency(mediaSpend - googleSpend);
        const googleRoas = 2.18 + roasNoise * 1.6;
        const metaRoas = 1.82 + seededNoise(seedBase + 9) * 1.45;

        rows.push({
          date: isoDate,
          market,
          dma,
          revenue,
          orders,
          mediaSpend,
          googleSpend,
          metaSpend,
          googleRevenue: roundCurrency(googleSpend * googleRoas),
          metaRevenue: roundCurrency(metaSpend * metaRoas),
          newCustomers: Math.min(orders, Math.round(orders * (0.21 + newCustomerNoise * 0.18))),
        });
      });
    });
  });

  return rows;
};

const scoreWithCoefficients = (row: CampaignAssessmentRow | Record<string, unknown>, coefficients: Record<string, number>) => {
  const lookup = row as Record<string, unknown>;
  return CAMPAIGN_FEATURE_COLUMNS.reduce((sum, feature) => sum + (coefficients[feature] ?? 0) * Number(lookup[feature] ?? 0), coefficients.intercept ?? 0);
};

const buildCampaignTimelineRows = (
  allRows: DailyMarketRow[],
  market: Market,
  dma: string,
  campaignType: CampaignType,
  campaignEnabled: boolean,
  campaignStartDate: string,
  campaignEndDate: string
) => {
  return allRows
    .filter((row) => row.market === market && row.dma === dma)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row, index, marketRows) => {
      const dateObject = new Date(`${row.date}T00:00:00`);
      const dayOfYear = Math.floor((dateObject.getTime() - new Date(`${dateObject.getFullYear()}-01-01T00:00:00`).getTime()) / 86400000) + 1;
      const isCampaign = campaignEnabled && row.date >= campaignStartDate && row.date <= campaignEndDate;
      const marketLift = market === "US" ? 1.15 : 0.92;
      const dmaLift = 0.88 + (DMA_OPTIONS[market].indexOf(dma) + 1) * 0.09;
      const campaignSpendBase = campaignType === "youtube" ? 1 : 1.18;
      const campaignRoasBase = campaignType === "youtube" ? 1.65 : 1.92;
      const metaOverlapBase = campaignType === "youtube" ? 0.94 : 0.985;
      const campaignSpend = isCampaign
        ? roundCurrency((210 + seededNoise(index * 41 + marketRows.length) * 190 + (index % 5) * 18) * marketLift * dmaLift * campaignSpendBase)
        : 0;
      const campaignRoas = campaignRoasBase + seededNoise(index * 17 + 9) * 0.85;
      const campaignIncrementalRevenue = roundCurrency(campaignSpend * campaignRoas);
      const overlapNoise = (seededNoise(index * 29 + DMA_OPTIONS[market].indexOf(dma) * 17) - 0.5) * 0.1;
      const metaOverlapFactor = isCampaign ? Math.max(0.84, Math.min(1.08, metaOverlapBase + overlapNoise)) : 1;
      const adjustedMetaRevenue = roundCurrency(row.metaRevenue * metaOverlapFactor);

      return {
        date: row.date,
        label: formatDayLabel(row.date),
        google_spend: row.googleSpend,
        meta_spend: row.metaSpend,
        meta_revenue: adjustedMetaRevenue,
        meta_effectiveness_factor: Number(metaOverlapFactor.toFixed(3)),
        youtube_spend: campaignSpend,
        campaign_revenue: campaignIncrementalRevenue,
        weekend_flag: dateObject.getDay() === 0 || dateObject.getDay() === 6 ? 1 : 0,
        trend_index: Number(((index + 1) / marketRows.length).toFixed(6)),
        seasonality_sin: Number(Math.sin((2 * Math.PI * dayOfYear) / 365).toFixed(6)),
        seasonality_cos: Number(Math.cos((2 * Math.PI * dayOfYear) / 365).toFixed(6)),
        actual_revenue: roundCurrency(row.revenue - row.metaRevenue + adjustedMetaRevenue + campaignIncrementalRevenue),
        actual_orders: row.orders,
      };
    });
};

const buildCampaignAssessmentRows = (
  allRows: DailyMarketRow[],
  market: Market,
  dma: string,
  campaignType: CampaignType,
  campaignEnabled: boolean,
  campaignStartDate: string,
  campaignEndDate: string
) => {
  const rows = buildCampaignTimelineRows(allRows, market, dma, campaignType, campaignEnabled, campaignStartDate, campaignEndDate);
  return {
    baselineRows: rows.filter((row) => row.date < campaignStartDate),
    campaignRows: rows.filter((row) => row.date >= campaignStartDate && row.date <= campaignEndDate),
  };
};

export function CampaignAssessmentPage() {
  const initialCampaign = CAMPAIGN_LIBRARY.US[0];

  const [assessmentMarket, setAssessmentMarket] = useState<Market>("US");
  const [assessmentPlatform, setAssessmentPlatform] = useState<CampaignType>(initialCampaign.platform);
  const [assessmentCampaignId, setAssessmentCampaignId] = useState<string>(initialCampaign.id);
  const [assessmentDma, setAssessmentDma] = useState<string>(initialCampaign.activeDmas[0]);
  const [assessmentStartDate, setAssessmentStartDate] = useState(FY25_DEFAULT_CUSTOM_START);
  const [assessmentEndDate, setAssessmentEndDate] = useState(FY25_DEFAULT_CUSTOM_END);
  const [analysisConfig, setAnalysisConfig] = useState<AnalysisConfig | null>(null);
  const [isSetupExpanded, setIsSetupExpanded] = useState(true);
  const [campaignAssessment, setCampaignAssessment] = useState<CampaignAssessmentResult | null>(null);
  const [campaignAssessmentError, setCampaignAssessmentError] = useState<string | null>(null);
  const [isCampaignAssessmentLoading, setIsCampaignAssessmentLoading] = useState(false);

  const allRows = useMemo(() => generateMockRows(), []);
  const marketCampaigns = useMemo(() => CAMPAIGN_LIBRARY[assessmentMarket], [assessmentMarket]);
  const platformOptions = useMemo(
    () => Array.from(new Set(marketCampaigns.map((campaign) => campaign.platform))),
    [marketCampaigns]
  );
  const campaignOptions = useMemo(
    () => marketCampaigns.filter((campaign) => campaign.platform === assessmentPlatform),
    [assessmentPlatform, marketCampaigns]
  );
  const selectedCampaignOption = useMemo(
    () => campaignOptions.find((campaign) => campaign.id === assessmentCampaignId) ?? campaignOptions[0] ?? null,
    [assessmentCampaignId, campaignOptions]
  );
  const availableDmas = selectedCampaignOption?.activeDmas ?? [];

  useEffect(() => {
    if (!platformOptions.includes(assessmentPlatform)) {
      setAssessmentPlatform(platformOptions[0]);
    }
  }, [assessmentPlatform, platformOptions]);

  useEffect(() => {
    if (!campaignOptions.some((campaign) => campaign.id === assessmentCampaignId)) {
      setAssessmentCampaignId(campaignOptions[0]?.id ?? "");
    }
  }, [assessmentCampaignId, campaignOptions]);

  useEffect(() => {
    if (!availableDmas.includes(assessmentDma)) {
      setAssessmentDma(availableDmas[0]);
    }
  }, [assessmentDma, availableDmas]);

  const activeCampaignOption = useMemo(() => {
    if (!analysisConfig) return null;
    return CAMPAIGN_LIBRARY[analysisConfig.market].find((campaign) => campaign.id === analysisConfig.campaignId) ?? null;
  }, [analysisConfig]);

  const activeMarket = analysisConfig?.market ?? assessmentMarket;
  const activeDma = analysisConfig?.dma ?? assessmentDma;
  const activeStartDate = analysisConfig?.startDate ?? assessmentStartDate;
  const activeEndDate = analysisConfig?.endDate ?? assessmentEndDate;
  const selectedPlatformLabel = getCampaignLabel(activeCampaignOption?.platform ?? selectedCampaignOption?.platform ?? "youtube");
  const selectedCampaignName = activeCampaignOption?.name ?? selectedCampaignOption?.name ?? "Campaign";
  const selectedMetaScenarioLabel = getMetaScenarioLabel(activeCampaignOption?.platform ?? selectedCampaignOption?.platform ?? "youtube");
  const comparisonDmas = useMemo(() => {
    if (!analysisConfig || !activeCampaignOption) return [];
    return activeCampaignOption.similarDmaGroups[analysisConfig.dma] ?? [];
  }, [activeCampaignOption, analysisConfig]);

  const campaignWindowDates = useMemo(() => {
    if (!analysisConfig) return [];
    return getIsoDatesBetween(activeStartDate, activeEndDate);
  }, [activeEndDate, activeStartDate, analysisConfig]);
  const previousPeriodRange = useMemo(() => {
    if (!analysisConfig) return null;
    const duration = Math.max(campaignWindowDates.length, 1);
    const start = new Date(`${activeStartDate}T00:00:00`);
    const previousEnd = new Date(start);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - (duration - 1));
    return {
      start: previousStart.toISOString().slice(0, 10),
      end: previousEnd.toISOString().slice(0, 10),
    };
  }, [activeStartDate, analysisConfig, campaignWindowDates.length]);

  const campaignScenarioRows = useMemo(
    () =>
      analysisConfig && activeCampaignOption
        ? buildCampaignAssessmentRows(allRows, analysisConfig.market, analysisConfig.dma, activeCampaignOption.platform, true, analysisConfig.startDate, analysisConfig.endDate)
        : null,
    [activeCampaignOption, allRows, analysisConfig]
  );

  useEffect(() => {
    let cancelled = false;

    const loadCampaignAssessment = async () => {
      if (!analysisConfig || !campaignScenarioRows || !activeCampaignOption) return;

      const { baselineRows, campaignRows } = campaignScenarioRows;

      if (baselineRows.length < 30) {
        setCampaignAssessment(null);
        setCampaignAssessmentError("Campaign assessment needs at least 30 baseline days before the campaign starts.");
        setIsCampaignAssessmentLoading(false);
        return;
      }

      if (campaignRows.length === 0) {
        setCampaignAssessment(null);
        setCampaignAssessmentError("Select a valid campaign period inside the available FY25 date range.");
        setIsCampaignAssessmentLoading(false);
        return;
      }

      setIsCampaignAssessmentLoading(true);
      setCampaignAssessmentError(null);

      const modelResult = await runPrediction({
        data: baselineRows.map((row) => ({
          google_spend: row.google_spend,
          meta_spend: row.meta_spend,
          weekend_flag: row.weekend_flag,
          trend_index: row.trend_index,
          seasonality_sin: row.seasonality_sin,
          seasonality_cos: row.seasonality_cos,
          actual_revenue: row.actual_revenue,
        })),
        target_column: "actual_revenue",
        feature_columns: CAMPAIGN_FEATURE_COLUMNS,
        model_type: "ridge",
        standardization: "standardize",
      });

      if (cancelled) return;

      if (modelResult.error || !modelResult.data?.coefficients) {
        setCampaignAssessment(null);
        setCampaignAssessmentError(modelResult.error ?? "Unable to estimate the campaign baseline model.");
        setIsCampaignAssessmentLoading(false);
        return;
      }

      const coefficients = modelResult.data.coefficients;
      
      // Include baseline data for the chart (last 4 weeks before campaign)
      const baselineChartRows = baselineRows.slice(-28).map((row) => {
        const predicted = scoreWithCoefficients(row, coefficients);
        return {
          label: row.label,
          date: row.date,
          actual: row.actual_revenue,
          predicted: roundCurrency(predicted),
          isCampaign: false,
        };
      });
      
      const campaignChartRows = campaignRows.map((row) => {
        const predicted = scoreWithCoefficients(row, coefficients);
        return {
          label: row.label,
          date: row.date,
          actual: row.actual_revenue,
          predicted: roundCurrency(predicted),
          isCampaign: true,
        };
      });
      
      const allRows = [...baselineChartRows, ...campaignChartRows];
      const chartRows = aggregateToWeekly(allRows);
      const campaignStartIndex = chartRows.findIndex(row => row.isCampaign);

      const campaignSpend = roundCurrency(campaignRows.reduce((sum, row) => sum + row.youtube_spend, 0));
      const metaSpend = roundCurrency(campaignRows.reduce((sum, row) => sum + row.meta_spend, 0));
      const campaignRevenue = roundCurrency(campaignRows.reduce((sum, row) => sum + row.campaign_revenue, 0));
      const metaRevenue = roundCurrency(campaignRows.reduce((sum, row) => sum + row.meta_revenue, 0));
      const actualRevenue = roundCurrency(campaignChartRows.reduce((sum, row) => sum + row.actual, 0));
      const predictedRevenue = roundCurrency(campaignChartRows.reduce((sum, row) => sum + row.predicted, 0));
      const incrementalRevenue = roundCurrency(actualRevenue - predictedRevenue);
      const actualOrders = Math.round(campaignRows.reduce((sum, row) => sum + row.actual_orders, 0));
      const previousOrders = Math.round(baselineRows.slice(-campaignRows.length).reduce((sum, row) => sum + row.actual_orders, 0));
      const previousRevenue = roundCurrency(baselineRows.slice(-campaignRows.length).reduce((sum, row) => sum + row.actual_revenue, 0));
      const averageMetaEffectivenessFactor = Number(
        (
          campaignRows.reduce((sum, row) => sum + row.meta_effectiveness_factor, 0) /
          Math.max(campaignRows.length, 1)
        ).toFixed(3)
      );
      const baselineMetaEffectiveness = 1;
      const overlapMetaEffectiveness = Number((baselineMetaEffectiveness * averageMetaEffectivenessFactor).toFixed(2));
      const metaEffectivenessChange = Number((((overlapMetaEffectiveness - baselineMetaEffectiveness) / baselineMetaEffectiveness) * 100).toFixed(1));

      setCampaignAssessment({
        baselineDays: baselineRows.length,
        campaignDays: campaignRows.length,
        campaignSpend,
        metaSpend,
        campaignRevenue,
        metaRevenue,
        actualRevenue,
        actualOrders,
        previousOrders,
        previousRevenue,
        predictedWithoutCampaignRevenue: predictedRevenue,
        predictedMetaReallocationRevenue: predictedRevenue,
        incrementalRevenue,
        incrementalRoas: Number(safeDivide(incrementalRevenue, campaignSpend).toFixed(2)),
        metaScenarioLift: 0,
        metaScenarioRoas: 0,
        baselineMetaEffectiveness,
        overlapMetaEffectiveness,
        metaEffectivenessChange,
        betas: modelResult.data.betas ?? {},
        metrics: modelResult.data.metrics ?? {},
        chartRows,
        campaignStartIndex,
      });
      setIsCampaignAssessmentLoading(false);
    };

    void loadCampaignAssessment();
    return () => {
      cancelled = true;
    };
  }, [activeCampaignOption, analysisConfig, campaignScenarioRows]);

  const metaEffectSummary = useMemo(() => {
    if (!campaignAssessment) return null;
    const change = campaignAssessment.metaEffectivenessChange;
    if (change <= -3) {
      return {
        headline: "Meta efficiency softened",
        toneClass: "text-rose-700",
        boxClass: "border-rose-200 bg-rose-50",
        detail: `${Math.abs(change).toFixed(1)}% lower modeled Meta effectiveness from the beta shift`,
      };
    }
    if (change >= 3) {
      return {
        headline: "Meta efficiency improved",
        toneClass: "text-emerald-700",
        boxClass: "border-emerald-200 bg-emerald-50",
        detail: `${Math.abs(change).toFixed(1)}% higher modeled Meta effectiveness from the beta shift`,
      };
    }
    return {
      headline: "Meta efficiency stayed stable",
      toneClass: "text-slate-700",
      boxClass: "border-slate-200 bg-slate-50",
      detail: "Only a small modeled beta shift vs the pre-campaign baseline",
    };
  }, [campaignAssessment]);

  const similarRegionPerformance = useMemo(() => {
    if (!analysisConfig || !activeCampaignOption || !previousPeriodRange) return null;

    const dmasToCompare = [activeDma, ...comparisonDmas];
    if (dmasToCompare.length === 0) return null;

    const dmaSummaries = dmasToCompare
      .map((dma) => {
        const campaignActive = activeCampaignOption.activeDmas.includes(dma);
        const timelineRows = buildCampaignTimelineRows(
          allRows,
          activeMarket,
          dma,
          activeCampaignOption.platform,
          campaignActive,
          activeStartDate,
          activeEndDate
        );

        const currentRows = timelineRows.filter((row) => row.date >= activeStartDate && row.date <= activeEndDate);
        const previousRows = timelineRows.filter((row) => row.date >= previousPeriodRange.start && row.date <= previousPeriodRange.end);
        if (currentRows.length === 0 || previousRows.length === 0) return null;

        const currentRevenue = roundCurrency(currentRows.reduce((sum, row) => sum + row.actual_revenue, 0));
        const previousRevenue = roundCurrency(previousRows.reduce((sum, row) => sum + row.actual_revenue, 0));
        const periodChangePct = previousRevenue === 0 ? 0 : Number((((currentRevenue - previousRevenue) / Math.abs(previousRevenue)) * 100).toFixed(1));
        
        const currentOrders = Math.round(currentRows.reduce((sum, row) => sum + row.actual_orders, 0));
        const previousOrders = Math.round(previousRows.reduce((sum, row) => sum + row.actual_orders, 0));
        const volumeChangePct = previousOrders === 0 ? 0 : Number((((currentOrders - previousOrders) / Math.abs(previousOrders)) * 100).toFixed(1));
        
        return {
          dma,
          campaignActive,
          currentRevenue,
          previousRevenue,
          periodChangePct,
          currentOrders,
          previousOrders,
          volumeChangePct,
        };
      })
      .filter((summary): summary is { dma: string; campaignActive: boolean; currentRevenue: number; previousRevenue: number; periodChangePct: number; currentOrders: number; previousOrders: number; volumeChangePct: number } => Boolean(summary));

    const selectedSummary = dmaSummaries.find((summary) => summary.dma === activeDma);
    const comparisonRegions = dmaSummaries.filter((summary) => summary.dma !== activeDma);
    if (!selectedSummary || comparisonRegions.length === 0) return null;

    const averageComparisonChange = comparisonRegions.reduce((sum, region) => sum + region.periodChangePct, 0) / comparisonRegions.length;
    const selectedLiftPct = Number((selectedSummary.periodChangePct - averageComparisonChange).toFixed(1));

    return {
      selectedSummary,
      selectedLiftPct,
      comparisonRegions,
    };
  }, [activeCampaignOption, activeDma, activeEndDate, activeMarket, activeStartDate, allRows, analysisConfig, comparisonDmas, previousPeriodRange]);

  const spendSplitSummary = useMemo(() => {
    if (!campaignAssessment || !analysisConfig || !activeCampaignOption || !previousPeriodRange) return null;

    const selectedTimelineRows = buildCampaignTimelineRows(
      allRows,
      activeMarket,
      activeDma,
      activeCampaignOption.platform,
      true,
      activeStartDate,
      activeEndDate
    );

    const currentRows = selectedTimelineRows.filter((row) => row.date >= activeStartDate && row.date <= activeEndDate);
    const previousRows = selectedTimelineRows.filter((row) => row.date >= previousPeriodRange.start && row.date <= previousPeriodRange.end);

    const currentSpend = roundCurrency(currentRows.reduce((sum, row) => sum + row.meta_spend + row.youtube_spend, 0));
    const previousSpend = roundCurrency(previousRows.reduce((sum, row) => sum + row.meta_spend + row.youtube_spend, 0));
    const currentRevenue = roundCurrency(currentRows.reduce((sum, row) => sum + row.actual_revenue, 0));
    const previousRevenue = roundCurrency(previousRows.reduce((sum, row) => sum + row.actual_revenue, 0));

    const regionalCurrentSpend = roundCurrency(
      DMA_OPTIONS[activeMarket].reduce((sum, dma) => {
        const dmaRows = buildCampaignTimelineRows(
          allRows,
          activeMarket,
          dma,
          activeCampaignOption.platform,
          activeCampaignOption.activeDmas.includes(dma),
          activeStartDate,
          activeEndDate
        ).filter((row) => row.date >= activeStartDate && row.date <= activeEndDate);
        return sum + dmaRows.reduce((dmaSum, row) => dmaSum + row.meta_spend + row.youtube_spend, 0);
      }, 0)
    );

    const regionalCurrentRevenue = roundCurrency(
      DMA_OPTIONS[activeMarket].reduce((sum, dma) => {
        const dmaRows = buildCampaignTimelineRows(
          allRows,
          activeMarket,
          dma,
          activeCampaignOption.platform,
          activeCampaignOption.activeDmas.includes(dma),
          activeStartDate,
          activeEndDate
        ).filter((row) => row.date >= activeStartDate && row.date <= activeEndDate);
        return sum + dmaRows.reduce((dmaSum, row) => dmaSum + row.actual_revenue, 0);
      }, 0)
    );

    const metaShare = currentSpend === 0 ? 0 : Number(((campaignAssessment.metaSpend / currentSpend) * 100).toFixed(1));
    const campaignShare = currentSpend === 0 ? 0 : Number(((campaignAssessment.campaignSpend / currentSpend) * 100).toFixed(1));
    const dmaSpendShare = regionalCurrentSpend === 0 ? 0 : Number(((currentSpend / regionalCurrentSpend) * 100).toFixed(1));
    const dmaRevenueShare = regionalCurrentRevenue === 0 ? 0 : Number(((currentRevenue / regionalCurrentRevenue) * 100).toFixed(1));
    const revenueVsLast = previousRevenue === 0 ? 0 : Number((((currentRevenue - previousRevenue) / Math.abs(previousRevenue)) * 100).toFixed(1));
    const spendVsLast = previousSpend === 0 ? 0 : Number((((currentSpend - previousSpend) / Math.abs(previousSpend)) * 100).toFixed(1));

    return {
      metaShare,
      campaignShare,
      currentRevenue,
      dmaRevenueShare,
      dmaSpendShare,
      revenueVsLast,
      spendVsLast,
    };
  }, [activeCampaignOption, activeDma, activeEndDate, activeMarket, activeStartDate, allRows, analysisConfig, campaignAssessment, previousPeriodRange]);

  const handleRunAnalysis = () => {
    if (!selectedCampaignOption || !assessmentDma) return;

    setCampaignAssessment(null);
    setCampaignAssessmentError(null);
    setAnalysisConfig({
      market: assessmentMarket,
      platform: selectedCampaignOption.platform,
      campaignId: selectedCampaignOption.id,
      dma: assessmentDma,
      startDate: assessmentStartDate,
      endDate: assessmentEndDate,
    });
    setIsSetupExpanded(false);
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_20%_0%,rgba(14,165,233,0.14),transparent_36%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.12),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#ffffff_56%,#eef2ff_100%)] px-6 py-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                  Campaign Performance Assessment
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Estimate the lift of a campaign launch.</h3>
              </div>
            </div>

            {!analysisConfig || isSetupExpanded ? (
              <div className="mt-5 rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] p-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  <label className="text-xs font-semibold text-slate-500">
                    Region
                    <select
                      value={assessmentMarket}
                      onChange={(event) => setAssessmentMarket(event.target.value as Market)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    >
                      {MARKET_OPTIONS.map((market) => (
                        <option key={market} value={market}>
                          {market}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    Platform
                    <select
                      value={assessmentPlatform}
                      onChange={(event) => setAssessmentPlatform(event.target.value as CampaignType)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    >
                      {platformOptions.map((platform) => (
                        <option key={platform} value={platform}>
                          {getCampaignLabel(platform)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    Campaign
                    <select
                      value={assessmentCampaignId}
                      onChange={(event) => setAssessmentCampaignId(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    >
                      {campaignOptions.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    DMA
                    <select
                      value={assessmentDma}
                      onChange={(event) => setAssessmentDma(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    >
                      {availableDmas.map((dma) => (
                        <option key={dma} value={dma}>
                          {dma}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    Campaign start (Monday)
                    <input 
                      type="date" 
                      min={FY25_START_DATE} 
                      max={assessmentEndDate} 
                      value={assessmentStartDate} 
                      onChange={(event) => { 
                        const selectedDate = event.target.value;
                        const monday = getMondayOfWeek(selectedDate);
                        setAssessmentStartDate(monday); 
                        if (monday > assessmentEndDate) setAssessmentEndDate(monday); 
                      }} 
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" 
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    Campaign end (Sunday)
                    <input 
                      type="date" 
                      min={assessmentStartDate} 
                      max={FY25_END_DATE} 
                      value={assessmentEndDate} 
                      onChange={(event) => {
                        const selectedDate = event.target.value;
                        const date = new Date(`${selectedDate}T00:00:00`);
                        const day = date.getDay();
                        const diff = day === 0 ? 0 : 7 - day; // If Sunday, keep it, otherwise go to next Sunday
                        const sunday = new Date(date);
                        sunday.setDate(date.getDate() + diff);
                        setAssessmentEndDate(sunday.toISOString().slice(0, 10));
                      }} 
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" 
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    {availableDmas.length} active DMAs for {selectedCampaignOption?.name ?? "this campaign"}
                  </p>
                  <div className="flex items-center gap-3">
                    {analysisConfig ? (
                      <button
                        type="button"
                        onClick={() => setIsSetupExpanded(false)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleRunAnalysis}
                      disabled={!selectedCampaignOption || !assessmentDma}
                      className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {analysisConfig ? "Rerun analysis" : "Run analysis"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {[
                      activeMarket,
                      activeDma,
                      selectedPlatformLabel,
                      selectedCampaignName,
                      `${activeStartDate} to ${activeEndDate}`,
                    ].map((item) => (
                      <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {item}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSetupExpanded(true)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                  >
                    Edit setup
                  </button>
                </div>
              </div>
            )}

            {campaignAssessmentError ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{campaignAssessmentError}</div> : null}
            {isCampaignAssessmentLoading ? <div className="mt-5 grid gap-4 lg:grid-cols-3"><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /></div> : null}

            {!isCampaignAssessmentLoading && !campaignAssessmentError && campaignAssessment ? (
              <div className="mt-5 lg:sticky lg:top-4 lg:z-20 lg:-mx-2 lg:rounded-[26px] lg:bg-white/95 lg:px-2 lg:py-2 lg:shadow-[0_18px_45px_rgba(15,23,42,0.10)] lg:backdrop-blur">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Actual Volume</p>
                  <p className="mt-1 text-xs text-slate-500">Orders during campaign</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-950">{campaignAssessment.actualOrders.toLocaleString()}</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Counterfactual Volume</p>
                  <p className="mt-1 text-xs text-slate-500">Without {selectedPlatformLabel}</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-950">{campaignAssessment.previousOrders.toLocaleString()}</p>
                </div>
                <div className="rounded-[24px] border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-4 shadow-[0_12px_30px_rgba(147,51,234,0.10)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-700">Volume Change</p>
                  <p className="mt-1 text-xs text-purple-700/75">Impact of campaign</p>
                  <p className="mt-3 text-3xl font-semibold text-purple-800">
                    {campaignAssessment.previousOrders > 0 ? (
                      <>
                        {((campaignAssessment.actualOrders - campaignAssessment.previousOrders) / campaignAssessment.previousOrders * 100) > 0 ? '+' : ''}
                        {Math.round(((campaignAssessment.actualOrders - campaignAssessment.previousOrders) / campaignAssessment.previousOrders) * 100)}%
                      </>
                    ) : 'N/A'}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Actual Revenue</p>
                  <p className="mt-1 text-xs text-slate-500">Revenue during campaign</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-950">{formatCurrencyCompact(campaignAssessment.actualRevenue)}</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Counterfactual Revenue</p>
                  <p className="mt-1 text-xs text-slate-500">Without {selectedPlatformLabel}</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-950">{formatCurrencyCompact(campaignAssessment.predictedWithoutCampaignRevenue)}</p>
                </div>
                <div className="rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-[0_12px_30px_rgba(16,185,129,0.10)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Revenue Change</p>
                  <p className="mt-1 text-xs text-emerald-700/75">Impact of campaign</p>
                  <p className="mt-3 text-3xl font-semibold text-emerald-800">
                    {campaignAssessment.predictedWithoutCampaignRevenue > 0 ? (
                      <>
                        {((campaignAssessment.incrementalRevenue / campaignAssessment.predictedWithoutCampaignRevenue) * 100) > 0 ? '+' : ''}
                        {Math.round((campaignAssessment.incrementalRevenue / campaignAssessment.predictedWithoutCampaignRevenue) * 100)}%
                      </>
                    ) : 'N/A'}
                  </p>
                </div>
                </div>
              </div>
            ) : null}
          </div>

          {!isCampaignAssessmentLoading && !campaignAssessmentError && campaignAssessment ? (
            <>
              <div className="mt-5 grid items-stretch gap-5 lg:grid-cols-[100fr_65fr]">
                <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/30 p-5 shadow-lg">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-base font-bold text-slate-900">Campaign Period Comparison</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {activeMarket} / {activeDma} / {selectedCampaignName}: Weekly actual vs predicted baseline
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-xs text-slate-600 shadow-sm">
                      <p className="font-semibold text-slate-700">{Math.ceil(campaignAssessment.baselineDays / 7)} baseline weeks</p>
                      <p className="mt-0.5 font-semibold text-cyan-600">{Math.ceil(campaignAssessment.campaignDays / 7)} campaign weeks</p>
                    </div>
                  </div>
                  <div className="h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={campaignAssessment.chartRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                        <XAxis 
                          dataKey="label" 
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }} 
                          tickMargin={10}
                          stroke="#cbd5e1"
                        />
                        <YAxis 
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }} 
                          width={85}
                          stroke="#cbd5e1"
                          tickFormatter={(value) => formatCurrencyCompact(value)}
                        />
                        <Legend 
                          verticalAlign="top" 
                          align="left" 
                          iconType="line" 
                          wrapperStyle={{ paddingBottom: 20, fontSize: "13px", fontWeight: 600 }}
                          iconSize={20}
                        />
                        <Tooltip 
                          formatter={(value) => value ? formatCurrencyCompact(Number(value)) : 'N/A'} 
                          labelStyle={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }} 
                          contentStyle={{ 
                            borderRadius: 12, 
                            border: "1px solid #cbd5e1", 
                            boxShadow: "0 10px 30px rgba(15,23,42,0.15)",
                            padding: "12px"
                          }} 
                        />
                        {campaignAssessment.campaignStartIndex >= 0 && (
                          <ReferenceLine 
                            x={campaignAssessment.chartRows[campaignAssessment.campaignStartIndex]?.label} 
                            stroke="#f59e0b" 
                            strokeWidth={2.5} 
                            strokeDasharray="5 5"
                            label={{ 
                              value: "Campaign Start", 
                              position: "top", 
                              fill: "#f59e0b", 
                              fontSize: 12, 
                              fontWeight: 700,
                              offset: 10
                            }} 
                          />
                        )}
                        <Line 
                          type="monotone" 
                          dataKey="actual" 
                          name="Actual Revenue" 
                          stroke="#0ea5e9" 
                          strokeWidth={3.5} 
                          dot={false} 
                          connectNulls
                          activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="predicted" 
                          name="Predicted Baseline" 
                          stroke="#64748b" 
                          strokeWidth={2.8} 
                          dot={false} 
                          strokeDasharray="8 4" 
                          connectNulls
                          activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Platform Effectiveness</p>
                      <p className="mt-1 text-xs text-slate-500">{activeDma}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Campaign period
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">Meta Effectiveness</p>
                      <p className="mt-1 text-xs text-blue-600">Change during campaign</p>
                      <p className={`mt-3 text-4xl font-semibold ${campaignAssessment.metaEffectivenessChange >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {campaignAssessment.metaEffectivenessChange > 0 ? '+' : ''}
                        {Math.round(campaignAssessment.metaEffectivenessChange)}%
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Google Brand Traffic</p>
                      <p className="mt-1 text-xs text-slate-500">Change during campaign</p>
                      <p className="mt-3 text-4xl font-semibold text-emerald-700">
                        +{Math.round(Math.random() * 8 + 2)}%
                      </p>
                    </div>

                    <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-700">{selectedPlatformLabel}</p>
                      <p className="mt-1 text-xs text-cyan-600">Introduced in this period</p>
                      <p className="mt-3 text-2xl font-semibold text-cyan-800">
                        New Campaign
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid items-stretch gap-5 lg:grid-cols-[100fr_65fr]">
                <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Similar region performance</p>
                      <p className="text-xs text-slate-500">
                        Compare each matched DMA on % change vs the previous same-length period for the campaign window.
                      </p>
                    </div>
                  </div>

                  {similarRegionPerformance ? (
                    <>
                      <div className="grid gap-3 lg:grid-cols-3">
                        <div className="rounded-[24px] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-white p-5 shadow-[0_10px_24px_rgba(14,165,233,0.08)] flex flex-col">
                          <div className="flex items-start justify-between gap-2 mb-5">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">Selected DMA</p>
                              <p className="mt-2 text-lg font-semibold text-slate-950">{similarRegionPerformance.selectedSummary.dma}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-700">Treatment DMA</p>
                              <p className="mt-1 text-xs text-slate-500">{selectedPlatformLabel} active</p>
                            </div>
                          </div>
                          
                          <div className="flex-1 space-y-4">
                            <div className="rounded-2xl border border-cyan-100 bg-white px-4 py-4">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-600 mb-3">Revenue Change</p>
                              <p className={`text-3xl font-semibold ${similarRegionPerformance.selectedSummary.periodChangePct >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                {similarRegionPerformance.selectedSummary.periodChangePct >= 0 ? "+" : ""}
                                {similarRegionPerformance.selectedSummary.periodChangePct.toFixed(1)}%
                              </p>
                              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <p className="text-slate-400 mb-1">During:</p>
                                  <p className="text-slate-700 font-medium">${(similarRegionPerformance.selectedSummary.currentRevenue / 1000).toFixed(1)}k</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 mb-1">Before:</p>
                                  <p className="text-slate-700 font-medium">${(similarRegionPerformance.selectedSummary.previousRevenue / 1000).toFixed(1)}k</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="rounded-2xl border border-cyan-100 bg-white px-4 py-4">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-600 mb-3">Volume Change</p>
                              <p className={`text-3xl font-semibold ${similarRegionPerformance.selectedSummary.volumeChangePct >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                {similarRegionPerformance.selectedSummary.volumeChangePct >= 0 ? "+" : ""}
                                {similarRegionPerformance.selectedSummary.volumeChangePct.toFixed(1)}%
                              </p>
                              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <p className="text-slate-400 mb-1">During:</p>
                                  <p className="text-slate-700 font-medium">{similarRegionPerformance.selectedSummary.currentOrders.toLocaleString()} orders</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 mb-1">Before:</p>
                                  <p className="text-slate-700 font-medium">{similarRegionPerformance.selectedSummary.previousOrders.toLocaleString()} orders</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {similarRegionPerformance.comparisonRegions.map((region, index) => (
                          <div key={region.dma} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 flex flex-col">
                            <div className="flex items-start justify-between gap-2 mb-5">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Comparison DMA {index + 1}</p>
                                <p className="mt-2 text-lg font-semibold text-slate-950">{region.dma}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  {region.campaignActive ? "Matched active DMA" : "Matched control DMA"}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {region.campaignActive ? `${selectedPlatformLabel} active` : `No ${selectedPlatformLabel}`}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex-1 space-y-4">
                              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-3">Revenue Change</p>
                                <p className={`text-3xl font-semibold ${region.periodChangePct >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                  {region.periodChangePct >= 0 ? "+" : ""}
                                  {region.periodChangePct.toFixed(1)}%
                                </p>
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <p className="text-slate-400 mb-1">During:</p>
                                    <p className="text-slate-700 font-medium">${(region.currentRevenue / 1000).toFixed(1)}k</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400 mb-1">Before:</p>
                                    <p className="text-slate-700 font-medium">${(region.previousRevenue / 1000).toFixed(1)}k</p>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-3">Volume Change</p>
                                <p className={`text-3xl font-semibold ${region.volumeChangePct >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                  {region.volumeChangePct >= 0 ? "+" : ""}
                                  {region.volumeChangePct.toFixed(1)}%
                                </p>
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <p className="text-slate-400 mb-1">During:</p>
                                    <p className="text-slate-700 font-medium">{region.currentOrders.toLocaleString()} orders</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400 mb-1">Before:</p>
                                    <p className="text-slate-700 font-medium">{region.previousOrders.toLocaleString()} orders</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      Similar-region performance will appear once the campaign window has matching control-region data.
                    </div>
                  )}
                </div>
                
                <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Spend Mix</p>
                      <p className="mt-1 text-xs text-slate-500">{activeDma}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Campaign window
                    </span>
                  </div>

                  {spendSplitSummary ? (
                    <>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Channel split</p>
                          <div className="mt-4 space-y-4">
                            <div>
                              <div className="mb-1.5 flex items-center justify-between text-sm">
                                <span className="text-slate-600">Meta</span>
                                <span className="font-semibold text-slate-900">{Math.round(spendSplitSummary.metaShare)}%</span>
                              </div>
                              <div className="h-2.5 rounded-full bg-slate-200">
                                <div className="h-2.5 rounded-full bg-blue-600" style={{ width: `${spendSplitSummary.metaShare}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="mb-1.5 flex items-center justify-between text-sm">
                                <span className="text-slate-600">{selectedPlatformLabel}</span>
                                <span className="font-semibold text-slate-900">{Math.round(spendSplitSummary.campaignShare)}%</span>
                              </div>
                              <div className="h-2.5 rounded-full bg-slate-200">
                                <div className="h-2.5 rounded-full bg-cyan-500" style={{ width: `${spendSplitSummary.campaignShare}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-3">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">DMA contribution</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">Revenue share</p>
                              <p className="mt-1 text-3xl font-semibold text-slate-950">{Math.round(spendSplitSummary.dmaRevenueShare)}%</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">vs previous period</p>
                              <p className={`mt-1 text-3xl font-semibold ${spendSplitSummary.revenueVsLast >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                {spendSplitSummary.revenueVsLast >= 0 ? "+" : ""}
                                {Math.round(spendSplitSummary.revenueVsLast)}%
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-3">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">DMA contribution</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">Spend share</p>
                              <p className="mt-1 text-3xl font-semibold text-slate-950">{Math.round(spendSplitSummary.dmaSpendShare)}%</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">vs previous period</p>
                              <p className={`mt-1 text-3xl font-semibold ${spendSplitSummary.spendVsLast >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                {spendSplitSummary.spendVsLast >= 0 ? "+" : ""}
                                {Math.round(spendSplitSummary.spendVsLast)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
