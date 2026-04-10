import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Calculator,
  Copy,
  DollarSign,
  Megaphone,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from "lucide-react";

type RoasToolId =
  | "break_even"
  | "return_on_ad_spend"
  | "google_ads_roas"
  | "meta_ads_roas"
  | "amazon_roas"
  | "ecommerce_roas"
  | "dropshipping_roas"
  | "acos_to_roas"
  | "roi_to_roas";

interface RoasToolCard {
  id: RoasToolId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  formulas: string[];
  guidance: string[];
}

interface ResultItem {
  label: string;
  value: string;
  hint?: string;
}

type SummaryTone = "good" | "watch" | "critical";

interface ResultSummary {
  title: string;
  badge: string;
  tone: SummaryTone;
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
  message: string;
  copyText: string;
}

const ROAS_TOOL_CARDS: RoasToolCard[] = [
  {
    id: "break_even",
    title: "Break-even ROAS",
    subtitle: "Find your minimum profitable ROAS",
    icon: Scale,
    formulas: ["Break-even ROAS = 1 / Profit Margin"],
    guidance: [
      "Include all costs before margin input.",
      "Treat this as minimum profitable ROAS.",
      "Starting target is often ~20% above break-even.",
      "Difficulty bands: <2 low, 2-4 medium, 4-6 high, >=6 very high.",
    ],
  },
  {
    id: "return_on_ad_spend",
    title: "Return on Ad Spend",
    subtitle: "General-purpose ROAS check",
    icon: DollarSign,
    formulas: ["ROAS = Revenue from Ads / Ad Spend"],
    guidance: [
      "Use for quick campaign checks and scale decisions.",
      "ROAS is revenue efficiency, not profit.",
      "Subtract costs and compare against break-even before judging performance.",
    ],
  },
  {
    id: "google_ads_roas",
    title: "Google Ads ROAS",
    subtitle: "Search, Shopping, Display, YouTube, PMax",
    icon: Search,
    formulas: ["ROAS = Conversion Value / Ad Spend", "ROAS % = (Conversion Value / Ad Spend) x 100", "Target ROAS ~= Current ROAS x 0.9"],
    guidance: [
      "Calculate current ROAS first.",
      "Set target slightly below current ROAS for conservative rollout.",
      "In Google Ads: Campaign Settings -> Bidding -> Target ROAS.",
    ],
  },
  {
    id: "meta_ads_roas",
    title: "Meta Ads ROAS",
    subtitle: "Facebook + Instagram + Messenger + Audience Network",
    icon: Megaphone,
    formulas: ["ROAS = Revenue / Ad Spend", "ROAS % = (Revenue / Ad Spend) x 100"],
    guidance: [
      "3x is often healthy for many e-commerce setups.",
      "Post-iOS14 data can understate conversions.",
      "Validate with Events Manager and backend sales before budget cuts.",
    ],
  },
  {
    id: "amazon_roas",
    title: "Amazon ROAS",
    subtitle: "Sponsored Products, Brands, and Display",
    icon: ShoppingCart,
    formulas: ["ROAS = Ad Sales / Ad Spend", "ACOS = (Ad Spend / Ad Sales) x 100", "ACOS x ROAS = 100"],
    guidance: [
      "Evaluate at ASIN level where possible.",
      "Account-level aggregates can hide weak products.",
      "Compare against landed cost and FBA economics, not only attributed sales.",
    ],
  },
  {
    id: "ecommerce_roas",
    title: "E-commerce ROAS",
    subtitle: "Blended, platform-agnostic view",
    icon: Calculator,
    formulas: [
      "Standard ROAS = Revenue / Ad Spend",
      "True ROAS = Gross Profit / Ad Spend",
      "Net Profit = Revenue - COGS - Other Costs - Ad Spend",
      "Break-even ROAS = 1 / Gross Margin",
    ],
    guidance: [
      "Judge ROAS against gross margin, not revenue alone.",
      "Hidden costs can make high revenue ROAS unprofitable.",
      "Use for Shopify, WooCommerce, and multichannel rollups.",
    ],
  },
  {
    id: "dropshipping_roas",
    title: "Dropshipping ROAS",
    subtitle: "Thin-margin model with extra checks",
    icon: Truck,
    formulas: [
      "Revenue = Selling Price x Units Sold",
      "Total Cost = (Product Cost + Shipping) x Units",
      "Gross Profit = Revenue - Total Cost",
      "Gross Margin = Gross Profit / Revenue",
      "Net Profit = Gross Profit - Ad Spend",
      "ROAS = Revenue / Ad Spend",
      "Break-even ROAS = 1 / Gross Margin",
    ],
    guidance: [
      "Thin margins usually require higher ROAS than standard e-commerce.",
      "Common break-even ranges can land around 3x to 7x depending on margin.",
      "Even 3x can still lose money at very low margin.",
    ],
  },
  {
    id: "acos_to_roas",
    title: "ACOS to ROAS",
    subtitle: "Translate Amazon ACOS language into ROAS",
    icon: RefreshCw,
    formulas: ["ROAS = 100 / ACOS%", "ACOS% = 100 / ROAS"],
    guidance: [
      "Use when Amazon and finance teams use different KPI language.",
      "Efficient zone: ROAS >= ~5% above target.",
      "Monitor zone: near target.",
      "Critical zone: materially below target.",
    ],
  },
  {
    id: "roi_to_roas",
    title: "ROI to ROAS",
    subtitle: "Translate finance ROI and marketing ROAS",
    icon: ArrowRightLeft,
    formulas: ["ROAS = (ROI / 100) + 1", "ROI% = (ROAS - 1) x 100"],
    guidance: [
      "ROAS 1x equals ROI 0% and break-even.",
      "Use when teams report ROI but media team optimizes by ROAS.",
    ],
  },
];

