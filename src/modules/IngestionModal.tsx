import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  BarChart3,
  Download,
  Globe2,
  FileSpreadsheet,
  Megaphone,
  Package,
  ShoppingCart,
  X,
  type LucideIcon,
} from "lucide-react";
import { ingestData, type IngestionResponse, type IngestionSource } from "../services/api";
import { useStore } from "../store/useStore";

type BranchKey = "default" | "search" | "sales";

interface SelectOption {
  id: string;
  label: string;
  detail: string;
  accountId: string;
  branch?: BranchKey;
}

interface TemplateDefinition {
  key: string;
  label: string;
  description: string;
  requiredColumns: string[];
  optionalColumns: string[];
}

interface SourceDefinition {
  label: string;
  description: string;
  primaryLabel: string;
  icon: LucideIcon;
  primaryOptions: SelectOption[];
  templateGroups: Record<BranchKey, { label: string; templates: TemplateDefinition[] }>;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const daysAgoIso = (days: number) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
};

export const SOURCE_CONFIGS: Record<IngestionSource, SourceDefinition> = {
  google_ads: {
    label: "Google Ads",
    description: "Pick a campaign, choose a template, and ingest media data into the KPI workspace.",
    primaryLabel: "Campaign",
    icon: BarChart3,
    primaryOptions: [
      { id: "gads-search-main", label: "Search Main", detail: "Core acquisition account", accountId: "gads-search-main" },
      { id: "gads-brand-defense", label: "Brand Defense", detail: "Brand and conquesting", accountId: "gads-brand-defense" },
      { id: "gads-performance-max", label: "Performance Max", detail: "Feed-driven product campaigns", accountId: "gads-performance-max" },
    ],
    templateGroups: {
      default: {
        label: "Templates",
        templates: [
          {
            key: "search_export",
            label: "Search Export",
            description: "Proxy format for search campaign reporting.",
            requiredColumns: ["date", "campaign_name", "impressions", "clicks", "spend", "conversions", "revenue"],
            optionalColumns: ["ad_group", "keyword", "match_type", "device", "region"],
          },
          {
            key: "shopping_export",
            label: "Shopping Export",
            description: "Proxy format for shopping feed and product reporting.",
            requiredColumns: ["date", "campaign_name", "item_id", "impressions", "clicks", "spend", "conversions", "revenue"],
            optionalColumns: ["feed_label", "merchant_id", "device", "region"],
          },
          {
            key: "pmax_export",
            label: "Performance Max",
            description: "Proxy format for asset-group based exports.",
            requiredColumns: ["date", "campaign_name", "asset_group", "impressions", "clicks", "spend", "conversions", "revenue"],
            optionalColumns: ["audience", "campaign_id", "device", "region"],
          },
        ],
      },
      search: { label: "Templates", templates: [] },
      sales: { label: "Templates", templates: [] },
    },
  },
  google_analytics: {
    label: "Google Analytics",
    description: "Pick a property, choose a template, and expose the required fields before ingest.",
    primaryLabel: "Property",
    icon: Globe2,
    primaryOptions: [
      { id: "ga-primary-property", label: "Primary Property", detail: "Main GA4 property", accountId: "ga-primary-property" },
      { id: "ga-ecommerce-property", label: "Ecommerce Property", detail: "Store and checkout behavior", accountId: "ga-ecommerce-property" },
      { id: "ga-content-property", label: "Content Property", detail: "Landing page and content signals", accountId: "ga-content-property" },
    ],
    templateGroups: {
      default: {
        label: "Templates",
        templates: [
          {
            key: "acquisition_export",
            label: "Acquisition Export",
            description: "Proxy format for traffic source and session reporting.",
            requiredColumns: ["date", "source_medium", "sessions", "users", "engaged_sessions", "conversions", "revenue"],
            optionalColumns: ["landing_page", "campaign", "device_category", "country"],
          },
          {
            key: "funnel_export",
            label: "Funnel Export",
            description: "Proxy format for event and funnel analysis.",
            requiredColumns: ["date", "event_name", "sessions", "events", "engaged_sessions", "conversions", "revenue"],
            optionalColumns: ["landing_page", "source_medium", "device_category", "country"],
          },
          {
            key: "content_export",
            label: "Content Export",
            description: "Proxy format for page and content performance.",
            requiredColumns: ["date", "page_path", "views", "users", "avg_engagement_time", "conversions", "revenue"],
            optionalColumns: ["source_medium", "device_category", "country", "landing_page"],
          },
        ],
      },
      search: { label: "Templates", templates: [] },
      sales: { label: "Templates", templates: [] },
    },
  },
  meta_ads: {
    label: "Meta Ads",
    description: "Pick a campaign, choose a template, and keep the required columns visible.",
    primaryLabel: "Campaign",
    icon: Megaphone,
    primaryOptions: [
      { id: "meta-business-main", label: "Business Main", detail: "Primary acquisition business", accountId: "meta-business-main" },
      { id: "meta-catalog-retargeting", label: "Catalog Retargeting", detail: "Dynamic product remarketing", accountId: "meta-catalog-retargeting" },
      { id: "meta-advantage-plus", label: "Advantage Plus", detail: "Automation focused account", accountId: "meta-advantage-plus" },
      { id: "meta-app-install", label: "App Install", detail: "App growth and retention campaigns", accountId: "meta-app-install" },
    ],
    templateGroups: {
      default: {
        label: "Templates",
        templates: [
          {
            key: "prospecting_export",
            label: "Prospecting Export",
            description: "Proxy format for upper funnel campaign reporting.",
            requiredColumns: ["date", "campaign_name", "adset_name", "impressions", "clicks", "spend", "purchases", "revenue"],
            optionalColumns: ["reach", "frequency", "placement", "country"],
          },
          {
            key: "retargeting_export",
            label: "Retargeting Export",
            description: "Proxy format for audience retargeting reporting.",
            requiredColumns: ["date", "campaign_name", "ad_name", "impressions", "clicks", "spend", "purchases", "revenue"],
            optionalColumns: ["adset_name", "reach", "frequency", "country"],
          },
          {
            key: "advantage_export",
            label: "Advantage Plus",
            description: "Proxy format for automated campaign exports.",
            requiredColumns: ["date", "campaign_name", "creative_name", "impressions", "clicks", "spend", "purchases", "revenue"],
            optionalColumns: ["adset_name", "reach", "frequency", "country"],
          },
        ],
      },
      search: { label: "Templates", templates: [] },
      sales: { label: "Templates", templates: [] },
    },
  },
  shopify: {
    label: "Shopify",
    description: "Pick a store, choose a template, and expose the fields before ingest.",
    primaryLabel: "Store",
    icon: ShoppingCart,
    primaryOptions: [
      { id: "shopify-usa-store", label: "USA Store", detail: "Primary US storefront", accountId: "shopify-usa-store" },
      { id: "shopify-uk-store", label: "UK Store", detail: "UK storefront", accountId: "shopify-uk-store" },
    ],
    templateGroups: {
      default: {
        label: "Templates",
        templates: [
          {
            key: "sales_export",
            label: "Sales Export",
            description: "Proxy format for orders, sales, and channel mix.",
            requiredColumns: ["date", "order_id", "net_sales", "orders", "discounts", "product_title", "channel"],
            optionalColumns: ["customer_type", "sku", "quantity", "region"],
          },
          {
            key: "product_export",
            label: "Product Export",
            description: "Proxy format for product and SKU reporting.",
            requiredColumns: ["date", "product_title", "sku", "quantity", "net_sales", "orders", "channel"],
            optionalColumns: ["customer_type", "region", "discounts", "collection"],
          },
          {
            key: "discount_export",
            label: "Discount Export",
            description: "Proxy format for promotion and discount tracking.",
            requiredColumns: ["date", "order_id", "discount_code", "discounts", "net_sales", "orders", "channel"],
            optionalColumns: ["customer_type", "sku", "region", "product_title"],
          },
        ],
      },
      search: { label: "Templates", templates: [] },
      sales: { label: "Templates", templates: [] },
    },
  },
  amazon_ads: {
    label: "Amazon Ads",
    description: "Choose search or sales, then keep the template columns visible for the user.",
    primaryLabel: "Report type",
    icon: Package,
    primaryOptions: [
      { id: "amazon-search", label: "Search", detail: "Sponsored products, brands, and display reporting", accountId: "amazon-us-seller", branch: "search" },
      { id: "amazon-sales", label: "Sales", detail: "Orders, revenue, and product sales reporting", accountId: "amazon-global-brand", branch: "sales" },
    ],
    templateGroups: {
      default: { label: "Templates", templates: [] },
      search: {
        label: "Search Templates",
        templates: [
          {
            key: "sponsored_products",
            label: "Sponsored Products",
            description: "Proxy format for product-level marketplace exports.",
            requiredColumns: ["date", "campaign_name", "keyword", "impressions", "clicks", "spend", "orders", "revenue"],
            optionalColumns: ["asin", "match_type", "device", "region"],
          },
          {
            key: "sponsored_brands",
            label: "Sponsored Brands",
            description: "Proxy format for brand-level Amazon exports.",
            requiredColumns: ["date", "campaign_name", "ad_group", "impressions", "clicks", "spend", "orders", "revenue"],
            optionalColumns: ["asin", "keyword", "device", "region"],
          },
          {
            key: "sponsored_display",
            label: "Sponsored Display",
            description: "Proxy format for display and retargeting exports.",
            requiredColumns: ["date", "campaign_name", "asin", "impressions", "clicks", "spend", "orders", "revenue"],
            optionalColumns: ["placement", "audience", "device", "region"],
          },
        ],
      },
      sales: {
        label: "Sales Templates",
        templates: [
          {
            key: "sales_summary",
            label: "Sales Summary",
            description: "Proxy format for product sales and order totals.",
            requiredColumns: ["date", "asin", "product_title", "orders", "revenue", "quantity", "channel"],
            optionalColumns: ["customer_type", "region", "discounts"],
          },
          {
            key: "sales_detail",
            label: "Sales Detail",
            description: "Proxy format for order-level sales reporting.",
            requiredColumns: ["date", "order_id", "asin", "product_title", "orders", "revenue", "channel"],
            optionalColumns: ["customer_type", "sku", "region", "quantity"],
          },
          {
            key: "promo_sales",
            label: "Promo Sales",
            description: "Proxy format for promotional sales analysis.",
            requiredColumns: ["date", "product_title", "discount_code", "orders", "revenue", "quantity", "channel"],
            optionalColumns: ["asin", "customer_type", "region"],
          },
        ],
      },
    },
  },
};

