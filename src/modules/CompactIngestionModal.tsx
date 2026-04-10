import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  Filter,
  FileSpreadsheet,
  Plus,
  Save,
  Settings,
  SortAsc,
  Trash2,
  X,
} from "lucide-react";
import { ingestData, type IngestionResponse, type IngestionSource } from "../services/api";
import { useStore } from "../store/useStore";
import { SOURCE_CONFIGS, getIngestionDefaults } from "./IngestionModal";

type BranchKey = "default" | "search" | "sales";
type RangePreset = "this_month" | "last_30" | "last_90" | "custom";
type SortDirection = "asc" | "desc";
type FilterOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "contains";
type NumericFilterOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
type TextFilterOperator = "eq" | "neq" | "contains";

interface SortRule {
  column: string;
  direction: SortDirection;
}

interface FilterRule {
  column: string;
  operator: FilterOperator;
  value: string;
}

interface SavedSetupCard {
  sourceLabel: string;
  accountLabel: string;
  templateLabel: string;
  reportTitle: string;
  savedAt: string;
  signature: string;
}

const FALLBACK_COLUMNS = ["Column 1", "Column 2", "Column 3", "Column 4", "Column 5"];
const SAVED_SETUP_STORAGE_KEY = "kpi_reporting_saved_ingestion_setups";

const NUMERIC_FILTER_OPTIONS: { value: NumericFilterOperator; label: string }[] = [
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater than or equal" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less than or equal" },
  { value: "eq", label: "Equal" },
  { value: "neq", label: "Not equal" },
];

const TEXT_FILTER_OPTIONS: { value: TextFilterOperator; label: string }[] = [
  { value: "eq", label: "Equal" },
  { value: "neq", label: "Not equal" },
  { value: "contains", label: "Contains" },
];

const getRange = (preset: RangePreset) => {
  const end = new Date();
  const endIso = end.toISOString().slice(0, 10);
  if (preset === "this_month") return { startDate: new Date(end.getFullYear(), end.getMonth(), 1).toISOString().slice(0, 10), endDate: endIso };
  if (preset === "last_30") {
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    return { startDate: start.toISOString().slice(0, 10), endDate: endIso };
  }
  if (preset === "last_90") {
    const start = new Date(end);
    start.setDate(start.getDate() - 89);
    return { startDate: start.toISOString().slice(0, 10), endDate: endIso };
  }
  return { startDate: endIso, endDate: endIso };
};