const safeDivide = (numerator: number, denominator: number) => (denominator === 0 ? 0 : numerator / denominator);
const parseNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const clampMin = (value: number, min = 0) => (Number.isFinite(value) ? Math.max(min, value) : min);

const formatCurrency = (value: number) =>
  `$${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: value % 1 === 0 ? 0 : 2 })}`;
const formatRatio = (value: number) => `${value.toFixed(2)}x`;
const formatPercent = (value: number) => `${value.toFixed(2)}%`;
const formatNumber = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });

const difficultyFromBreakEven = (breakEvenRoas: number) => {
  if (breakEvenRoas < 2) return "Low";
  if (breakEvenRoas < 4) return "Medium";
  if (breakEvenRoas < 6) return "High";
  return "Very High";
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getDifficultyMeta = (difficulty: string) => {
  if (difficulty === "Low") {
    return {
      pill: "bg-emerald-100 text-emerald-700 border-emerald-200",
      note: "Low threshold. Higher margin gives more room for advertising.",
    };
  }
  if (difficulty === "Medium") {
    return {
      pill: "bg-amber-100 text-amber-700 border-amber-200",
      note: "Medium threshold. Keep creative and CPA efficiency tight.",
    };
  }
  if (difficulty === "High") {
    return {
      pill: "bg-orange-100 text-orange-700 border-orange-200",
      note: "High threshold. You need stronger conversion and margin control.",
    };
  }
  return {
    pill: "bg-rose-100 text-rose-700 border-rose-200",
    note: "Very high threshold. This setup is difficult to scale profitably.",
  };
};

const getTonePillClass = (tone: SummaryTone) => {
  if (tone === "good") return "border-emerald-200 bg-emerald-100 text-emerald-700";
  if (tone === "watch") return "border-amber-200 bg-amber-100 text-amber-700";
  return "border-rose-200 bg-rose-100 text-rose-700";
};

function NumberField({
  label,
  value,
  onChange,
  step = "0.01",
  min = 0,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
  min?: number;
}) {
  return (
    <label className="block">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
      />
    </label>
  );
}

export function RoasPlaygroundPage() {
  const [openToolId, setOpenToolId] = useState<RoasToolId | null>(null);
  const [breakEvenMode, setBreakEvenMode] = useState<"margin" | "cost_price">("margin");
  const [copiedBreakEven, setCopiedBreakEven] = useState(false);
  const [copiedToolResult, setCopiedToolResult] = useState(false);

  const [adSpend, setAdSpend] = useState("10000");
  const [revenue, setRevenue] = useState("25000");
  const [profitMargin, setProfitMargin] = useState("35");
  const [cost, setCost] = useState("60");
  const [sellingPrice, setSellingPrice] = useState("100");
  const [targetRoas, setTargetRoas] = useState("3.5");
  const [conversionValue, setConversionValue] = useState("26000");
  const [adSales, setAdSales] = useState("18000");
  const [acosPercent, setAcosPercent] = useState("22");
  const [roasForAcos, setRoasForAcos] = useState("4.5");
  const [roiPercent, setRoiPercent] = useState("180");
  const [roasForRoi, setRoasForRoi] = useState("2.8");
  const [cogs, setCogs] = useState("12000");
  const [otherCosts, setOtherCosts] = useState("3500");
  const [fulfillmentCosts, setFulfillmentCosts] = useState("1800");
  const [overheadCosts, setOverheadCosts] = useState("1400");
  const [unitsSold, setUnitsSold] = useState("220");
  const [productCost, setProductCost] = useState("24");
  const [shippingCost, setShippingCost] = useState("8");

  const selectedTool = useMemo(() => {
    if (!openToolId) return null;
    return ROAS_TOOL_CARDS.find((tool) => tool.id === openToolId) ?? null;
  }, [openToolId]);

  const breakEvenVisualData = useMemo(() => {
    const marginPct = clampMin(parseNumber(profitMargin));
    const costValue = clampMin(parseNumber(cost));
    const sellingPriceValue = clampMin(parseNumber(sellingPrice));
    const marginFromCostPrice = sellingPriceValue <= 0 ? 0 : safeDivide(sellingPriceValue - costValue, sellingPriceValue) * 100;
    const effectiveMarginPct = breakEvenMode === "margin" ? marginPct : marginFromCostPrice;
    const breakEvenRoas = effectiveMarginPct <= 0 ? 0 : 1 / (effectiveMarginPct / 100);
    const suggestedTarget = breakEvenRoas * 1.2;
    const difficulty = difficultyFromBreakEven(breakEvenRoas);
    const markerPercent = clamp((breakEvenRoas / 10) * 100, 0, 100);
    const difficultyMeta = getDifficultyMeta(difficulty);

    return {
      effectiveMarginPct,
      breakEvenRoas,
      suggestedTarget,
      difficulty,
      markerPercent,
      difficultyMeta,
    };
  }, [breakEvenMode, cost, profitMargin, sellingPrice]);

  const resultItems = useMemo((): ResultItem[] => {
    if (!selectedTool) return [];

    const spendValue = clampMin(parseNumber(adSpend));
    const revenueValue = clampMin(parseNumber(revenue));
    const sellingPriceValue = clampMin(parseNumber(sellingPrice));
    const targetRoasValue = clampMin(parseNumber(targetRoas));
    const conversionValueNum = clampMin(parseNumber(conversionValue));
    const adSalesValue = clampMin(parseNumber(adSales));
    const acosPct = clampMin(parseNumber(acosPercent));
    const roasValueForAcos = clampMin(parseNumber(roasForAcos), 0.01);
    const roiPct = parseNumber(roiPercent);
    const roasValueForRoi = clampMin(parseNumber(roasForRoi), 0.01);
    const cogsValue = clampMin(parseNumber(cogs));
    const otherCostsValue = clampMin(parseNumber(otherCosts));
    const fulfillmentValue = clampMin(parseNumber(fulfillmentCosts));
    const overheadValue = clampMin(parseNumber(overheadCosts));
    const units = clampMin(parseNumber(unitsSold));
    const productCostValue = clampMin(parseNumber(productCost));
    const shippingCostValue = clampMin(parseNumber(shippingCost));

    if (selectedTool.id === "break_even") {
      return [
        { label: "Profit Margin", value: formatPercent(breakEvenVisualData.effectiveMarginPct) },
        { label: "Break-even ROAS", value: formatRatio(breakEvenVisualData.breakEvenRoas) },
        { label: "Suggested Starting Target", value: formatRatio(breakEvenVisualData.suggestedTarget), hint: "~20% above break-even" },
        { label: "Difficulty", value: breakEvenVisualData.difficulty },
      ];
    }

    if (selectedTool.id === "return_on_ad_spend") {
      const roas = safeDivide(revenueValue, spendValue);
      const costBase = cogsValue + fulfillmentValue + overheadValue;
      const contributionBeforeAds = revenueValue - costBase;
      const netAfterAds = contributionBeforeAds - spendValue;
      const margin = safeDivide(contributionBeforeAds, revenueValue);
      const breakEvenRoas = margin <= 0 ? 0 : 1 / margin;
      return [
        { label: "ROAS", value: formatRatio(roas) },
        { label: "Contribution Before Ads", value: formatCurrency(contributionBeforeAds) },
        { label: "Net Profit After Ads", value: formatCurrency(netAfterAds) },
        { label: "Break-even ROAS Check", value: formatRatio(breakEvenRoas) },
      ];
    }

    if (selectedTool.id === "google_ads_roas") {
      const roas = safeDivide(conversionValueNum, spendValue);
      const roasPct = roas * 100;
      const conservativeTarget = roas * 0.9;
      return [
        { label: "Current Google ROAS", value: formatRatio(roas) },
        { label: "ROAS %", value: formatPercent(roasPct) },
        { label: "Conservative Target ROAS", value: formatRatio(conservativeTarget) },
      ];
    }

    if (selectedTool.id === "meta_ads_roas") {
      const roas = safeDivide(revenueValue, spendValue);
      return [
        { label: "Meta ROAS", value: formatRatio(roas) },
        { label: "ROAS %", value: formatPercent(roas * 100) },
        { label: "Health Check", value: roas >= 3 ? "Healthy band" : "Needs validation", hint: "Cross-check attribution and event quality" },
      ];
    }

    if (selectedTool.id === "amazon_roas") {
      const roas = safeDivide(adSalesValue, spendValue);
      const acos = safeDivide(spendValue, adSalesValue) * 100;
      return [
        { label: "Amazon ROAS", value: formatRatio(roas) },
        { label: "ACOS", value: formatPercent(acos) },
        { label: "Inverse Check", value: formatNumber(roas * acos), hint: "ROAS x ACOS% should be close to 100" },
      ];
    }

    if (selectedTool.id === "ecommerce_roas") {
      const standardRoas = safeDivide(revenueValue, spendValue);
      const grossProfit = revenueValue - cogsValue - otherCostsValue;
      const trueRoas = safeDivide(grossProfit, spendValue);
      const netProfit = revenueValue - cogsValue - otherCostsValue - spendValue;
      const grossMargin = safeDivide(grossProfit, revenueValue);
      const breakEvenRoas = grossMargin <= 0 ? 0 : 1 / grossMargin;
      return [
        { label: "Standard ROAS", value: formatRatio(standardRoas) },
        { label: "True ROAS", value: formatRatio(trueRoas) },
        { label: "Net Profit", value: formatCurrency(netProfit) },
        { label: "Break-even ROAS", value: formatRatio(breakEvenRoas) },
      ];
    }

    if (selectedTool.id === "dropshipping_roas") {
      const revenueCalc = sellingPriceValue * units;
      const totalCost = (productCostValue + shippingCostValue) * units;
      const grossProfit = revenueCalc - totalCost;
      const grossMargin = safeDivide(grossProfit, revenueCalc);
      const netProfit = grossProfit - spendValue;
      const roas = safeDivide(revenueCalc, spendValue);
      const breakEvenRoas = grossMargin <= 0 ? 0 : 1 / grossMargin;
      return [
        { label: "Revenue", value: formatCurrency(revenueCalc) },
        { label: "ROAS", value: formatRatio(roas) },
        { label: "Net Profit", value: formatCurrency(netProfit) },
        { label: "Break-even ROAS", value: formatRatio(breakEvenRoas) },
      ];
    }

    if (selectedTool.id === "acos_to_roas") {
      const roasFromAcosCalc = safeDivide(100, acosPct);
      const acosFromRoasCalc = safeDivide(100, roasValueForAcos);
      const target = targetRoasValue;
      const efficientThreshold = target * 1.05;
      const zone = roasFromAcosCalc >= efficientThreshold ? "Efficient" : roasFromAcosCalc >= target ? "Monitor" : "Critical";
      return [
        { label: "ROAS from ACOS", value: formatRatio(roasFromAcosCalc) },
        { label: "ACOS from ROAS", value: formatPercent(acosFromRoasCalc) },
        { label: "Zone vs Target", value: zone, hint: `Target ${formatRatio(target)}` },
      ];
    }

    const roasFromRoiCalc = roiPct / 100 + 1;
    const roiFromRoasCalc = (roasValueForRoi - 1) * 100;
    return [
      { label: "ROAS from ROI", value: formatRatio(roasFromRoiCalc) },
      { label: "ROI from ROAS", value: formatPercent(roiFromRoasCalc) },
      { label: "Anchor", value: "ROAS 1x = ROI 0% = Break-even" },
    ];
  }, [
    selectedTool,
    adSpend,
    revenue,
    profitMargin,
    cost,
    sellingPrice,
    targetRoas,
    conversionValue,
    adSales,
    acosPercent,
    roasForAcos,
    roiPercent,
    roasForRoi,
    cogs,
    otherCosts,
    fulfillmentCosts,
    overheadCosts,
    unitsSold,
    productCost,
    shippingCost,
    breakEvenMode,
    breakEvenVisualData,
  ]);

  const resultSummary = useMemo<ResultSummary | null>(() => {
    if (!selectedTool || selectedTool.id === "break_even") return null;

    const spendValue = clampMin(parseNumber(adSpend));
    const revenueValue = clampMin(parseNumber(revenue));
    const sellingPriceValue = clampMin(parseNumber(sellingPrice));
    const targetRoasValue = clampMin(parseNumber(targetRoas));
    const conversionValueNum = clampMin(parseNumber(conversionValue));
    const adSalesValue = clampMin(parseNumber(adSales));
    const acosPct = clampMin(parseNumber(acosPercent));
    const roiPct = parseNumber(roiPercent);
    const cogsValue = clampMin(parseNumber(cogs));
    const otherCostsValue = clampMin(parseNumber(otherCosts));
    const units = clampMin(parseNumber(unitsSold));
    const productCostValue = clampMin(parseNumber(productCost));
    const shippingCostValue = clampMin(parseNumber(shippingCost));

    if (selectedTool.id === "return_on_ad_spend") {
      const roas = safeDivide(revenueValue, spendValue);
      const costBase = cogsValue + clampMin(parseNumber(fulfillmentCosts)) + clampMin(parseNumber(overheadCosts));
      const netAfterAds = revenueValue - costBase - spendValue;
      const tone: SummaryTone = roas >= 3 && netAfterAds >= 0 ? "good" : roas >= 2 ? "watch" : "critical";
      const badge = tone === "good" ? "Good" : tone === "watch" ? "Watch" : "Critical";
      return {
        title: "Performance Result",
        badge,
        tone,
        leftLabel: "ROAS",
        leftValue: formatRatio(roas),
        rightLabel: "Net Profit After Ads",
        rightValue: formatCurrency(netAfterAds),
        message:
          tone === "good"
            ? "Revenue efficiency is healthy and currently supports profitable scaling."
            : tone === "watch"
              ? "Result is workable, but margin control and CPA optimization are required before scaling."
              : "Efficiency is below safe zone. Review costs and targeting before increasing spend.",
        copyText: `ROAS: ${formatRatio(roas)}\nNet Profit After Ads: ${formatCurrency(netAfterAds)}`,
      };
    }

    if (selectedTool.id === "google_ads_roas") {
      const roas = safeDivide(conversionValueNum, spendValue);
      const target = roas * 0.9;
      const tone: SummaryTone = roas >= 3 ? "good" : roas >= 2 ? "watch" : "critical";
      const badge = tone === "good" ? "Good" : tone === "watch" ? "Watch" : "Critical";
      return {
        title: "Google Result",
        badge,
        tone,
        leftLabel: "Current ROAS",
        leftValue: formatRatio(roas),
        rightLabel: "Suggested Target",
        rightValue: formatRatio(target),
        message: "Set the bidding target slightly below current ROAS to keep learning headroom.",
        copyText: `Current Google ROAS: ${formatRatio(roas)}\nSuggested Target: ${formatRatio(target)}`,
      };
    }

    if (selectedTool.id === "meta_ads_roas") {
      const roas = safeDivide(revenueValue, spendValue);
      const tone: SummaryTone = roas >= 3 ? "good" : roas >= 2 ? "watch" : "critical";
      const badge = tone === "good" ? "Good" : tone === "watch" ? "Watch" : "Critical";
      return {
        title: "Meta Result",
        badge,
        tone,
        leftLabel: "Meta ROAS",
        leftValue: formatRatio(roas),
        rightLabel: "Benchmark",
        rightValue: "3.00x",
        message:
          tone === "good"
            ? "Meta ROAS is in a strong band for many e-commerce setups."
            : "Validate attribution quality before changing budgets aggressively.",
        copyText: `Meta ROAS: ${formatRatio(roas)}\nBenchmark: 3.00x`,
      };
    }

    if (selectedTool.id === "amazon_roas") {
      const roas = safeDivide(adSalesValue, spendValue);
      const acos = safeDivide(spendValue, adSalesValue) * 100;
      const tone: SummaryTone = roas >= 4 ? "good" : roas >= 2.5 ? "watch" : "critical";
      const badge = tone === "good" ? "Good" : tone === "watch" ? "Watch" : "Critical";
      return {
        title: "Amazon Result",
        badge,
        tone,
        leftLabel: "ROAS",
        leftValue: formatRatio(roas),
        rightLabel: "ACOS",
        rightValue: formatPercent(acos),
        message: "Review this at ASIN level to avoid top performers masking weak products.",
        copyText: `Amazon ROAS: ${formatRatio(roas)}\nACOS: ${formatPercent(acos)}`,
      };
    }

    if (selectedTool.id === "ecommerce_roas") {
      const grossProfit = revenueValue - cogsValue - otherCostsValue;
      const trueRoas = safeDivide(grossProfit, spendValue);
      const netProfit = revenueValue - cogsValue - otherCostsValue - spendValue;
      const tone: SummaryTone = netProfit >= 0 && trueRoas >= 2 ? "good" : netProfit >= 0 ? "watch" : "critical";
      const badge = tone === "good" ? "Good" : tone === "watch" ? "Watch" : "Critical";
      return {
        title: "E-commerce Result",
        badge,
        tone,
        leftLabel: "True ROAS",
        leftValue: formatRatio(trueRoas),
        rightLabel: "Net Profit",
        rightValue: formatCurrency(netProfit),
        message: "Use true ROAS and net profit to avoid overvaluing revenue-only performance.",
        copyText: `True ROAS: ${formatRatio(trueRoas)}\nNet Profit: ${formatCurrency(netProfit)}`,
      };
    }

    if (selectedTool.id === "dropshipping_roas") {
      const revenueCalc = sellingPriceValue * units;
      const totalCost = (productCostValue + shippingCostValue) * units;
      const grossProfit = revenueCalc - totalCost;
      const netProfit = grossProfit - spendValue;
      const roas = safeDivide(revenueCalc, spendValue);
      const tone: SummaryTone = roas >= 4 && netProfit >= 0 ? "good" : roas >= 3 ? "watch" : "critical";
      const badge = tone === "good" ? "Good" : tone === "watch" ? "Watch" : "Critical";
      return {
        title: "Dropshipping Result",
        badge,
        tone,
        leftLabel: "ROAS",
        leftValue: formatRatio(roas),
        rightLabel: "Net Profit",
        rightValue: formatCurrency(netProfit),
        message: "Thin margins usually require higher ROAS to stay profitable.",
        copyText: `Dropshipping ROAS: ${formatRatio(roas)}\nNet Profit: ${formatCurrency(netProfit)}`,
      };
    }

    if (selectedTool.id === "acos_to_roas") {
      const roasFromAcosCalc = safeDivide(100, acosPct);
      const efficientThreshold = targetRoasValue * 1.05;
      const tone: SummaryTone = roasFromAcosCalc >= efficientThreshold ? "good" : roasFromAcosCalc >= targetRoasValue ? "watch" : "critical";
      const badge = tone === "good" ? "Efficient" : tone === "watch" ? "Monitor" : "Critical";
      return {
        title: "Conversion Result",
        badge,
        tone,
        leftLabel: "ROAS from ACOS",
        leftValue: formatRatio(roasFromAcosCalc),
        rightLabel: "Target ROAS",
        rightValue: formatRatio(targetRoasValue),
        message: "Use this translation to keep Amazon and finance conversations aligned.",
        copyText: `ROAS from ACOS: ${formatRatio(roasFromAcosCalc)}\nTarget ROAS: ${formatRatio(targetRoasValue)}`,
      };
    }

    const roasFromRoiCalc = roiPct / 100 + 1;
    const tone: SummaryTone = roasFromRoiCalc >= 3 ? "good" : roasFromRoiCalc >= 2 ? "watch" : "critical";
    const badge = tone === "good" ? "Good" : tone === "watch" ? "Watch" : "Critical";
    return {
      title: "Conversion Result",
      badge,
      tone,
      leftLabel: "ROI",
      leftValue: formatPercent(roiPct),
      rightLabel: "ROAS Equivalent",
      rightValue: formatRatio(roasFromRoiCalc),
      message: "ROAS 1x equals ROI 0%, which is the break-even anchor for both teams.",
      copyText: `ROI: ${formatPercent(roiPct)}\nROAS Equivalent: ${formatRatio(roasFromRoiCalc)}`,
    };
  }, [
    selectedTool,
    adSpend,
    revenue,
    sellingPrice,
    targetRoas,
    conversionValue,
    adSales,
    acosPercent,
    roiPercent,
    cogs,
    otherCosts,
    fulfillmentCosts,
    overheadCosts,
    unitsSold,
    productCost,
    shippingCost,
  ]);

  const handleCopyBreakEven = async () => {
    const payload = [
      `Break-even ROAS: ${formatRatio(breakEvenVisualData.breakEvenRoas)}`,
      `Profit Margin: ${formatPercent(breakEvenVisualData.effectiveMarginPct)}`,
      `Suggested Target ROAS: ${formatRatio(breakEvenVisualData.suggestedTarget)}`,
      `Difficulty: ${breakEvenVisualData.difficulty}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(payload);
      setCopiedBreakEven(true);
      setTimeout(() => setCopiedBreakEven(false), 1400);
    } catch {
      setCopiedBreakEven(false);
    }
  };

  const handleCopyToolResult = async () => {
    if (!resultSummary) return;
    try {
      await navigator.clipboard.writeText(resultSummary.copyText);
      setCopiedToolResult(true);
      setTimeout(() => setCopiedToolResult(false), 1400);
    } catch {
      setCopiedToolResult(false);
    }
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_16%_0%,rgba(16,185,129,0.13),transparent_34%),radial-gradient(circle_at_84%_10%,rgba(14,165,233,0.12),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#ffffff_58%,#ecfeff_100%)] px-6 py-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        {selectedTool === null ? (
          <section className="rounded-3xl border border-white/70 bg-white/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)] lg:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">ROAS Playground</h2>
                <p className="text-sm text-slate-500">Choose one solution path. This workspace keeps channel metrics and finance metrics aligned in one place.</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Cross-Team Performance Terms</p>
              <p className="mt-1.5 text-lg font-semibold leading-tight text-slate-900">
                Standardize ROAS, ACOS, ROI, margin, and profit into one consistent performance language.
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {ROAS_TOOL_CARDS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => {
                      setOpenToolId(tool.id);
                      setCopiedToolResult(false);
                    }}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40"
                  >
                    <div className="flex items-start gap-3">
                      <span className="rounded-xl bg-emerald-100 p-3 text-emerald-600">
                        <Icon size={20} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-lg font-semibold leading-6 text-slate-900">{tool.title}</p>
                        <p className="mt-1.5 text-sm text-slate-500">{tool.subtitle}</p>
                        <div className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600">
                          <span>Open tool</span>
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.1)] lg:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-600">
                    <selectedTool.icon size={20} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">ROAS Playground</p>
                    <h3 className="text-2xl font-semibold text-slate-900">{selectedTool.title}</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenToolId(null);
                    setCopiedToolResult(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <ArrowLeft size={14} />
                  Back to tools
                </button>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-white p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Inputs</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {selectedTool.id === "break_even" ? (
                      <>
                        <div className="md:col-span-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Input Mode</p>
                          <div className="mt-1.5 inline-flex rounded-xl border border-slate-300 bg-slate-100 p-1">
                            <button
                              type="button"
                              onClick={() => setBreakEvenMode("margin")}
                              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${breakEvenMode === "margin" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
                            >
                              Profit Margin
                            </button>
                            <button
                              type="button"
                              onClick={() => setBreakEvenMode("cost_price")}
                              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${breakEvenMode === "cost_price" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
                            >
                              Cost + Selling Price
                            </button>
                          </div>
                        </div>
                        {breakEvenMode === "margin" ? (
                          <NumberField label="Profit Margin %" value={profitMargin} onChange={setProfitMargin} />
                        ) : (
                          <>
                            <NumberField label="Total Cost per Unit" value={cost} onChange={setCost} />
                            <NumberField label="Selling Price per Unit" value={sellingPrice} onChange={setSellingPrice} />
                          </>
                        )}
                      </>
                    ) : null}

                    {selectedTool.id === "return_on_ad_spend" ? (
                      <>
                        <NumberField label="Revenue from Ads" value={revenue} onChange={setRevenue} />
                        <NumberField label="Ad Spend" value={adSpend} onChange={setAdSpend} />
                        <NumberField label="COGS" value={cogs} onChange={setCogs} />
                        <NumberField label="Fulfillment Costs" value={fulfillmentCosts} onChange={setFulfillmentCosts} />
                        <NumberField label="Overhead Costs" value={overheadCosts} onChange={setOverheadCosts} />
                      </>
                    ) : null}

                    {selectedTool.id === "google_ads_roas" ? (
                      <>
                        <NumberField label="Google Ad Spend" value={adSpend} onChange={setAdSpend} />
                        <NumberField label="Google Conversion Value" value={conversionValue} onChange={setConversionValue} />
                      </>
                    ) : null}

                    {selectedTool.id === "meta_ads_roas" ? (
                      <>
                        <NumberField label="Meta Ad Spend" value={adSpend} onChange={setAdSpend} />
                        <NumberField label="Meta Revenue" value={revenue} onChange={setRevenue} />
                      </>
                    ) : null}

                    {selectedTool.id === "amazon_roas" ? (
                      <>
                        <NumberField label="Amazon Ad Spend" value={adSpend} onChange={setAdSpend} />
                        <NumberField label="Amazon Ad Sales" value={adSales} onChange={setAdSales} />
                      </>
                    ) : null}

                    {selectedTool.id === "ecommerce_roas" ? (
                      <>
                        <NumberField label="Revenue" value={revenue} onChange={setRevenue} />
                        <NumberField label="Ad Spend" value={adSpend} onChange={setAdSpend} />
                        <NumberField label="COGS" value={cogs} onChange={setCogs} />
                        <NumberField label="Other Costs" value={otherCosts} onChange={setOtherCosts} />
                      </>
                    ) : null}

                    {selectedTool.id === "dropshipping_roas" ? (
                      <>
                        <NumberField label="Selling Price" value={sellingPrice} onChange={setSellingPrice} />
                        <NumberField label="Units Sold" value={unitsSold} onChange={setUnitsSold} step="1" />
                        <NumberField label="Product Cost per Unit" value={productCost} onChange={setProductCost} />
                        <NumberField label="Shipping Cost per Unit" value={shippingCost} onChange={setShippingCost} />
                        <NumberField label="Ad Spend" value={adSpend} onChange={setAdSpend} />
                      </>
                    ) : null}

                    {selectedTool.id === "acos_to_roas" ? (
                      <>
                        <NumberField label="ACOS %" value={acosPercent} onChange={setAcosPercent} />
                        <NumberField label="ROAS" value={roasForAcos} onChange={setRoasForAcos} />
                        <NumberField label="Target ROAS" value={targetRoas} onChange={setTargetRoas} />
                      </>
                    ) : null}

                    {selectedTool.id === "roi_to_roas" ? (
                      <>
                        <NumberField label="ROI %" value={roiPercent} onChange={setRoiPercent} min={-99999} />
                        <NumberField label="ROAS" value={roasForRoi} onChange={setRoasForRoi} />
                      </>
                    ) : null}
                  </div>
                </section>

                <aside className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Help & Guidance</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                    {selectedTool.guidance.map((note) => (
                      <li key={note} className="list-inside list-disc">
                        {note}
                      </li>
                    ))}
                  </ul>
                  <details className="mt-3 rounded-lg border border-cyan-200 bg-white p-2.5">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">Show formulas</summary>
                    <div className="mt-2 space-y-1.5">
                      {selectedTool.formulas.map((formula) => (
                        <p key={formula} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-700">
                          {formula}
                        </p>
                      ))}
                    </div>
                  </details>
                </aside>
              </div>

              {selectedTool.id === "break_even" ? (
                <section className="mt-4 overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-cyan-50 to-white">
                  <div className="border-b border-emerald-200/60 px-4 py-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">Break-even Visual</p>
                    <p className="mt-0.5 text-sm text-slate-600">Minimum ROAS to cover costs.</p>
                  </div>

                  <div className="px-4 py-4">
                    <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-emerald-200/70 bg-white/80 px-4 py-4 text-center">
                          <p className="text-sm font-semibold text-slate-600">Your Break-even ROAS</p>
                          <p className="mt-1 text-5xl font-semibold tracking-tight text-emerald-700">{formatRatio(breakEvenVisualData.breakEvenRoas)}</p>
                          <p className="mt-1 text-sm text-slate-600">Above this point is profit territory.</p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">ROAS Difficulty Range</p>
                          <div className="relative mt-2 h-4 overflow-hidden rounded-full">
                            <div className="absolute inset-y-0 left-0 w-[20%] bg-emerald-200" />
                            <div className="absolute inset-y-0 left-[20%] w-[20%] bg-amber-200" />
                            <div className="absolute inset-y-0 left-[40%] w-[20%] bg-orange-200" />
                            <div className="absolute inset-y-0 left-[60%] w-[40%] bg-rose-200" />
                            <div className="absolute inset-y-0 left-0 right-0 border border-slate-200/80" />
                            <div className="absolute -top-1" style={{ left: `calc(${breakEvenVisualData.markerPercent}% - 6px)` }}>
                              <span className="block h-6 w-3 rounded-full border border-cyan-700 bg-cyan-500 shadow-md" />
                            </div>
                          </div>
                          <div className="mt-1 flex justify-between text-[11px] font-semibold text-slate-500">
                            <span>0x</span>
                            <span>2x</span>
                            <span>4x</span>
                            <span>6x</span>
                            <span>10x+</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <article className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Profit Margin</p>
                          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatPercent(breakEvenVisualData.effectiveMarginPct)}</p>
                        </article>
                        <article className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Suggested Target</p>
                          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatRatio(breakEvenVisualData.suggestedTarget)}</p>
                        </article>
                        <article className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Difficulty</p>
                          <div className="mt-1.5">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${breakEvenVisualData.difficultyMeta.pill}`}>
                              {breakEvenVisualData.difficulty} threshold
                            </span>
                          </div>
                        </article>

                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                          <button
                            type="button"
                            onClick={() => {
                              setBreakEvenMode("margin");
                              setProfitMargin("35");
                              setCost("60");
                              setSellingPrice("100");
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <RotateCcw size={14} />
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={handleCopyBreakEven}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
                          >
                            <Copy size={14} />
                            {copiedBreakEven ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-cyan-50/70 via-white to-emerald-50/50 p-4">
                  {resultSummary ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xl font-semibold text-slate-900">{resultSummary.title}</p>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getTonePillClass(resultSummary.tone)}`}>
                          {resultSummary.badge}
                        </span>
                      </div>

                      <div className="mt-3 rounded-2xl border border-cyan-200 bg-white px-4 py-5">
                        <div className="grid items-center gap-3 text-center md:grid-cols-[1fr_auto_1fr]">
                          <div>
                            <p className="text-sm font-semibold text-slate-500">{resultSummary.leftLabel}</p>
                            <p className="mt-1 text-5xl font-semibold tracking-tight text-emerald-700">{resultSummary.leftValue}</p>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <ArrowRight size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-500">{resultSummary.rightLabel}</p>
                            <p className="mt-1 text-5xl font-semibold tracking-tight text-cyan-700">{resultSummary.rightValue}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
                        <p className="text-sm font-medium text-emerald-800">{resultSummary.message}</p>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={handleCopyToolResult}
                          className="inline-flex items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
                        >
                          <Copy size={14} />
                          {copiedToolResult ? "Copied" : "Copy result"}
                        </button>
                      </div>
                    </>
                  ) : null}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {resultItems.map((item) => (
                      <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-3.5">
                        <p className="text-sm font-semibold text-slate-600">{item.label}</p>
                        <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{item.value}</p>
                        {item.hint ? <p className="mt-1 text-xs text-slate-500">{item.hint}</p> : null}
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