export function getIngestionDefaults(source: IngestionSource) {
  const config = SOURCE_CONFIGS[source];
  const primary = config.primaryOptions[0];
  const branch = primary.branch ?? "default";
  const template = config.templateGroups[branch].templates[0];

  return {
    primaryId: primary.id,
    templateKey: template.key,
    selectedColumns: [...template.requiredColumns],
    startDate: daysAgoIso(30),
    endDate: todayIso(),
  };
}

export function formatMetric(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function SourceSelect({
  label,
  valueLabel,
  valueDetail,
  helper,
  options,
  isOpen,
  selectedId,
  onToggle,
  onSelect,
}: {
  label: string;
  valueLabel: string;
  valueDetail: string;
  helper: string;
  options: SelectOption[];
  isOpen: boolean;
  selectedId: string;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="relative">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-cyan-300 hover:shadow-md"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{valueLabel}</div>
          <div className="truncate text-[12px] text-slate-500">{valueDetail}</div>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{helper}</span>
          <ChevronDown size={16} />
        </div>
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {options.map((option) => {
            const active = option.id === selectedId;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.id)}
                className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition ${
                  active ? "bg-cyan-50" : "hover:bg-slate-50"
                }`}
              >
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${active ? "text-cyan-700" : "text-slate-900"}`}>{option.label}</div>
                  <div className="text-[12px] text-slate-500">{option.detail}</div>
                </div>
                {active ? <Check size={16} className="mt-0.5 text-cyan-600" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function IngestionModal({ source }: { source: IngestionSource }) {
  const config = SOURCE_CONFIGS[source];
  const { closeIngestionModal, setDataset, setUploadSummary } = useStore();
  const defaults = useMemo(() => getIngestionDefaults(source), [source]);
  const [selectedPrimaryId, setSelectedPrimaryId] = useState(defaults.primaryId);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(defaults.templateKey);
  const [selectedColumns, setSelectedColumns] = useState(defaults.selectedColumns);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [isPrimaryOpen, setIsPrimaryOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<IngestionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedPrimaryId(defaults.primaryId);
    setSelectedTemplateKey(defaults.templateKey);
    setSelectedColumns(defaults.selectedColumns);
    setStartDate(defaults.startDate);
    setEndDate(defaults.endDate);
    setIsPrimaryOpen(false);
    setIsTemplateOpen(false);
    setIsSubmitting(false);
    setResponse(null);
    setError(null);
  }, [defaults]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeIngestionModal();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeIngestionModal]);

  const selectedPrimary = useMemo(
    () => config.primaryOptions.find((option) => option.id === selectedPrimaryId) ?? config.primaryOptions[0],
    [config.primaryOptions, selectedPrimaryId]
  );
  const branchKey: BranchKey = selectedPrimary.branch ?? "default";
  const templateGroup = config.templateGroups[branchKey] ?? config.templateGroups.default;
  const selectedTemplate = useMemo(
    () => templateGroup.templates.find((template) => template.key === selectedTemplateKey) ?? templateGroup.templates[0],
    [selectedTemplateKey, templateGroup.templates]
  );
  const requiredColumns = selectedTemplate?.requiredColumns ?? [];
  const optionalColumns = selectedTemplate?.optionalColumns ?? [];
  const selectedColumnSet = useMemo(() => new Set(selectedColumns), [selectedColumns]);
  const previewColumns = response ? Object.keys(response.preview_rows[0] ?? {}) : [];
  const selectedPrimaryIndex = Math.max(config.primaryOptions.findIndex((option) => option.id === selectedPrimary.id), 0);
  const canSubmit = !isSubmitting && Boolean(selectedTemplate) && startDate <= endDate;

  const handlePrimarySelect = (id: string) => {
    const option = config.primaryOptions.find((item) => item.id === id) ?? config.primaryOptions[0];
    const nextGroup = config.templateGroups[option.branch ?? "default"] ?? config.templateGroups.default;
    const nextTemplate = nextGroup.templates[0];

    setSelectedPrimaryId(option.id);
    setSelectedTemplateKey(nextTemplate.key);
    setSelectedColumns([...nextTemplate.requiredColumns]);
    setIsPrimaryOpen(false);
    setIsTemplateOpen(false);
    setResponse(null);
    setError(null);
  };

  const handleTemplateSelect = (key: string) => {
    const nextTemplate = templateGroup.templates.find((template) => template.key === key) ?? templateGroup.templates[0];
    setSelectedTemplateKey(nextTemplate.key);
    setSelectedColumns([...nextTemplate.requiredColumns]);
    setIsTemplateOpen(false);
    setResponse(null);
    setError(null);
  };

  const handleToggleOptional = (column: string) => {
    if (requiredColumns.includes(column)) return;
    setSelectedColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column]
    );
  };

  const handleIngest = async () => {
    if (!selectedTemplate) return;
    if (startDate > endDate) {
      setError("Start date must be on or before end date.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payloadColumns = Array.from(new Set([...requiredColumns, ...selectedColumns]));
    const result = await ingestData({
      source,
      template_key: selectedTemplate.key,
      account_id: selectedPrimary.accountId,
      start_date: startDate,
      end_date: endDate,
      columns: payloadColumns,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (!result.data) {
      setError("No response received from the backend.");
      return;
    }

    setResponse(result.data);
    setDataset({
      rows: result.data.preview_rows,
      columns: result.data.columns.map((column) => ({ name: column.name, type: column.type })),
      rowCount: result.data.row_count,
      isSampled: result.data.preview_rows.length < result.data.row_count,
      sampleRowCount: result.data.preview_rows.length,
      fileType: result.data.source_label,
    });
    setUploadSummary({
      title: `${result.data.source_label} ingest`,
      datasetTheme: result.data.source_label,
      story: result.data.notes.length ? result.data.notes : [`${result.data.template_label} prepared for ${result.data.account_label}.`],
      warnings: result.data.warnings,
      analysisAngles: [result.data.template_label, result.data.account_label, `${result.data.column_count.toLocaleString()} columns`],
      modelUsed: "demo-ingestion",
      usedFallback: true,
      profilingMode: "sampled",
      rowCount: result.data.row_count,
      rowCountIsEstimated: false,
      columnCount: result.data.column_count,
      sampleRowCount: result.data.preview_rows.length,
      fileType: result.data.source_label,
      timeColumn: "date",
      dateRange: { min: result.data.start_date, max: result.data.end_date },
      columnGroups: result.data.column_groups,
    });
  };

  const handleDownloadExcel = () => {
    if (!response) return;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(response.preview_rows), "Preview");
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        { field: "Source", value: response.source_label },
        { field: "Template", value: response.template_label },
        { field: "Account", value: response.account_label },
        { field: "Rows", value: response.row_count },
        { field: "Columns", value: response.column_count },
        { field: "Start Date", value: response.start_date },
        { field: "End Date", value: response.end_date },
      ]),
      "Summary"
    );

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = response.download_filename || `${source}_${selectedTemplate.key}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm"
      onClick={closeIngestionModal}
    >
      <div
        className="flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-cyan-50 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
              <config.icon size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Source setup</p>
                {response ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 size={12} />
                    Ingest complete
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    Draft mode
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">{config.label}</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">{config.description}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeIngestionModal}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close ingestion modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[390px,1fr]">
          <div className="space-y-5 overflow-y-auto bg-slate-50/80 px-6 py-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Source</p>
                  <p className="text-lg font-semibold text-slate-900">{config.label}</p>
                </div>
                <span className="rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-semibold text-cyan-700">
                  {selectedPrimaryIndex + 1} / {config.primaryOptions.length}
                </span>
              </div>

              <SourceSelect
                label={config.primaryLabel}
                valueLabel={selectedPrimary.label}
                valueDetail={selectedPrimary.detail}
                helper={config.primaryLabel.toLowerCase()}
                options={config.primaryOptions}
                isOpen={isPrimaryOpen}
                selectedId={selectedPrimary.id}
                onToggle={() => {
                  setIsPrimaryOpen((value) => !value);
                  setIsTemplateOpen(false);
                }}
                onSelect={handlePrimarySelect}
              />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{templateGroup.label}</p>
                <p className="text-lg font-semibold text-slate-900">Template</p>
                <p className="text-sm text-slate-500">{selectedTemplate?.description}</p>
              </div>

              <SourceSelect
                label="Template"
                valueLabel={selectedTemplate?.label ?? "Select a template"}
                valueDetail={selectedTemplate?.description ?? "Choose a template to reveal required columns"}
                helper="template"
                options={templateGroup.templates.map((template) => ({
                  id: template.key,
                  label: template.label,
                  detail: template.description,
                  accountId: template.key,
                }))}
                isOpen={isTemplateOpen}
                selectedId={selectedTemplate?.key ?? ""}
                onToggle={() => {
                  setIsTemplateOpen((value) => !value);
                  setIsPrimaryOpen(false);
                }}
                onSelect={handleTemplateSelect}
              />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays size={16} className="text-cyan-600" />
                <p className="text-lg font-semibold text-slate-900">Date range</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Start</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">End</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Columns</p>
                <p className="text-lg font-semibold text-slate-900">Required and optional fields</p>
                <p className="text-sm text-slate-500">Required fields stay locked on. Optional fields can be toggled before ingest.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Required</p>
                  <div className="flex flex-wrap gap-2">
                    {requiredColumns.map((column) => (
                      <span
                        key={column}
                        className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[12px] font-medium text-cyan-800"
                      >
                        <Check size={12} />
                        {column}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Optional</p>
                  <div className="flex flex-wrap gap-2">
                    {optionalColumns.length === 0 ? (
                      <span className="text-sm text-slate-500">No optional fields for this template.</span>
                    ) : (
                      optionalColumns.map((column) => {
                        const active = selectedColumnSet.has(column);
                        return (
                          <button
                            key={column}
                            type="button"
                            onClick={() => handleToggleOptional(column)}
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                              active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-700"
                            }`}
                          >
                            {active ? <Check size={12} /> : null}
                            {column}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-900 p-5 text-white shadow-lg">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Action</p>
              <p className="mt-1 text-lg font-semibold">{response ? "Update or re-run the demo ingest" : "Run the demo ingest"}</p>
              <p className="mt-2 text-sm text-slate-300">
                The modal stays open after ingest so the user can review the preview and download Excel immediately.
              </p>

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="mt-0.5" />
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleIngest}
                disabled={!canSubmit}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Ingesting...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Ingest data
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto bg-white px-6 py-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Result</p>
                <p className="text-lg font-semibold text-slate-900">{response ? response.template_label : "Preview will appear here"}</p>
              </div>

              <button
                type="button"
                onClick={handleDownloadExcel}
                disabled={!response}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileSpreadsheet size={16} />
                Download Excel
              </button>
            </div>

            {response ? (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Rows", value: formatMetric(response.row_count) },
                    { label: "Columns", value: formatMetric(response.column_count) },
                    { label: "Account", value: response.account_label },
                    { label: "Status", value: response.status },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {Object.entries(response.key_metrics).map(([metric, value]) => (
                    <div key={metric} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{metric}</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">
                        {metric === "spend" || metric === "revenue" ? formatCurrency(value) : formatMetric(value)}
                      </p>
                    </div>
                  ))}
                </div>

                {response.warnings.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-800">Warnings</p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-800/90">
                      {response.warnings.map((warning) => (
                        <li key={warning}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="grid gap-3 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Notes</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-600">
                      {response.notes.map((note) => (
                        <li key={note} className="rounded-xl bg-white px-3 py-2 shadow-sm">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Requested columns</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {response.requested_columns.map((column) => (
                        <span key={column} className="rounded-full bg-slate-900 px-3 py-1 text-[12px] font-medium text-white">
                          {column}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Preview</p>
                      <p className="text-xs text-slate-500">{response.preview_rows.length} rows shown from the generated batch</p>
                    </div>
                    <p className="text-xs text-slate-500">{previewColumns.length} columns</p>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr>
                          {previewColumns.map((column) => (
                            <th
                              key={column}
                              className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {response.preview_rows.slice(0, 10).map((row, rowIndex) => (
                          <tr key={`${rowIndex}`} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                            {previewColumns.map((column) => (
                              <td key={`${rowIndex}-${column}`} className="whitespace-nowrap border-b border-slate-100 px-3 py-2 text-slate-700">
                                {String(row[column] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[480px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-8 py-10 text-center">
                <div className="max-w-md">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <FileSpreadsheet size={28} className="text-cyan-600" />
                  </div>
                  <p className="text-xl font-semibold text-slate-900">Template fields will show before ingest</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Select a source, choose the store, campaign, property, or report type, and the required/optional columns stay visible on this screen.
                  </p>
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm text-slate-600">
                    <p className="font-semibold text-slate-900">Current template</p>
                    <p className="mt-1">{selectedTemplate?.label}</p>
                    <p className="mt-3 font-semibold text-slate-900">Required columns</p>
                    <p className="mt-1 leading-6">
                      {requiredColumns.length > 0 ? requiredColumns.join(", ") : "Select a template to see the required fields."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