function SelectField({
  label,
  valueLabel,
  valueDetail,
  options,
  isOpen,
  selectedId,
  onToggle,
  onSelect,
}: {
  label: string;
  valueLabel: string;
  valueDetail: string;
  options: { id: string; label: string; detail: string }[];
  isOpen: boolean;
  selectedId: string;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="relative">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-left">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{valueLabel}</div>
          <div className="truncate text-xs text-slate-500">{valueDetail}</div>
        </div>
        <ChevronDown size={16} className="text-slate-400" />
      </button>
      {isOpen ? (
        <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-slate-300 bg-white shadow-xl">
          {options.map((option) => {
            const active = option.id === selectedId;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.id)}
                className={`flex w-full items-start justify-between gap-3 border-b border-slate-200 px-3 py-2 text-left last:border-b-0 ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                  <div className="text-xs text-slate-500">{option.detail}</div>
                </div>
                {active ? <Check size={14} className="mt-0.5 text-slate-700" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function CompactIngestionModal({ source }: { source: IngestionSource }) {
  const config = SOURCE_CONFIGS[source];
  const defaults = useMemo(() => getIngestionDefaults(source), [source]);
  const { closeIngestionModal, setDataset, setUploadSummary } = useStore();

  const [reportTitle, setReportTitle] = useState("Campaign Performance");
  const [selectedPrimaryId, setSelectedPrimaryId] = useState(defaults.primaryId);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(defaults.templateKey);
  const [isPrimaryOpen, setIsPrimaryOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<IngestionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialRange = getRange("this_month");
  const [rangePreset, setRangePreset] = useState<RangePreset>("this_month");
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);

  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [sortRules, setSortRules] = useState<SortRule[]>([]);
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isFieldsModalOpen, setIsFieldsModalOpen] = useState(false);
  const [sortSearch, setSortSearch] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [fieldsSearch, setFieldsSearch] = useState("");
  const [draftSortRules, setDraftSortRules] = useState<SortRule[]>([]);
  const [draftFilterRules, setDraftFilterRules] = useState<FilterRule[]>([]);
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [savedSetupCard, setSavedSetupCard] = useState<SavedSetupCard | null>(null);

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
  const templateColumns = useMemo(() => {
    if (!selectedTemplate) return [];
    return Array.from(new Set([...selectedTemplate.requiredColumns, ...selectedTemplate.optionalColumns]));
  }, [selectedTemplate]);

  const availableColumns = useMemo(() => {
    if (response) return response.columns.map((column) => column.name);
    if (templateColumns.length > 0) return templateColumns;
    return FALLBACK_COLUMNS;
  }, [response, templateColumns]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeIngestionModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeIngestionModal]);

  useEffect(() => {
    setSelectedPrimaryId(defaults.primaryId);
    setSelectedTemplateKey(defaults.templateKey);
    setResponse(null);
    setError(null);
    setVisibleColumns([]);
    setSortRules([]);
    setFilterRules([]);
    setIsSortModalOpen(false);
    setIsFilterModalOpen(false);
    setIsFieldsModalOpen(false);
    setSortSearch("");
    setFilterSearch("");
    setFieldsSearch("");
    setDraftSortRules([]);
    setDraftFilterRules([]);
    setDraftVisibleColumns([]);
  }, [defaults]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_SETUP_STORAGE_KEY);
      if (!raw) {
        setSavedSetupCard(null);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<Record<IngestionSource, SavedSetupCard>>;
      setSavedSetupCard(parsed[source] ?? null);
    } catch {
      setSavedSetupCard(null);
    }
  }, [source]);

  useEffect(() => {
    setVisibleColumns((current) => (current.length > 0 ? current.filter((column) => availableColumns.includes(column)) : availableColumns.slice(0, 7)));
  }, [availableColumns]);

  const tableColumns = useMemo(() => (visibleColumns.length > 0 ? visibleColumns : availableColumns.slice(0, 7)), [availableColumns, visibleColumns]);
  const saveSignature = useMemo(
    () =>
      [
        source,
        reportTitle,
        selectedPrimaryId,
        selectedTemplateKey,
        startDate,
        endDate,
        tableColumns.join("|"),
      ].join("::"),
    [source, reportTitle, selectedPrimaryId, selectedTemplateKey, startDate, endDate, tableColumns]
  );

  useEffect(() => {
    setSortRules((current) => current.filter((rule) => tableColumns.includes(rule.column)));
    setFilterRules((current) => current.filter((rule) => tableColumns.includes(rule.column)));
  }, [tableColumns]);

  useEffect(() => {
    setSaveState("idle");
  }, [saveSignature]);

  const isNumericColumn = (column: string) => {
    const meta = response?.columns.find((item) => item.name === column)?.type;
    if (meta === "numeric") return true;
    return /(sales|revenue|spend|amount|impressions|clicks|conversions|cost|value|count)$/i.test(column);
  };

  const filteredRows = useMemo(() => {
    if (!response) return [] as Record<string, unknown>[];
    let rows = [...response.preview_rows];

    if (filterRules.length > 0) {
      rows = rows.filter((row) =>
        filterRules.every((rule) => {
          const rawValue = rule.value.trim();
          if (!rawValue.length) return true;
          const cell = row[rule.column];
          const numeric = isNumericColumn(rule.column);

          if (numeric) {
            const left = Number(cell);
            const right = Number(rawValue);
            if (Number.isNaN(left) || Number.isNaN(right)) return false;
            if (rule.operator === "gt") return left > right;
            if (rule.operator === "gte") return left >= right;
            if (rule.operator === "lt") return left < right;
            if (rule.operator === "lte") return left <= right;
            if (rule.operator === "eq") return left === right;
            if (rule.operator === "neq") return left !== right;
            return false;
          }

          const left = String(cell ?? "").toLowerCase();
          const right = rawValue.toLowerCase();
          if (rule.operator === "eq") return left === right;
          if (rule.operator === "neq") return left !== right;
          return left.includes(right);
        })
      );
    }

    if (sortRules.length > 0) {
      rows.sort((a, b) => {
        for (const rule of sortRules) {
          const numeric = isNumericColumn(rule.column);
          if (numeric) {
            const left = Number(a[rule.column]);
            const right = Number(b[rule.column]);
            if (Number.isNaN(left) && Number.isNaN(right)) continue;
            if (Number.isNaN(left)) return 1;
            if (Number.isNaN(right)) return -1;
            if (left !== right) return rule.direction === "asc" ? left - right : right - left;
            continue;
          }

          const left = String(a[rule.column] ?? "");
          const right = String(b[rule.column] ?? "");
          const compared = left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
          if (compared !== 0) return rule.direction === "asc" ? compared : -compared;
        }
        return 0;
      });
    }

    return rows;
  }, [response, filterRules, sortRules]);

  const sortSearchResults = useMemo(
    () => tableColumns.filter((column) => column.toLowerCase().includes(sortSearch.trim().toLowerCase())),
    [tableColumns, sortSearch]
  );

  const filterSearchResults = useMemo(
    () => tableColumns.filter((column) => column.toLowerCase().includes(filterSearch.trim().toLowerCase())),
    [tableColumns, filterSearch]
  );

  const fieldsSearchResults = useMemo(
    () => availableColumns.filter((column) => column.toLowerCase().includes(fieldsSearch.trim().toLowerCase())),
    [availableColumns, fieldsSearch]
  );

  const openSortModal = () => {
    setDraftSortRules(sortRules.length > 0 ? sortRules : tableColumns.slice(0, 1).map((column) => ({ column, direction: "asc" as const })));
    setSortSearch("");
    setIsSortModalOpen(true);
    setIsFilterModalOpen(false);
    setIsFieldsModalOpen(false);
  };

  const openFilterModal = () => {
    setDraftFilterRules(filterRules);
    setFilterSearch("");
    setIsFilterModalOpen(true);
    setIsSortModalOpen(false);
    setIsFieldsModalOpen(false);
  };

  const openFieldsModal = () => {
    setDraftVisibleColumns(tableColumns);
    setFieldsSearch("");
    setIsFieldsModalOpen(true);
    setIsSortModalOpen(false);
    setIsFilterModalOpen(false);
  };

  const handleSourceSelect = (id: string) => {
    const option = config.primaryOptions.find((item) => item.id === id) ?? config.primaryOptions[0];
    const nextGroup = config.templateGroups[option.branch ?? "default"] ?? config.templateGroups.default;
    const nextTemplate = nextGroup.templates[0];
    setSelectedPrimaryId(option.id);
    setSelectedTemplateKey(nextTemplate.key);
    setIsPrimaryOpen(false);
    setResponse(null);
    setError(null);
    setSortRules([]);
    setFilterRules([]);
    setIsSortModalOpen(false);
    setIsFilterModalOpen(false);
    setIsFieldsModalOpen(false);
  };

  const handleTemplateSelect = (templateKey: string) => {
    setSelectedTemplateKey(templateKey);
    setResponse(null);
    setError(null);
    setVisibleColumns([]);
    setSortRules([]);
    setFilterRules([]);
    setIsSortModalOpen(false);
    setIsFilterModalOpen(false);
    setIsFieldsModalOpen(false);
  };

  const handleIngest = async () => {
    if (!selectedTemplate) return;
    if (startDate > endDate) {
      setError("Start date must be on or before end date.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await ingestData({
      source,
      template_key: selectedTemplate.key,
      account_id: selectedPrimary.accountId,
      start_date: startDate,
      end_date: endDate,
      columns: templateColumns,
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
    const cols = result.data.columns.map((column) => column.name);
    setVisibleColumns(cols);

    setDataset({
      rows: result.data.preview_rows,
      columns: result.data.columns.map((column) => ({ name: column.name, type: column.type })),
      rowCount: result.data.row_count,
      isSampled: result.data.preview_rows.length < result.data.row_count,
      sampleRowCount: result.data.preview_rows.length,
      fileType: result.data.source_label,
    });

    setUploadSummary({
      title: reportTitle.trim() || result.data.template_label,
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
    if (!response || !selectedTemplate) return;

    const exportRows = filteredRows.map((row) => {
      const next: Record<string, unknown> = {};
      tableColumns.forEach((column) => {
        next[column] = row[column];
      });
      return next;
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), "Preview");
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

  const handleSaveConfiguration = () => {
    if (saveState === "saving") return;
    setSaveState("saving");
    window.setTimeout(() => {
      const card: SavedSetupCard = {
        sourceLabel: config.label,
        accountLabel: selectedPrimary.label,
        templateLabel: selectedTemplate?.label ?? "Template",
        reportTitle: reportTitle.trim() || "Campaign Performance",
        savedAt: new Date().toISOString(),
        signature: saveSignature,
      };
      setSavedSetupCard(card);
      try {
        const raw = window.localStorage.getItem(SAVED_SETUP_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Partial<Record<IngestionSource, SavedSetupCard>>) : {};
        parsed[source] = card;
        window.localStorage.setItem(SAVED_SETUP_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // no-op: saving indicator still updates even if localStorage is unavailable
      }
      setSaveState("saved");
    }, 450);
  };

  const addSortRule = (column: string) => {
    if (!column) return;
    setDraftSortRules((current) => (current.some((rule) => rule.column === column) ? current : [...current, { column, direction: "asc" }]));
  };

  const addFilterRule = (column: string) => {
    if (!column) return;
    setDraftFilterRules((current) => {
      const hasNumeric = isNumericColumn(column);
      const defaultOperator: FilterOperator = hasNumeric ? "gt" : "eq";
      return [...current, { column, operator: defaultOperator, value: "" }];
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-[1px]" onClick={closeIngestionModal}>
      <div className="flex h-[92vh] w-full max-w-[1360px] min-w-[1100px] flex-col overflow-hidden rounded-[20px] border border-slate-300 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white">
              <config.icon size={16} />
            </div>
            <h2 className="text-xl font-semibold leading-none text-slate-900">{config.label}</h2>
          </div>
          <button type="button" onClick={closeIngestionModal} className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Close ingestion modal">
            <X size={30} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-nowrap">
          <aside className="min-h-0 w-[380px] shrink-0 border-r border-slate-200 bg-white px-5 py-5">
            <div className="h-full space-y-5 overflow-y-auto pr-1">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Report Title</label>
                <input value={reportTitle} onChange={(event) => setReportTitle(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-400" />
              </div>

              <div>
                <p className="mb-1.5 text-sm font-semibold text-slate-700">{config.primaryLabel}</p>
                <SelectField
                  label={config.primaryLabel}
                  valueLabel={selectedPrimary.label}
                  valueDetail={selectedPrimary.detail}
                  options={config.primaryOptions.map((option) => ({ id: option.id, label: option.label, detail: option.detail }))}
                  isOpen={isPrimaryOpen}
                  selectedId={selectedPrimary.id}
                  onToggle={() => setIsPrimaryOpen((value) => !value)}
                  onSelect={handleSourceSelect}
                />
              </div>

              <div>
                <p className="mb-1.5 text-sm font-semibold text-slate-700">Template</p>
                <select
                  value={selectedTemplateKey}
                  onChange={(event) => handleTemplateSelect(event.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-400"
                >
                  {templateGroup.templates.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-slate-500">{selectedTemplate?.description}</p>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Fields</p>
                  <span className="text-xs text-slate-500">{tableColumns.length} selected</span>
                </div>
                <button
                  type="button"
                  onClick={openFieldsModal}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-slate-400"
                >
                  Edit fields
                </button>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tableColumns.slice(0, 4).map((field) => (
                    <span key={field} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                      {field}
                    </span>
                  ))}
                  {tableColumns.length > 4 ? (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                      +{tableColumns.length - 4} more
                    </span>
                  ) : null}
                </div>
              </div>

              {error ? (
                <div className="rounded-md border border-rose-300 bg-rose-50 p-3">
                  <div className="flex items-start gap-2 text-rose-700">
                    <AlertTriangle size={16} className="mt-0.5" />
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSaveConfiguration}
                  disabled={saveState === "saving"}
                  className={`inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    saveState === "saved"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {saveState === "saving" ? (
                    "Saving..."
                  ) : saveState === "saved" ? (
                    <>
                      <Check size={16} />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save
                    </>
                  )}
                </button>

                <button type="button" onClick={handleIngest} disabled={isSubmitting || startDate > endDate} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting ? "Ingesting..." : <><Download size={16} />Ingest</>}
                </button>
              </div>
              {saveState === "saved" ? (
                <p className="text-xs font-medium text-emerald-700">Configuration saved</p>
              ) : null}

              {savedSetupCard ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Saved Setup</p>
                    <span className="text-[11px] font-medium text-emerald-700">
                      {savedSetupCard.signature === saveSignature ? "Saved" : "Unsaved changes"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-emerald-900">{savedSetupCard.reportTitle}</p>
                  <p className="mt-0.5 text-xs text-emerald-800">
                    {savedSetupCard.sourceLabel} | {savedSetupCard.accountLabel}
                  </p>
                  <p className="text-xs text-emerald-800">{savedSetupCard.templateLabel}</p>
                  <p className="mt-1 text-[11px] text-emerald-700">
                    Last saved {new Date(savedSetupCard.savedAt).toLocaleString()} | Auto-update: Daily
                  </p>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="relative min-h-0 min-w-0 flex-1 bg-white px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openSortModal}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-cyan-700"
                >
                  <SortAsc size={16} className="text-cyan-600" />
                  Sort ({sortRules.length})
                </button>
                <button
                  type="button"
                  onClick={openFilterModal}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <Filter size={16} />
                  Filter ({filterRules.length})
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                  <CalendarDays size={16} />
                  <select
                    value={rangePreset}
                    onChange={(event) => {
                      const preset = event.target.value as RangePreset;
                      setRangePreset(preset);
                      if (preset !== "custom") {
                        const next = getRange(preset);
                        setStartDate(next.startDate);
                        setEndDate(next.endDate);
                        setResponse(null);
                      }
                    }}
                    className="bg-transparent outline-none"
                  >
                    <option value="this_month">This month</option>
                    <option value="last_30">Last 30 days</option>
                    <option value="last_90">Last 90 days</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <button type="button" className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-600"><Settings size={16} /></button>
              </div>
            </div>

            {rangePreset === "custom" ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setResponse(null); }} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" />
                <span className="text-sm text-slate-500">to</span>
                <input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setResponse(null); }} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" />
              </div>
            ) : null}

            <div className="relative mt-4 min-h-[calc(100vh-300px)] overflow-hidden rounded-md border border-slate-300 bg-white">
              <div className="h-full overflow-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100">
                    <tr>
                      {tableColumns.map((column) => (
                        <th key={column} className="whitespace-nowrap border-b border-r border-slate-300 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 last:border-r-0">
                          <div className="flex items-center justify-between gap-2">
                            <span>{column}</span>
                            <button type="button" onClick={() => setVisibleColumns((current) => current.length <= 1 ? current : current.filter((item) => item !== column))} className="text-slate-400 hover:text-slate-700">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(response ? filteredRows.slice(0, 18) : Array.from({ length: 20 }, () => ({}))).map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                        {tableColumns.map((column) => (
                          <td key={`${rowIndex}-${column}`} className="h-8 whitespace-nowrap border-b border-r border-slate-200 px-3 py-2 text-slate-700 last:border-r-0">
                            {response ? String((row as Record<string, unknown>)[column] ?? "") : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!response ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/35">
                  <div className="rounded-md border border-slate-300 bg-white px-10 py-6 text-center shadow-md">
                    <p className="text-[34px] leading-tight text-slate-700">Please click Ingest to preview data.</p>
                  </div>
                </div>
              ) : null}
            </div>

            {response ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-slate-300 bg-slate-50 px-4 py-3">
                <div className="text-sm text-slate-600">{response.template_label} ready for preview</div>
                <button type="button" onClick={handleDownloadExcel} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
                  <FileSpreadsheet size={16} />
                  Download Excel
                </button>
              </div>
            ) : null}

            {isSortModalOpen ? (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/35 p-3">
                <div className="flex h-[78vh] w-[96%] max-w-[1040px] flex-col rounded-xl border border-slate-300 bg-white shadow-xl">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-2xl font-semibold text-slate-800">Sort</p>
                    <p className="text-sm text-slate-500">Sort your report by one or more fields.</p>
                  </div>
                  <div className="grid min-h-0 flex-1 grid-cols-[280px,1fr]">
                    <div className="min-h-0 border-r border-slate-200 p-3">
                      <input
                        value={sortSearch}
                        onChange={(event) => setSortSearch(event.target.value)}
                        placeholder="Search..."
                        className="mb-3 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                      />
                      <div className="h-[calc(100%-44px)] overflow-y-auto rounded-md border border-slate-200">
                        {sortSearchResults.map((column) => (
                          <button
                            key={column}
                            type="button"
                            onClick={() => addSortRule(column)}
                            className="flex w-full items-center justify-between border-b border-slate-200 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                          >
                            <span>{column}</span>
                            <Plus size={14} className="text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="min-h-0 p-3">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-slate-500">Selected fields</span>
                        <button type="button" onClick={() => setDraftSortRules([])} className="text-slate-500 hover:text-slate-700">Clear selected</button>
                      </div>
                      <div className="h-[calc(100%-28px)] space-y-2 overflow-y-auto">
                        {draftSortRules.length === 0 ? (
                          <div className="flex h-full items-center justify-center text-slate-400">Select a field from the left to add sorting.</div>
                        ) : (
                          draftSortRules.map((rule, index) => (
                            <div key={`${rule.column}-${index}`} className="rounded-md border border-slate-300 bg-slate-50 p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm font-semibold text-slate-800">{rule.column}</p>
                                <button
                                  type="button"
                                  onClick={() => setDraftSortRules((current) => current.filter((_, i) => i !== index))}
                                  className="text-slate-500 hover:text-slate-700"
                                >
                                  <X size={15} />
                                </button>
                              </div>
                              <select
                                value={rule.direction}
                                onChange={(event) =>
                                  setDraftSortRules((current) =>
                                    current.map((item, i) => (i === index ? { ...item, direction: event.target.value as SortDirection } : item))
                                  )
                                }
                                className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                              >
                                <option value="asc">Ascending</option>
                                <option value="desc">Descending</option>
                              </select>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button type="button" onClick={() => setIsSortModalOpen(false)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Cancel</button>
                    <button
                      type="button"
                      onClick={() => {
                        setSortRules(draftSortRules);
                        setIsSortModalOpen(false);
                      }}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {isFilterModalOpen ? (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/35 p-3">
                <div className="flex h-[78vh] w-[96%] max-w-[1040px] flex-col rounded-xl border border-slate-300 bg-white shadow-xl">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-2xl font-semibold text-slate-800">Filter</p>
                    <p className="text-sm text-slate-500">Your report will only include data that matches your filters.</p>
                  </div>
                  <div className="grid min-h-0 flex-1 grid-cols-[280px,1fr]">
                    <div className="min-h-0 border-r border-slate-200 p-3">
                      <input
                        value={filterSearch}
                        onChange={(event) => setFilterSearch(event.target.value)}
                        placeholder="Search..."
                        className="mb-3 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                      />
                      <div className="h-[calc(100%-44px)] overflow-y-auto rounded-md border border-slate-200">
                        {filterSearchResults.map((column) => (
                          <button
                            key={column}
                            type="button"
                            onClick={() => addFilterRule(column)}
                            className="flex w-full items-center justify-between border-b border-slate-200 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                          >
                            <span>{column}</span>
                            <Plus size={14} className="text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="min-h-0 p-3">
                      <div className="h-full space-y-2 overflow-y-auto">
                        {draftFilterRules.length === 0 ? (
                          <div className="flex h-full items-center justify-center text-slate-400">Select a field from the left to add a filter.</div>
                        ) : (
                          draftFilterRules.map((rule, index) => {
                            const numeric = isNumericColumn(rule.column);
                            return (
                              <div key={`${rule.column}-${index}`} className="rounded-md border border-slate-300 bg-slate-50 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <p className="text-sm font-semibold text-slate-800">{rule.column}</p>
                                  <button
                                    type="button"
                                    onClick={() => setDraftFilterRules((current) => current.filter((_, i) => i !== index))}
                                    className="text-slate-500 hover:text-slate-700"
                                  >
                                    <X size={15} />
                                  </button>
                                </div>
                                <div className="grid grid-cols-[170px,1fr] gap-2">
                                  <select
                                    value={rule.operator}
                                    onChange={(event) =>
                                      setDraftFilterRules((current) =>
                                        current.map((item, i) => (i === index ? { ...item, operator: event.target.value as FilterOperator } : item))
                                      )
                                    }
                                    className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                                  >
                                    {(numeric ? NUMERIC_FILTER_OPTIONS : TEXT_FILTER_OPTIONS).map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    value={rule.value}
                                    onChange={(event) =>
                                      setDraftFilterRules((current) =>
                                        current.map((item, i) => (i === index ? { ...item, value: event.target.value } : item))
                                      )
                                    }
                                    placeholder={numeric ? "e.g. > 0" : "Enter value"}
                                    className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                                  />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button type="button" onClick={() => setIsFilterModalOpen(false)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Cancel</button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterRules(draftFilterRules);
                        setIsFilterModalOpen(false);
                      }}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {isFieldsModalOpen ? (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/35 p-3">
                <div className="flex h-[78vh] w-[96%] max-w-[1100px] flex-col rounded-xl border border-slate-300 bg-white shadow-xl">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-2xl font-semibold text-slate-800">Fields</p>
                    <p className="text-sm text-slate-500">Choose the metrics and dimensions to include in your report.</p>
                  </div>
                  <div className="grid min-h-0 flex-1 grid-cols-[300px,1fr]">
                    <div className="min-h-0 border-r border-slate-200 p-3">
                      <input
                        value={fieldsSearch}
                        onChange={(event) => setFieldsSearch(event.target.value)}
                        placeholder="Search fields..."
                        className="mb-3 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                      />
                      <div className="h-[calc(100%-44px)] overflow-y-auto rounded-md border border-slate-200">
                        {fieldsSearchResults.map((column) => (
                          <button
                            key={column}
                            type="button"
                            onClick={() =>
                              setDraftVisibleColumns((current) => (current.includes(column) ? current : [...current, column]))
                            }
                            className="flex w-full items-center justify-between border-b border-slate-200 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                          >
                            <span>{column}</span>
                            <Plus size={14} className="text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="min-h-0 p-3">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-slate-500">Selected fields</span>
                        <button type="button" onClick={() => setDraftVisibleColumns([])} className="text-slate-500 hover:text-slate-700">Clear selected</button>
                      </div>
                      <div className="h-[calc(100%-28px)] space-y-2 overflow-y-auto">
                        {draftVisibleColumns.map((column) => (
                          <div key={column} className="flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 py-2">
                            <span className="text-sm text-slate-800">{column}</span>
                            <button
                              type="button"
                              onClick={() => setDraftVisibleColumns((current) => current.filter((item) => item !== column))}
                              className="text-slate-500 hover:text-slate-700"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ))}
                        {draftVisibleColumns.length === 0 ? (
                          <div className="flex h-full items-center justify-center text-slate-400">Select fields from the left.</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button type="button" onClick={() => setIsFieldsModalOpen(false)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Cancel</button>
                    <button
                      type="button"
                      onClick={() => {
                        setVisibleColumns(draftVisibleColumns.length > 0 ? draftVisibleColumns : availableColumns.slice(0, 7));
                        setIsFieldsModalOpen(false);
                      }}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
