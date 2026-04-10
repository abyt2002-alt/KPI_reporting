import { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Trash2, TrendingUp, BarChart3, X, Calendar, Check } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ScatterChart, Scatter } from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import type { ChartConfig } from "../store/useStore";
import { useStore } from "../store/useStore";
import { ChartRenderer } from "../charts/ChartRenderer";
import { ClusteringSection } from "../components/ClusteringSection";
// Hidden for client version - no reports
// import { SaveButton } from "../components/SaveToReportModal";

// Multi-target correlation table with save functionality
function MultiTargetTable({
  target,
  data,
  showOnlyPositive,
  onRemove,
  onRowClick,
  mode,
  rollingWindow,
}: {
  target: string;
  data: { col: string; r0: number; rBest: number; bestLag: number }[];
  showOnlyPositive: boolean;
  onRemove: () => void;
  onRowClick: (item: { col: string; r0: number; rBest: number; bestLag: number }) => void;
  mode: "lag" | "rolling";
  rollingWindow?: number;
}) {
  const tableRef = useRef<HTMLDivElement>(null);
  
  return (
    <div ref={tableRef} className="border border-[#E5E5E5] rounded-xl overflow-hidden shadow-sm">
      <div className="bg-[#FFBD59] px-4 py-3 flex items-center justify-between">
        <div>
          <h4 className="text-[16px] font-bold text-[#333333]">{target}</h4>
          {mode === "rolling" && (
            <p className="text-[11px] text-[#333333]/70">Rolling sum of {rollingWindow} periods</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* SaveButton removed - no reports in client version */}
          <button onClick={onRemove} className="text-[#333333]/60 hover:text-[#333333] text-[20px] leading-none">×</button>
        </div>
      </div>
      <div className="max-h-[400px] overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-[#F5F5F5] sticky top-0">
            <tr>
              <th className="text-left px-4 py-3 text-[#555555] font-semibold">Column</th>
              <th className="text-right px-3 py-3 text-[#555555] font-semibold">r(0)</th>
              <th className="text-right px-3 py-3 text-[#555555] font-semibold">
                {mode === "rolling" ? `r(Σ${rollingWindow})` : "Best r"}
              </th>
              <th className="text-right px-4 py-3 text-[#555555] font-semibold">
                {mode === "rolling" ? "Window" : "Lag"}
              </th>
            </tr>
          </thead>
          <tbody>
            {data
              ?.filter(item => !showOnlyPositive || item.rBest > 0)
              .filter(item => item.col.toLowerCase() !== 'week')
              .map((item, idx) => (
              <tr 
                key={item.col}
                onClick={() => onRowClick(item)}
                className={`cursor-pointer hover:bg-[#FFF8ED] transition border-b border-[#F0F0F0] ${idx === 0 ? "bg-[#FFF2DF]" : ""}`}
              >
                <td className="px-4 py-2.5 text-[#333333]" title={item.col}>
                  {idx === 0 && <span className="text-[#FFBD59] mr-1.5">★</span>}
                  <span className="truncate inline-block max-w-[150px] align-middle">{item.col}</span>
                </td>
                <td className={`px-3 py-2.5 text-right font-mono text-[14px] ${
                  Math.abs(item.r0) > 0.7 
                    ? item.r0 > 0 ? "text-[#2D8A4E]" : "text-[#DC2626]"
                    : Math.abs(item.r0) > 0.4 ? "text-[#B8860B]" : "text-[#999999]"
                }`}>
                  {item.r0.toFixed(2)}
                </td>
                <td className={`px-3 py-2.5 text-right font-mono text-[14px] font-bold ${
                  Math.abs(item.rBest) > 0.7 
                    ? item.rBest > 0 ? "text-[#2D8A4E]" : "text-[#DC2626]"
                    : Math.abs(item.rBest) > 0.4 ? "text-[#B8860B]" : "text-[#999999]"
                }`}>
                  {item.rBest.toFixed(2)}
                </td>
                <td className="px-4 py-2.5 text-right text-[#458EE2] font-medium text-[14px]">
                  {mode === "rolling" ? `Σ${item.bestLag}` : (item.bestLag !== 0 ? (item.bestLag > 0 ? `+${item.bestLag}` : item.bestLag) : "0")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Chart Card with inline edit menu
function ChartCard({ chart, onExpand, onDelete, onUpdate, filteredDataset }: { chart: ChartConfig; onExpand: () => void; onDelete: () => void; onUpdate: (updates: Partial<ChartConfig>) => void; filteredDataset?: { rows: Record<string, unknown>[]; columns: { name: string; type: string }[] } | null }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [showEditMenu, setShowEditMenu] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-[16px] font-semibold text-[#333333]">{chart.title}</h4>
          <p className="text-[12px] text-[#999999]">{chart.type} • {chart.dualAxis ? "Dual axis" : chart.yColumns.join(", ")}</p>
        </div>
        <div className="flex gap-1">
          {/* Edit Menu Button */}
          <div className="relative">
            <button 
              onClick={() => setShowEditMenu(!showEditMenu)} 
              className="p-2 text-[#458EE2] hover:bg-[#E8F4FF] rounded-lg transition" 
              title="Edit Chart"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            
            {/* Inline Edit Dropdown */}
            {showEditMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowEditMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-[#E5E5E5] rounded-lg shadow-lg p-3 w-64">
                  <h5 className="text-[13px] font-semibold text-[#333333] mb-3">Quick Edit</h5>
                  
                  {/* Chart Type */}
                  <div className="mb-3">
                    <label className="block text-[11px] text-[#666666] mb-1">Chart Type</label>
                    <div className="flex gap-1">
                      {(["bar", "line", "pie"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => onUpdate({ type })}
                          className={`flex-1 px-2 py-1 rounded text-[11px] font-medium transition ${
                            chart.type === type ? "bg-[#FFBD59] text-[#333333]" : "bg-[#F5F5F5] text-[#666666] hover:bg-[#E5E5E5]"
                          }`}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Legend Toggle */}
                  <div className="mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={chart.showLegend !== false} 
                        onChange={(e) => onUpdate({ showLegend: e.target.checked })}
                        className="w-3 h-3"
                      />
                      <span className="text-[12px] text-[#666666]">Show Legend</span>
                    </label>
                  </div>

                  {/* Normalize Toggle (only for multi-column non-pie charts) */}
                  {chart.type !== "pie" && chart.yColumns.length > 1 && !chart.dualAxis && (
                    <div className="mb-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={chart.normalize || false} 
                          onChange={(e) => onUpdate({ normalize: e.target.checked })}
                          className="w-3 h-3"
                        />
                        <span className="text-[12px] text-[#666666]">Normalize Values</span>
                      </label>
                    </div>
                  )}

                  {/* Title Edit */}
                  <div>
                    <label className="block text-[11px] text-[#666666] mb-1">Title</label>
                    <input
                      type="text"
                      value={chart.title}
                      onChange={(e) => onUpdate({ title: e.target.value })}
                      className="w-full border border-[#E5E5E5] rounded px-2 py-1 text-[12px] focus:ring-1 focus:ring-[#FFBD59] outline-none"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          
          <button onClick={onDelete} className="p-2 text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition" title="Delete">
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div ref={chartRef} onClick={onExpand} className="cursor-pointer hover:opacity-90 transition">
        <ChartRenderer config={chart} data={filteredDataset?.rows} />
      </div>
    </div>
  );
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return den === 0 ? 0 : num / den;
}

export function ChartStudio() {
  const { 
    dataset, charts, addChart, removeChart, updateChart,
    // Chart form state from global store (persisted)
    chartForm, updateChartForm, resetChartFormTitle,
    // Correlation state from global store
    correlationSection, setCorrelationSection,
    correlationCol1, setCorrelationCol1,
    correlationCol2, setCorrelationCol2,
    correlationTimeCol, setCorrelationTimeCol,
    correlationLag, setCorrelationLag,
    selectedCorrelation, setSelectedCorrelation
  } = useStore();
  
  // Local UI state only
  const [yDropdownOpen, setYDropdownOpen] = useState(false);
  const [expandedChart, setExpandedChart] = useState<ChartConfig | null>(null);
  const [targetVariables, setTargetVariables] = useState<string[]>([]);
  
  // Chart filter state - support multiple column filters
  const [chartFilters, setChartFilters] = useState<Array<{ column: string; values: string[] }>>([]);
  const [chartFilterCatCol, setChartFilterCatCol] = useState<string>("");
  const [chartFilterCatValues, setChartFilterCatValues] = useState<string[]>([]);
  const [chartFilterDropdownOpen, setChartFilterDropdownOpen] = useState(false);
  const [chartFilterSearchTerm, setChartFilterSearchTerm] = useState("");
  const [chartFilterSectionExpanded, setChartFilterSectionExpanded] = useState(false); // Start collapsed for cleaner UI
  
  // Refs for saving correlation charts
  const lagAnalysisRef = useRef<HTMLDivElement>(null);
  const trendChartRef = useRef<HTMLDivElement>(null);
  const scatterChartRef = useRef<HTMLDivElement>(null);
  const chartFilterRef = useRef<HTMLDivElement>(null);
  const corrFilterRef = useRef<HTMLDivElement>(null);
  const [multiTargetModal, setMultiTargetModal] = useState<{ target: string; col: string; r: number; bestLag: number } | null>(null);
  const [targetDropdownOpen, setTargetDropdownOpen] = useState(false);
  const [corrFilterCol, setCorrFilterCol] = useState<string>("");
  const [showOnlyPositive, setShowOnlyPositive] = useState(false);
  const [lagMin, setLagMin] = useState(0);
  const [lagMax, setLagMax] = useState(15);
  // Rolling Sum mode for multi-target analysis
  const [correlationMode, setCorrelationMode] = useState<"lag" | "rolling">("lag");
  const [rollingWindow, setRollingWindow] = useState(4);
  // Data filters for correlation - support multiple column filters
  const [corrFilters, setCorrFilters] = useState<Array<{ column: string; values: string[] }>>([]);
  const [filterTimeCol, setFilterTimeCol] = useState<string>("");
  const [filterTimeFrom, setFilterTimeFrom] = useState<Date | null>(null);
  const [filterTimeTo, setFilterTimeTo] = useState<Date | null>(null);
  const [filterCatCol, setFilterCatCol] = useState<string>("");
  const [filterCatValues, setFilterCatValues] = useState<string[]>([]);
  const [corrFilterDropdownOpen, setCorrFilterDropdownOpen] = useState(false);
  const [corrFilterSearchTerm, setCorrFilterSearchTerm] = useState("");
  const [corrFilterValueSearchTerm, setCorrFilterValueSearchTerm] = useState("");
  const [filterSectionExpanded, setFilterSectionExpanded] = useState(true); // Open by default for easy access
  // Applied filters (only update when Apply button is clicked)
  const [appliedTimeCol, setAppliedTimeCol] = useState<string>("");
  const [appliedTimeFrom, setAppliedTimeFrom] = useState<Date | null>(null);
  const [appliedTimeTo, setAppliedTimeTo] = useState<Date | null>(null);
  const [appliedCorrFilters, setAppliedCorrFilters] = useState<Array<{ column: string; values: string[] }>>([]);
  
  // Destructure chart form for easier access
  const { chartType, title, xCol, yCols, showLegend, dualAxis, normalize, leftCols, rightCols, leftMin, leftMax, rightMin, rightMax } = chartForm;
  

  
  // Aliases for cleaner code
  const activeSection = correlationSection;
  const setActiveSection = setCorrelationSection;
  const selectedCorr = selectedCorrelation;
  const setSelectedCorr = setSelectedCorrelation;
  const timeColumn = correlationTimeCol;
  const setTimeColumn = setCorrelationTimeCol;
  const manualCol1 = correlationCol1;
  const setManualCol1 = setCorrelationCol1;
  const manualCol2 = correlationCol2;
  const setManualCol2 = setCorrelationCol2;
  const lag = correlationLag;
  const setLag = setCorrelationLag;

  // Calculate correlation with lag (accepts rows to support filtering)
  const calculateLaggedCorrelation = (col1: string, col2: string, lagValue: number, rows?: Record<string, unknown>[]) => {
    const dataRows = rows || dataset?.rows;
    if (!dataRows || dataRows.length === 0) return 0;
    const x = dataRows.map((r) => Number(r[col1]) || 0);
    const y = dataRows.map((r) => Number(r[col2]) || 0);
    
    if (lagValue === 0) return calculateCorrelation(x, y);
    
    if (lagValue > 0) {
      // col2 leads col1 (shift col2 back)
      const xTrimmed = x.slice(lagValue);
      const yTrimmed = y.slice(0, y.length - lagValue);
      return calculateCorrelation(xTrimmed, yTrimmed);
    } else {
      // col1 leads col2 (shift col1 back)
      const absLag = Math.abs(lagValue);
      const xTrimmed = x.slice(0, x.length - absLag);
      const yTrimmed = y.slice(absLag);
      return calculateCorrelation(xTrimmed, yTrimmed);
    }
  };

  // Find best lag correlation between two columns
  const findBestLagCorrelation = (col1: string, col2: string, minLag: number = lagMin, maxLag: number = lagMax, rows?: Record<string, unknown>[]) => {
    let bestR = 0;
    let bestLag = 0;
    for (let l = minLag; l <= maxLag; l++) {
      const r = calculateLaggedCorrelation(col1, col2, l, rows);
      if (Math.abs(r) > Math.abs(bestR)) {
        bestR = r;
        bestLag = l;
      }
    }
    return { r: bestR, lag: bestLag };
  };

  // Calculate rolling sum correlation
  // X[i] correlates with sum of Y[i] to Y[i+window-1]
  const calculateRollingSumCorrelation = (xCol: string, yCol: string, window: number, rows?: Record<string, unknown>[]) => {
    const dataRows = rows || dataset?.rows;
    if (!dataRows || dataRows.length === 0 || window < 1) return 0;
    
    const x = dataRows.map((r) => Number(r[xCol]) || 0);
    const y = dataRows.map((r) => Number(r[yCol]) || 0);
    
    // Need at least window rows to calculate
    if (x.length < window) return 0;
    
    // Create rolling sum of Y (forward-looking)
    const xTrimmed: number[] = [];
    const yRollingSum: number[] = [];
    
    for (let i = 0; i <= x.length - window; i++) {
      xTrimmed.push(x[i]);
      let sum = 0;
      for (let j = 0; j < window; j++) {
        sum += y[i + j];
      }
      yRollingSum.push(sum);
    }
    
    return calculateCorrelation(xTrimmed, yRollingSum);
  };

  // Click outside detection to auto-collapse filter sections
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check chart filter section
      if (chartFilterRef.current && !chartFilterRef.current.contains(event.target as Node) && chartFilterSectionExpanded) {
        setChartFilterSectionExpanded(false);
      }
      // Check correlation filter section
      if (corrFilterRef.current && !corrFilterRef.current.contains(event.target as Node) && filterSectionExpanded) {
        setFilterSectionExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [chartFilterSectionExpanded, filterSectionExpanded]);

  const numericCols = dataset?.columns.filter((c) => c.type === "numeric") || [];
  const allCols = dataset?.columns || [];
  const categoricalCols = dataset?.columns.filter((c) => c.type === "categorical") || [];

  // Filtered dataset for chart creation - support multiple column filters
  const chartFilteredDataset = useMemo(() => {
    if (!dataset) return null;
    if (chartFilters.length === 0) return dataset;
    
    const filteredRows = dataset.rows.filter(row => {
      // Row must match ALL filter conditions (AND logic)
      return chartFilters.every(filter => 
        filter.values.includes(String(row[filter.column]))
      );
    });
    
    return {
      ...dataset,
      rows: filteredRows
    };
  }, [dataset, chartFilters]);

  // Get category filter values for charts
  const chartCatFilterValues = useMemo(() => {
    if (!dataset || !chartFilterCatCol) return [];
    const values = new Set(dataset.rows.map(r => String(r[chartFilterCatCol] ?? "")));
    return Array.from(values).sort();
  }, [dataset, chartFilterCatCol]);
  
  // Filtered chart values based on search
  const filteredChartCatValues = useMemo(() => {
    if (!chartFilterSearchTerm) return chartCatFilterValues;
    return chartCatFilterValues.filter(v => 
      v.toLowerCase().includes(chartFilterSearchTerm.toLowerCase())
    );
  }, [chartCatFilterValues, chartFilterSearchTerm]);

  // Parse date from various formats
  const parseDate = (value: unknown): Date | null => {
    if (!value) return null;
    const str = String(value).trim();
    
    // Try specific date formats FIRST (before generic Date parsing)
    // DD-MM-YYYY (e.g., 01-01-2025)
    let match = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
      const year = parseInt(match[3], 10);
      return new Date(year, month, day);
    }
    
    // YYYY-MM-DD (e.g., 2025-01-01)
    match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return new Date(year, month, day);
    }
    
    // MM/DD/YYYY (e.g., 01/01/2025)
    match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const month = parseInt(match[1], 10) - 1;
      const day = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      return new Date(year, month, day);
    }
    
    // DD/MM/YYYY (e.g., 01/01/2025) - try this too
    match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      return new Date(year, month, day);
    }
    
    // Try standard Date parsing as fallback (but NOT for plain numbers)
    // Only try if it looks like a date string (contains - or / or letters)
    if (str.includes('-') || str.includes('/') || /[a-zA-Z]/.test(str)) {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2100) {
        return parsed;
      }
    }
    
    // DO NOT treat plain numbers as dates - they could be week numbers, IDs, etc.
    return null;
  };

  // Get date range for time column
  const timeDateRange = useMemo(() => {
    if (!dataset || !filterTimeCol) return { min: null, max: null, dates: [] as Date[] };
    const dates: Date[] = [];
    dataset.rows.forEach(r => {
      const d = parseDate(r[filterTimeCol]);
      if (d) dates.push(d);
    });
    if (dates.length === 0) return { min: null, max: null, dates: [] };
    dates.sort((a, b) => a.getTime() - b.getTime());
    return { min: dates[0], max: dates[dates.length - 1], dates };
  }, [dataset, filterTimeCol]);

  const catFilterValues = useMemo(() => {
    if (!dataset || !filterCatCol) return [];
    const values = new Set(dataset.rows.map(r => String(r[filterCatCol] ?? "")));
    return Array.from(values).sort();
  }, [dataset, filterCatCol]);
  
  // Filtered correlation category values based on search
  const filteredCorrCatValues = useMemo(() => {
    if (!corrFilterValueSearchTerm) return catFilterValues;
    return catFilterValues.filter(v => 
      v.toLowerCase().includes(corrFilterValueSearchTerm.toLowerCase())
    );
  }, [catFilterValues, corrFilterValueSearchTerm]);

  // Helper to get date as YYYYMMDD number for easy comparison
  const dateToNum = (d: Date): number => {
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  };

  // Filtered dataset for correlation analysis (uses APPLIED filters)
  const filteredRows = useMemo(() => {
    if (!dataset) return [];
    let rows = dataset.rows;
    // Time range filter using applied dates
    if (appliedTimeCol && (appliedTimeFrom || appliedTimeTo)) {
      const fromNum = appliedTimeFrom ? dateToNum(appliedTimeFrom) : 0;
      const toNum = appliedTimeTo ? dateToNum(appliedTimeTo) : 99999999;
      
      rows = rows.filter(r => {
        const rowDate = parseDate(r[appliedTimeCol]);
        if (!rowDate) return false; // Exclude rows without valid dates when filtering
        const rowNum = dateToNum(rowDate);
        return rowNum >= fromNum && rowNum <= toNum;
      });
    }
    // Category filters - support multiple columns (AND logic)
    if (appliedCorrFilters.length > 0) {
      rows = rows.filter(r => {
        return appliedCorrFilters.every(filter =>
          filter.values.includes(String(r[filter.column]))
        );
      });
    }
    return rows;
  }, [dataset, appliedTimeCol, appliedTimeFrom, appliedTimeTo, appliedCorrFilters]);

  // Lag analysis - compute correlations at different lags (-5 to +5) using filtered data
  const lagAnalysis = useMemo(() => {
    if (!selectedCorr || !dataset) return null;
    const maxLag = 5;
    const results: { lag: number; r: number }[] = [];
    // Use filteredRows if filters are applied
    const dataToUse = (appliedTimeCol || appliedCorrFilters.length > 0) ? filteredRows : dataset.rows;
    for (let l = -maxLag; l <= maxLag; l++) {
      results.push({ lag: l, r: calculateLaggedCorrelation(selectedCorr.col1, selectedCorr.col2, l, dataToUse) });
    }
    return results;
  }, [selectedCorr, dataset, filteredRows, appliedTimeCol, appliedCorrFilters]);

  // Multi-target correlation analysis (uses filtered data)
  // Supports both Lag mode and Rolling Sum mode
  const multiTargetAnalysis = useMemo(() => {
    if (!dataset || targetVariables.length === 0 || filteredRows.length === 0) return null;
    const results: Record<string, { col: string; r0: number; rBest: number; bestLag: number }[]> = {};
    
    targetVariables.forEach(target => {
      const correlations: { col: string; r0: number; rBest: number; bestLag: number }[] = [];
      numericCols.forEach(c => {
        if (c.name !== target) {
          if (correlationMode === "rolling") {
            // Rolling Sum mode: X correlates with rolling sum of Y (target)
            const r0 = calculateLaggedCorrelation(target, c.name, 0, filteredRows);
            const rRolling = calculateRollingSumCorrelation(c.name, target, rollingWindow, filteredRows);
            correlations.push({ col: c.name, r0, rBest: rRolling, bestLag: rollingWindow });
          } else {
            // Lag mode: find best lag correlation
            const r0 = calculateLaggedCorrelation(target, c.name, 0, filteredRows);
            const { r: rBest, lag: bestLag } = findBestLagCorrelation(target, c.name, lagMin, lagMax, filteredRows);
            correlations.push({ col: c.name, r0, rBest, bestLag });
          }
        }
      });
      // Sort by best correlation strength
      correlations.sort((a, b) => Math.abs(b.rBest) - Math.abs(a.rBest));
      results[target] = correlations;
    });
    
    return results;
  }, [dataset, targetVariables, numericCols, lagMin, lagMax, filteredRows, correlationMode, rollingWindow]);

  // Lag analysis for multi-target modal
  // Lag analysis for multi-target modal (uses filtered data)
  const multiTargetLagAnalysis = useMemo(() => {
    if (!multiTargetModal || !dataset || filteredRows.length === 0) return null;
    const { target, col } = multiTargetModal;
    const results: { lag: number; r: number }[] = [];
    for (let l = lagMin; l <= lagMax; l++) {
      results.push({ lag: l, r: calculateLaggedCorrelation(target, col, l, filteredRows) });
    }
    return results;
  }, [multiTargetModal, dataset, lagMin, lagMax, filteredRows]);

  // Trend data for multi-target modal (uses filtered data)
  const multiTargetTrendData = useMemo(() => {
    if (!multiTargetModal || !dataset || filteredRows.length === 0) return null;
    const { target, col, bestLag } = multiTargetModal;
    const rows = filteredRows;
    const colLagged = bestLag !== 0 ? `${col} (lag ${bestLag})` : col;
    
    if (bestLag === 0) {
      return rows.map((row, i) => ({
        index: timeColumn ? row[timeColumn] : i,
        [target]: Number(row[target]) || 0,
        [col]: Number(row[col]) || 0,
      }));
    }
    
    const result = [];
    if (bestLag > 0) {
      for (let i = bestLag; i < rows.length; i++) {
        result.push({
          index: timeColumn ? rows[i][timeColumn] : i,
          [target]: Number(rows[i][target]) || 0,
          [colLagged]: Number(rows[i - bestLag][col]) || 0,
        });
      }
    } else {
      const absLag = Math.abs(bestLag);
      for (let i = absLag; i < rows.length; i++) {
        result.push({
          index: timeColumn ? rows[i][timeColumn] : i,
          [target]: Number(rows[i - absLag][target]) || 0,
          [colLagged]: Number(rows[i][col]) || 0,
        });
      }
    }
    return result;
  }, [multiTargetModal, dataset, timeColumn, filteredRows]);

  // Correlation matrix (uses filtered data)
  const correlationMatrix = useMemo(() => {
    if (!dataset || numericCols.length < 2 || filteredRows.length === 0) return null;
    const matrix: { col1: string; col2: string; r: number }[] = [];
    for (let i = 0; i < numericCols.length; i++) {
      for (let j = i + 1; j < numericCols.length; j++) {
        const col1 = numericCols[i].name;
        const col2 = numericCols[j].name;
        const x = filteredRows.map((r) => Number(r[col1]) || 0);
        const y = filteredRows.map((r) => Number(r[col2]) || 0);
        matrix.push({ col1, col2, r: calculateCorrelation(x, y) });
      }
    }
    return matrix.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  }, [dataset, numericCols, filteredRows]);

  const toggleYCol = (col: string) => {
    if (chartType === "pie") {
      updateChartForm({ yCols: [col] });
    } else {
      updateChartForm({ yCols: yCols.includes(col) ? yCols.filter((c) => c !== col) : [...yCols, col] });
    }
  };

  // Auto-generate title based on selections
  const autoTitle = useMemo(() => {
    const yColsToUse = dualAxis ? [...leftCols, ...rightCols] : yCols;
    if (yColsToUse.length === 0 || !xCol) return "";
    const yPart = yColsToUse.length > 2 ? `${yColsToUse.slice(0, 2).join(", ")}...` : yColsToUse.join(" & ");
    return `${yPart} by ${xCol}`;
  }, [xCol, yCols, dualAxis, leftCols, rightCols]);

  const createChart = () => {
    if (!xCol) return;
    if (dualAxis && leftCols.length === 0 && rightCols.length === 0) return;
    if (!dualAxis && yCols.length === 0) return;
    
    const finalTitle = title || autoTitle;
    if (!finalTitle) return;
    
    const config: ChartConfig = {
      id: crypto.randomUUID(),
      type: chartType,
      title: finalTitle,
      xColumn: xCol,
      yColumns: dualAxis ? [...leftCols, ...rightCols] : yCols,
      showLegend,
      dualAxis,
      normalize: normalize && !dualAxis,
      leftAxisColumns: dualAxis ? leftCols : undefined,
      rightAxisColumns: dualAxis ? rightCols : undefined,
      leftAxisMin: leftMin ? Number(leftMin) : undefined,
      leftAxisMax: leftMax ? Number(leftMax) : undefined,
      rightAxisMin: rightMin ? Number(rightMin) : undefined,
      rightAxisMax: rightMax ? Number(rightMax) : undefined,
    };
    addChart(config);
    resetChartFormTitle();
  };



  const getCorrColor = (r: number) => {
    const abs = Math.abs(r);
    if (abs > 0.7) return r > 0 ? "bg-[#D4EDDA] text-[#2D8A4E] border-[#41C185]" : "bg-[#FEE2E2] text-[#DC2626] border-[#EF4444]";
    if (abs > 0.4) return "bg-[#FFF2DF] text-[#B8860B] border-[#FFBD59]";
    return "bg-[#F5F5F5] text-[#666666] border-[#E5E5E5]";
  };

  // Trend data with lag applied (uses filtered data)
  // Positive lag: col2 leads (shift col2 back) → label col2 as shifted
  // Negative lag: col1 leads (shift col1 back) → label col1 as shifted
  const trendData = useMemo(() => {
    if (!selectedCorr || !dataset || filteredRows.length === 0) return null;
    const rows = filteredRows;
    const lagValue = selectedCorr.lag || 0;
    const col1Name = selectedCorr.col1;
    const col2Name = selectedCorr.col2;
    
    if (lagValue === 0) {
      return rows.map((row, i) => ({
        index: timeColumn ? row[timeColumn] : i,
        [col1Name]: Number(row[col1Name]) || 0,
        [col2Name]: Number(row[col2Name]) || 0,
      }));
    }
    
    const result = [];
    if (lagValue > 0) {
      // Positive lag: col2 leads col1 → shift col2 back
      const col2Lagged = `${col2Name} (shifted -${lagValue})`;
      for (let i = lagValue; i < rows.length; i++) {
        result.push({
          index: timeColumn ? rows[i][timeColumn] : i,
          [col1Name]: Number(rows[i][col1Name]) || 0,
          [col2Lagged]: Number(rows[i - lagValue][col2Name]) || 0,
        });
      }
    } else {
      // Negative lag: col1 leads col2 → shift col1 back
      const absLag = Math.abs(lagValue);
      const col1Lagged = `${col1Name} (shifted -${absLag})`;
      for (let i = absLag; i < rows.length; i++) {
        result.push({
          index: timeColumn ? rows[i][timeColumn] : i,
          [col1Lagged]: Number(rows[i - absLag][col1Name]) || 0,
          [col2Name]: Number(rows[i][col2Name]) || 0,
        });
      }
    }
    return result;
  }, [selectedCorr, dataset, timeColumn, filteredRows]);

  // Scatter data with lag applied (uses filtered data)
  const scatterData = useMemo(() => {
    if (!selectedCorr || !dataset || filteredRows.length === 0) return null;
    const rows = filteredRows;
    const lagValue = selectedCorr.lag || 0;
    
    if (lagValue === 0) {
      return rows.map((row) => ({
        x: Number(row[selectedCorr.col1]) || 0,
        y: Number(row[selectedCorr.col2]) || 0,
      }));
    }
    
    const result = [];
    if (lagValue > 0) {
      for (let i = lagValue; i < rows.length; i++) {
        result.push({
          x: Number(rows[i][selectedCorr.col1]) || 0,
          y: Number(rows[i - lagValue][selectedCorr.col2]) || 0,
        });
      }
    } else {
      const absLag = Math.abs(lagValue);
      for (let i = absLag; i < rows.length; i++) {
        result.push({
          x: Number(rows[i - absLag][selectedCorr.col1]) || 0,
          y: Number(rows[i][selectedCorr.col2]) || 0,
        });
      }
    }
    return result;
  }, [selectedCorr, dataset, filteredRows]);

  if (!dataset) {
    return (
      <div className="p-8 text-center text-[#999999]">
        <p className="text-[18px]">Please upload a CSV file first</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-[32px] font-bold text-[#333333] mb-6">Chart Studio</h2>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveSection("correlation")}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition ${
            activeSection === "correlation"
              ? "bg-[#FFBD59] text-[#333333]"
              : "bg-white border border-[#E5E5E5] text-[#666666] hover:bg-[#F5F5F5]"
          }`}
        >
          <TrendingUp size={18} /> Correlation Analysis
        </button>
        <button
          onClick={() => setActiveSection("clustering")}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition ${
            activeSection === "clustering"
              ? "bg-[#FFBD59] text-[#333333]"
              : "bg-white border border-[#E5E5E5] text-[#666666] hover:bg-[#F5F5F5]"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>
          </svg>
          Clustering
        </button>
        <button
          onClick={() => setActiveSection("charts")}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition ${
            activeSection === "charts"
              ? "bg-[#FFBD59] text-[#333333]"
              : "bg-white border border-[#E5E5E5] text-[#666666] hover:bg-[#F5F5F5]"
          }`}
        >
          <BarChart3 size={18} /> Create Charts
        </button>
        {/* Hidden for client version */}
        {/* <button
          onClick={() => setActiveSection("timeseries")}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition ${
            activeSection === "timeseries"
              ? "bg-[#FFBD59] text-[#333333]"
              : "bg-white border border-[#E5E5E5] text-[#666666] hover:bg-[#F5F5F5]"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
          </svg>
          Time Series
        </button> */}
      </div>

      {/* CHARTS SECTION */}
      {activeSection === "charts" && (
        <>
          {/* Data Filter for Charts */}
          <div ref={chartFilterRef} className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setChartFilterSectionExpanded(!chartFilterSectionExpanded)}
                className="p-1 hover:bg-[#F5F5F5] rounded transition"
                title={chartFilterSectionExpanded ? "Collapse filters" : "Expand filters"}
              >
                <svg 
                  className={`w-4 h-4 text-[#666666] transition-transform ${chartFilterSectionExpanded ? "rotate-90" : ""}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              <span className="text-[14px] font-semibold text-[#333333]">Filter Data for Charts</span>
              {chartFilters.length > 0 && (
                <span className="ml-auto text-[12px] bg-[#E8F8F0] text-[#41C185] px-3 py-1 rounded-full font-medium">
                  {chartFilteredDataset?.rows.length || 0} of {dataset?.rows.length || 0} rows
                </span>
              )}
              {!chartFilterSectionExpanded && (
                <span className="text-[11px] text-[#999999]">Click to expand</span>
              )}
            </div>
            
            {chartFilterSectionExpanded && (
            <>
            {/* Add Filter Section */}
            <div className="flex flex-wrap gap-3 items-end mb-3">
              {/* Column Selector */}
              <div>
                <label className="block text-[11px] text-[#666666] font-medium mb-1">Column:</label>
                <div className="relative">
                  <button
                    onClick={() => setChartFilterDropdownOpen(!chartFilterDropdownOpen)}
                    className="border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-[12px] bg-white min-w-[130px] flex items-center justify-between hover:border-[#FFBD59] transition"
                  >
                    <span className={chartFilterCatCol ? "text-[#333333]" : "text-[#999999]"}>
                      {chartFilterCatCol || "Select..."}
                    </span>
                    <svg className={`w-3 h-3 ml-2 transition-transform ${chartFilterDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {chartFilterDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setChartFilterDropdownOpen(false)} />
                      <div className="absolute z-20 mt-1 w-64 bg-white border border-[#E5E5E5] rounded-lg shadow-lg max-h-80 overflow-auto">
                        <div className="sticky top-0 bg-white p-2 border-b border-[#E5E5E5]">
                          <input
                            type="text"
                            placeholder="Search columns..."
                            value={chartFilterSearchTerm}
                            onChange={(e) => setChartFilterSearchTerm(e.target.value)}
                            className="w-full border border-[#E5E5E5] rounded px-2 py-1 text-[11px] focus:ring-1 focus:ring-[#FFBD59] outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        {(categoricalCols.length > 0 ? categoricalCols : allCols)
                          .filter(c => !chartFilterSearchTerm || c.name.toLowerCase().includes(chartFilterSearchTerm.toLowerCase()))
                          .filter(c => !chartFilters.some(f => f.column === c.name))
                          .map((c) => (
                            <button
                              key={c.name}
                              onClick={() => {
                                setChartFilterCatCol(c.name);
                                setChartFilterCatValues([]);
                                setChartFilterDropdownOpen(false);
                                setChartFilterSearchTerm("");
                              }}
                              className={`w-full px-3 py-1.5 text-left hover:bg-[#FFF8ED] text-[12px] ${
                                chartFilterCatCol === c.name ? "bg-[#FFF2DF] text-[#333333] font-medium" : "text-[#666666]"
                              }`}
                            >
                              {c.name}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Value Selector - Checkboxes */}
              {chartFilterCatCol && (
                <>
                <div className="flex-1 min-w-[250px] max-w-[400px]">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-[#666666] font-medium">Values:</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setChartFilterCatValues(chartCatFilterValues)}
                        className="text-[10px] text-[#458EE2] hover:underline"
                      >
                        Select all
                      </button>
                      <button
                        onClick={() => setChartFilterCatValues([])}
                        className="text-[10px] text-[#999999] hover:text-[#666666]"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="border border-[#E5E5E5] rounded-lg p-2 bg-[#FAFAFA] max-h-24 overflow-y-auto">
                    <div className="mb-1.5 pb-1.5 border-b border-[#E5E5E5]">
                      <input
                        type="text"
                        placeholder="Search..."
                        value={chartFilterSearchTerm}
                        onChange={(e) => setChartFilterSearchTerm(e.target.value)}
                        className="w-full border border-[#E5E5E5] rounded px-2 py-1 text-[11px] focus:ring-1 focus:ring-[#FFBD59] outline-none bg-white"
                      />
                    </div>
                    <div className="space-y-0.5">
                      {filteredChartCatValues.map((v) => (
                        <label key={v} className="flex items-center gap-1.5 py-0.5 px-1.5 hover:bg-white rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={chartFilterCatValues.includes(v)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setChartFilterCatValues([...chartFilterCatValues, v]);
                              } else {
                                setChartFilterCatValues(chartFilterCatValues.filter(val => val !== v));
                              }
                            }}
                            className="w-3 h-3 text-[#41C185] rounded border-[#E5E5E5] focus:ring-[#41C185]"
                          />
                          <span className="text-[12px] text-[#333333]">{v}</span>
                        </label>
                      ))}
                    </div>
                    {filteredChartCatValues.length === 0 && (
                      <p className="text-[11px] text-[#999999] text-center py-1">No values</p>
                    )}
                  </div>
                </div>
                
                {/* Add Filter Button */}
                <button
                  onClick={() => {
                    if (chartFilterCatCol && chartFilterCatValues.length > 0) {
                      setChartFilters([...chartFilters, { column: chartFilterCatCol, values: chartFilterCatValues }]);
                      setChartFilterCatCol("");
                      setChartFilterCatValues([]);
                    }
                  }}
                  disabled={!chartFilterCatCol || chartFilterCatValues.length === 0}
                  className="px-3 py-1.5 bg-[#FFBD59] text-[#333333] rounded-lg text-[12px] font-semibold hover:bg-[#FFCF87] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  + Add
                </button>
                </>
              )}
            </div>

            {/* Active Filters Display */}
            {chartFilters.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[#F0F0F0]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] text-[#666666] font-medium">Active:</span>
                  <button
                    onClick={() => setChartFilters([])}
                    className="text-[10px] text-[#EF4444] hover:text-[#DC2626] ml-auto"
                  >
                    Clear all
                  </button>
                </div>
                <div className="space-y-1.5">
                  {chartFilters.map((filter, idx) => (
                    <div key={idx} className="flex flex-wrap gap-1 items-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#458EE2] text-white rounded text-[10px] font-medium">
                        {filter.column}
                        <button 
                          onClick={() => setChartFilters(chartFilters.filter((_, i) => i !== idx))}
                          className="hover:text-[#FFE5E5] ml-0.5"
                        >×</button>
                      </span>
                      {filter.values.map(val => (
                        <span key={val} className="inline-flex items-center px-1.5 py-0.5 bg-[#E8F8F0] text-[#41C185] rounded text-[10px] font-medium">
                          {val}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
            </>
            )}
          </div>

          {/* Chart creation form */}
          <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-[15px] font-semibold text-[#333333]">New Chart</h3>
              <div className="flex gap-1">
                {(["bar", "line", "pie"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => { 
                      if (type === "pie") { 
                        updateChartForm({ chartType: type, yCols: yCols.slice(0, 1), dualAxis: false, normalize: false }); 
                      } else {
                        updateChartForm({ chartType: type });
                      }
                    }}
                    className={`px-3 py-1 rounded text-[12px] font-medium transition ${
                      chartType === type ? "bg-[#FFBD59] text-[#333333]" : "bg-[#F5F5F5] text-[#666666] hover:bg-[#E5E5E5]"
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-3">
              <select value={xCol} onChange={(e) => updateChartForm({ xCol: e.target.value })} className="border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px] bg-white">
                <option value="">{chartType === "pie" ? "Category..." : "X-Axis..."}</option>
                {allCols.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>

              {chartType === "pie" ? (
                <select value={yCols[0] || ""} onChange={(e) => updateChartForm({ yCols: [e.target.value] })} className="border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px] bg-white">
                  <option value="">Value...</option>
                  {numericCols.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              ) : !dualAxis ? (
                <div className="relative">
                  <button type="button" onClick={() => setYDropdownOpen(!yDropdownOpen)} className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-left bg-white flex items-center justify-between text-[13px]">
                    <span className={`truncate ${yCols.length === 0 ? "text-[#999999]" : "text-[#333333]"}`}>{yCols.length === 0 ? "Y-Axis..." : yCols.join(", ")}</span>
                    <svg className={`w-3 h-3 flex-shrink-0 ml-1 transition-transform ${yDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {yDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setYDropdownOpen(false)} />
                      <div className="absolute z-20 mt-1 w-full bg-white border border-[#E5E5E5] rounded-lg shadow-lg max-h-40 overflow-auto">
                        {numericCols.map((c) => (
                          <button key={c.name} type="button" onClick={() => toggleYCol(c.name)} className="w-full px-3 py-1.5 text-left hover:bg-[#F5F5F5] flex items-center gap-2 text-[13px]">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${yCols.includes(c.name) ? "bg-[#FFBD59] border-[#FFBD59]" : "border-[#E5E5E5]"}`}>
                              {yCols.includes(c.name) && <Check size={10} className="text-white" />}
                            </div>
                            <span className="truncate">{c.name}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : <div />}

              <input 
                value={title} 
                onChange={(e) => updateChartForm({ title: e.target.value })} 
                placeholder={autoTitle || "Chart title..."}
                className="border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#FFBD59] outline-none" 
              />

              <button 
                onClick={createChart} 
                disabled={!xCol || (dualAxis ? (leftCols.length === 0 && rightCols.length === 0) : yCols.length === 0)} 
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#FFBD59] text-[#333333] rounded-lg hover:bg-[#FFCF87] disabled:opacity-50 transition font-semibold text-[13px]"
              >
                <Plus size={16} /> Create
              </button>
            </div>

            {/* Compact options row */}
            {chartType !== "pie" && (
              <div className="flex items-center gap-4 text-[12px] border-t border-[#F0F0F0] pt-3">
                <span className="text-[#999999]">Scale:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="scaleMode" checked={!dualAxis && !normalize} onChange={() => updateChartForm({ dualAxis: false, normalize: false })} className="w-3 h-3" />
                  <span className={!dualAxis && !normalize ? "text-[#333333]" : "text-[#666666]"}>Auto</span>
                </label>
                {yCols.length > 1 && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="scaleMode" checked={normalize && !dualAxis} onChange={() => updateChartForm({ normalize: true, dualAxis: false })} className="w-3 h-3" />
                    <span className={normalize && !dualAxis ? "text-[#333333]" : "text-[#666666]"}>Normalize</span>
                  </label>
                )}
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="scaleMode" checked={dualAxis} onChange={() => updateChartForm({ dualAxis: true, normalize: false })} className="w-3 h-3" />
                  <span className={dualAxis ? "text-[#333333]" : "text-[#666666]"}>Dual Axis</span>
                </label>
                <div className="ml-auto flex items-center gap-1.5">
                  <input type="checkbox" id="legend" checked={showLegend} onChange={(e) => updateChartForm({ showLegend: e.target.checked })} className="w-3 h-3" />
                  <label htmlFor="legend" className="text-[#666666] cursor-pointer">Legend</label>
                </div>
              </div>
            )}

            {dualAxis && chartType !== "pie" && (
              <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-[#F9F9F9] rounded-lg">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[12px] font-medium text-[#41C185]">Left Axis</span>
                    <input type="number" placeholder="Min" value={leftMin} onChange={(e) => updateChartForm({ leftMin: e.target.value })} className="w-14 border rounded px-1.5 py-0.5 text-[11px]" />
                    <input type="number" placeholder="Max" value={leftMax} onChange={(e) => updateChartForm({ leftMax: e.target.value })} className="w-14 border rounded px-1.5 py-0.5 text-[11px]" />
                  </div>
                  <select multiple value={leftCols} onChange={(e) => updateChartForm({ leftCols: Array.from(e.target.selectedOptions, o => o.value) })} className="w-full border rounded px-2 py-1 text-[12px] bg-white h-16">
                    {numericCols.filter(c => !rightCols.includes(c.name)).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[12px] font-medium text-[#458EE2]">Right Axis</span>
                    <input type="number" placeholder="Min" value={rightMin} onChange={(e) => updateChartForm({ rightMin: e.target.value })} className="w-14 border rounded px-1.5 py-0.5 text-[11px]" />
                    <input type="number" placeholder="Max" value={rightMax} onChange={(e) => updateChartForm({ rightMax: e.target.value })} className="w-14 border rounded px-1.5 py-0.5 text-[11px]" />
                  </div>
                  <select multiple value={rightCols} onChange={(e) => updateChartForm({ rightCols: Array.from(e.target.selectedOptions, o => o.value) })} className="w-full border rounded px-2 py-1 text-[12px] bg-white h-16">
                    {numericCols.filter(c => !leftCols.includes(c.name)).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Show existing charts below the form */}
          {charts.length > 0 && (
            <div className="mb-6">
              <h3 className="text-[18px] font-semibold text-[#333333] mb-4">Your Charts ({charts.length})</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[...charts].reverse().map((chart) => (
                  <ChartCard 
                    key={chart.id} 
                    chart={chart} 
                    onExpand={() => setExpandedChart(chart)} 
                    onDelete={() => removeChart(chart.id)}
                    onUpdate={(updates) => updateChart(chart.id, updates)}
                    filteredDataset={chartFilteredDataset}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Fullscreen Chart Modal */}
          {expandedChart && (
            <div 
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" 
              onClick={() => setExpandedChart(null)}
            >
              <div 
                className="bg-white rounded-2xl shadow-2xl w-[85vw] max-w-4xl" 
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0]">
                  <div>
                    <h3 className="text-[22px] font-bold text-[#333333]">{expandedChart.title}</h3>
                    <p className="text-[13px] text-[#999999]">{expandedChart.type} chart • {expandedChart.dualAxis ? "Dual axis" : expandedChart.yColumns.join(", ")}</p>
                  </div>
                  <button 
                    onClick={() => setExpandedChart(null)} 
                    className="p-2 hover:bg-[#F5F5F5] rounded-lg transition"
                  >
                    <X size={22} className="text-[#666666]" />
                  </button>
                </div>
                <div className="p-8 flex items-center justify-center">
                  <div className="w-full">
                    <ChartRenderer config={expandedChart} height={450} data={chartFilteredDataset?.rows} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* CORRELATION SECTION */}
      {activeSection === "correlation" && (
        <>
        {/* Global Data Filters for All Correlation Analysis */}
        <div ref={corrFilterRef} className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setFilterSectionExpanded(!filterSectionExpanded)}
              className="p-1 hover:bg-[#F5F5F5] rounded transition"
              title={filterSectionExpanded ? "Collapse filters" : "Expand filters"}
            >
              <svg 
                className={`w-4 h-4 text-[#666666] transition-transform ${filterSectionExpanded ? "rotate-90" : ""}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <span className="text-[14px] font-semibold text-[#333333]">Filter Data</span>
            {!filterSectionExpanded && (appliedTimeFrom || appliedTimeTo || appliedCorrFilters.length > 0) && (
              <span className="text-[12px] bg-[#E8F8F0] text-[#41C185] px-3 py-1 rounded-full font-medium">
                {filteredRows.length} of {dataset?.rows.length} rows
              </span>
            )}
            {!filterSectionExpanded && (
              <span className="text-[11px] text-[#999999]">Click to expand</span>
            )}
          </div>
          
          {filterSectionExpanded && (
            <>
          {/* Show data range info */}
          {filterTimeCol && timeDateRange.min && timeDateRange.max && (
            <div className="mb-3 p-2 bg-[#F0F8FF] rounded-lg text-[12px] text-[#458EE2]">
              📅 Your data range: <strong>{timeDateRange.min.toLocaleDateString()}</strong> to <strong>{timeDateRange.max.toLocaleDateString()}</strong> ({dataset?.rows.length} rows)
            </div>
          )}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Time Range Filter with Calendar */}
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#666666]" />
              <label className="text-[12px] text-[#666666]">Time:</label>
              <select 
                value={filterTimeCol} 
                onChange={(e) => { setFilterTimeCol(e.target.value); setFilterTimeFrom(null); setFilterTimeTo(null); }}
                className="border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-[13px] bg-white min-w-[120px]"
              >
                <option value="">Select column...</option>
                {allCols.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              {filterTimeCol && timeDateRange.min && (
                <>
                  <span className="text-[12px] text-[#999999]">from</span>
                  <DatePicker
                    selected={filterTimeFrom}
                    onChange={(date) => setFilterTimeFrom(date)}
                    selectsStart
                    startDate={filterTimeFrom}
                    endDate={filterTimeTo}
                    minDate={timeDateRange.min}
                    maxDate={filterTimeTo || timeDateRange.max}
                    placeholderText={timeDateRange.min.toLocaleDateString()}
                    className="border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-[13px] bg-white w-[120px]"
                    dateFormat="dd-MM-yyyy"
                  />
                  <span className="text-[12px] text-[#999999]">to</span>
                  <DatePicker
                    selected={filterTimeTo}
                    onChange={(date) => setFilterTimeTo(date)}
                    selectsEnd
                    startDate={filterTimeFrom}
                    endDate={filterTimeTo}
                    minDate={filterTimeFrom || timeDateRange.min}
                    maxDate={timeDateRange.max}
                    placeholderText={timeDateRange.max.toLocaleDateString()}
                    className="border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-[13px] bg-white w-[120px]"
                    dateFormat="dd-MM-yyyy"
                  />
                </>
              )}
              {filterTimeCol && !timeDateRange.min && (
                <span className="text-[11px] text-[#EF4444] italic">⚠️ No valid dates found in this column</span>
              )}
            </div>
            {/* Categorical Filter - Checkbox Multi-select with Add Filter */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-[#666666] font-medium">Category:</label>
              <div className="relative">
                <button
                  onClick={() => setCorrFilterDropdownOpen(!corrFilterDropdownOpen)}
                  className="border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-[12px] bg-white min-w-[130px] flex items-center justify-between hover:border-[#FFBD59] transition"
                >
                  <span className={filterCatCol ? "text-[#333333]" : "text-[#999999]"}>
                    {filterCatCol || "Select..."}
                  </span>
                  <svg className={`w-3 h-3 ml-2 transition-transform ${corrFilterDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {corrFilterDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCorrFilterDropdownOpen(false)} />
                    <div className="absolute z-20 mt-1 w-64 bg-white border border-[#E5E5E5] rounded-lg shadow-lg max-h-80 overflow-auto">
                      <div className="sticky top-0 bg-white p-2 border-b border-[#E5E5E5]">
                        <input
                          type="text"
                          placeholder="Search columns..."
                          value={corrFilterSearchTerm}
                          onChange={(e) => setCorrFilterSearchTerm(e.target.value)}
                          className="w-full border border-[#E5E5E5] rounded px-2 py-1 text-[11px] focus:ring-1 focus:ring-[#FFBD59] outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      {(categoricalCols.length > 0 ? categoricalCols : allCols)
                        .filter(c => !corrFilterSearchTerm || c.name.toLowerCase().includes(corrFilterSearchTerm.toLowerCase()))
                        .filter(c => !corrFilters.some(f => f.column === c.name))
                        .map((c) => (
                          <button
                            key={c.name}
                            onClick={() => {
                              setFilterCatCol(c.name);
                              setFilterCatValues([]);
                              setCorrFilterDropdownOpen(false);
                              setCorrFilterSearchTerm("");
                            }}
                            className={`w-full px-3 py-1.5 text-left hover:bg-[#FFF8ED] text-[12px] ${
                              filterCatCol === c.name ? "bg-[#FFF2DF] text-[#333333] font-medium" : "text-[#666666]"
                            }`}
                          >
                            {c.name}
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
              
              {filterCatCol && (
                <>
                <div className="flex-1 min-w-[250px] max-w-[400px]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFilterCatValues(catFilterValues)}
                        className="text-[10px] text-[#458EE2] hover:underline"
                      >
                        Select all
                      </button>
                      <button
                        onClick={() => setFilterCatValues([])}
                        className="text-[10px] text-[#999999] hover:text-[#666666]"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="border border-[#E5E5E5] rounded-lg p-2 bg-[#FAFAFA] max-h-24 overflow-y-auto">
                    <div className="mb-1.5 pb-1.5 border-b border-[#E5E5E5]">
                      <input
                        type="text"
                        placeholder="Search..."
                        value={corrFilterValueSearchTerm}
                        onChange={(e) => setCorrFilterValueSearchTerm(e.target.value)}
                        className="w-full border border-[#E5E5E5] rounded px-2 py-1 text-[11px] focus:ring-1 focus:ring-[#FFBD59] outline-none bg-white"
                      />
                    </div>
                    <div className="space-y-0.5">
                      {filteredCorrCatValues.map((v) => (
                        <label key={v} className="flex items-center gap-1.5 py-0.5 px-1.5 hover:bg-white rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filterCatValues.includes(v)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFilterCatValues([...filterCatValues, v]);
                              } else {
                                setFilterCatValues(filterCatValues.filter(val => val !== v));
                              }
                            }}
                            className="w-3 h-3 text-[#41C185] rounded border-[#E5E5E5] focus:ring-[#41C185]"
                          />
                          <span className="text-[12px] text-[#333333]">{v}</span>
                        </label>
                      ))}
                    </div>
                    {filteredCorrCatValues.length === 0 && (
                      <p className="text-[11px] text-[#999999] text-center py-1">No values</p>
                    )}
                  </div>
                </div>
                
                {/* Add Filter Button */}
                <button
                  onClick={() => {
                    if (filterCatCol && filterCatValues.length > 0) {
                      setCorrFilters([...corrFilters, { column: filterCatCol, values: filterCatValues }]);
                      setFilterCatCol("");
                      setFilterCatValues([]);
                    }
                  }}
                  disabled={!filterCatCol || filterCatValues.length === 0}
                  className="px-3 py-1.5 bg-[#FFBD59] text-[#333333] rounded-lg text-[12px] font-semibold hover:bg-[#FFCF87] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  + Add
                </button>
                </>
              )}
            </div>
            
            {/* Pending Filters Display (before Apply) */}
            {corrFilters.length > 0 && (
              <div className="w-full">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] text-[#666666] font-medium">Pending:</span>
                  <button
                    onClick={() => setCorrFilters([])}
                    className="text-[10px] text-[#EF4444] hover:text-[#DC2626] ml-auto"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1">
                  {corrFilters.map((filter, idx) => (
                    <div key={idx} className="flex flex-wrap gap-1 items-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFA500] text-white rounded text-[10px] font-medium">
                        {filter.column}
                        <button 
                          onClick={() => setCorrFilters(corrFilters.filter((_, i) => i !== idx))}
                          className="hover:text-[#FFE5E5] ml-0.5"
                        >×</button>
                      </span>
                      {filter.values.map(val => (
                        <span key={val} className="inline-flex items-center px-1.5 py-0.5 bg-[#FFE5CC] text-[#CC6600] rounded text-[10px] font-medium">
                          {val}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Apply Filters Button */}
            <button
              onClick={() => {
                setAppliedTimeCol(filterTimeCol);
                setAppliedTimeFrom(filterTimeFrom);
                setAppliedTimeTo(filterTimeTo);
                setAppliedCorrFilters(corrFilters);
              }}
              disabled={!filterTimeCol && corrFilters.length === 0}
              className="px-4 py-1.5 bg-[#FFBD59] text-[#333333] rounded-lg text-[13px] font-semibold hover:bg-[#FFCF87] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Apply Filters
            </button>
          </div>
          
          {/* Global Time/X-Axis Selection */}
          <div className="mt-4 pt-4 border-t border-[#F0F0F0]">
            <div className="flex items-center gap-2">
              <label className="text-[12px] text-[#666666] font-medium">Time/X-Axis for Charts:</label>
              <select 
                value={timeColumn} 
                onChange={(e) => setTimeColumn(e.target.value)} 
                className="border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-[13px] bg-white min-w-[150px]"
              >
                <option value="">Row Index</option>
                {allCols.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <span className="text-[11px] text-[#999999] italic">This applies to all correlation charts below</span>
            </div>
          </div>

          {/* Show applied filter status */}
          {(appliedTimeFrom || appliedTimeTo || appliedCorrFilters.length > 0) && (
            <div className="mt-3 pt-3 border-t border-[#F0F0F0]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12px] text-[#41C185] font-medium">✓ Filters Applied:</span>
                <span className="text-[12px] text-[#666666]">
                  {filteredRows.length} of {dataset?.rows.length} rows
                  {appliedTimeFrom && appliedTimeTo && ` • ${appliedTimeFrom.toLocaleDateString()} to ${appliedTimeTo.toLocaleDateString()}`}
                  {appliedTimeFrom && !appliedTimeTo && ` • From ${appliedTimeFrom.toLocaleDateString()}`}
                  {!appliedTimeFrom && appliedTimeTo && ` • Until ${appliedTimeTo.toLocaleDateString()}`}
                </span>
                <button 
                  onClick={() => { 
                    setAppliedTimeCol(""); setAppliedTimeFrom(null); setAppliedTimeTo(null); 
                    setAppliedCorrFilters([]);
                    setFilterTimeCol(""); setFilterTimeFrom(null); setFilterTimeTo(null);
                    setFilterCatCol(""); setFilterCatValues([]);
                    setCorrFilters([]);
                  }}
                  className="ml-auto text-[12px] text-[#EF4444] hover:text-[#DC2626]"
                >
                  Clear All
                </button>
              </div>
              {appliedCorrFilters.length > 0 && (
                <div className="space-y-1.5">
                  {appliedCorrFilters.map((filter, idx) => (
                    <div key={idx} className="flex flex-wrap gap-1 items-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#458EE2] text-white rounded text-[10px] font-medium">
                        {filter.column}
                        <button 
                          onClick={() => {
                            const newFilters = appliedCorrFilters.filter((_, i) => i !== idx);
                            setAppliedCorrFilters(newFilters);
                            setCorrFilters(newFilters);
                          }}
                          className="hover:text-[#FFE5E5] ml-0.5"
                        >×</button>
                      </span>
                      {filter.values.map(val => (
                        <span key={val} className="inline-flex items-center px-1.5 py-0.5 bg-[#E8F8F0] text-[#41C185] rounded text-[10px] font-medium">
                          {val}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </>
          )}
        </div>

        {/* MULTI-TARGET ANALYSIS - Moved here for client priority */}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Column Selection & Matrix */}
          <div className="lg:col-span-1 space-y-4">
            {/* Manual Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-5">
              <h3 className="text-[16px] font-semibold text-[#333333] mb-3">Compare Columns</h3>
              <p className="text-[12px] text-[#999999] mb-4">Select any two columns to compare</p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] text-[#666666] mb-1">Column 1</label>
                  <select 
                    value={manualCol1} 
                    onChange={(e) => setManualCol1(e.target.value)} 
                    className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px] bg-white"
                  >
                    <option value="">Select column...</option>
                    {numericCols.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] text-[#666666] mb-1">Column 2</label>
                  <select 
                    value={manualCol2} 
                    onChange={(e) => setManualCol2(e.target.value)} 
                    className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px] bg-white"
                  >
                    <option value="">Select column...</option>
                    {numericCols.filter(c => c.name !== manualCol1).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] text-[#666666] mb-1">Lag (periods)</label>
                  <input 
                    type="number" 
                    value={lag} 
                    onChange={(e) => setLag(Number(e.target.value))} 
                    className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]"
                    placeholder="0"
                  />
                </div>
                <p className="text-[10px] text-[#999999]">
                  Lag: positive = Col2 leads, negative = Col1 leads
                </p>
                <button
                  onClick={() => {
                    if (manualCol1 && manualCol2 && dataset) {
                      // Use filteredRows if filters are applied, otherwise use all data
                      const dataToUse = (appliedTimeCol || appliedCorrFilters.length > 0) ? filteredRows : dataset.rows;
                      const r = calculateLaggedCorrelation(manualCol1, manualCol2, lag, dataToUse);
                      setSelectedCorr({ col1: manualCol1, col2: manualCol2, r, lag });
                    }
                  }}
                  disabled={!manualCol1 || !manualCol2}
                  className="w-full py-2.5 bg-[#FFBD59] text-[#333333] rounded-lg font-semibold hover:bg-[#FFCF87] disabled:opacity-50 transition"
                >
                  Analyze
                </button>
              </div>
            </div>

            {/* Pre-computed Matrix */}
            <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-5">
              <h3 className="text-[16px] font-semibold text-[#333333] mb-2">All Correlations</h3>
              <div className="mb-3">
                <select 
                  value={corrFilterCol} 
                  onChange={(e) => setCorrFilterCol(e.target.value)}
                  className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px] bg-white"
                >
                  <option value="">All columns</option>
                  {numericCols.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-2 max-h-[320px] overflow-auto">
                {correlationMatrix
                  ?.filter(({ col1, col2 }) => !corrFilterCol || col1 === corrFilterCol || col2 === corrFilterCol)
                  .map(({ col1, col2, r }) => (
                  <button
                    key={`${col1}-${col2}`}
                    onClick={() => setSelectedCorr({ col1, col2, r, lag: 0 })}
                    className={`w-full p-3 rounded-lg border text-left transition ${
                      selectedCorr?.col1 === col1 && selectedCorr?.col2 === col2
                        ? "border-[#FFBD59] bg-[#FFF2DF]"
                        : "border-[#E5E5E5] hover:border-[#FFBD59] hover:bg-[#FFFBF5]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`px-2 py-0.5 rounded text-[12px] font-mono border ${getCorrColor(r)}`}>
                        r = {r.toFixed(3)}
                      </span>
                      <span className="text-[10px] text-[#999999]">
                        {Math.abs(r) > 0.7 ? "Strong" : Math.abs(r) > 0.4 ? "Moderate" : "Weak"}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#333333] truncate">{col1}</p>
                    <p className="text-[13px] text-[#666666] truncate">vs {col2}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Visualization */}
          <div className="lg:col-span-2">
            {!selectedCorr ? (
              <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-12 text-center">
                <TrendingUp size={48} className="mx-auto mb-4 text-[#E5E5E5]" />
                <p className="text-[16px] text-[#999999]">Select a correlation pair to visualize</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-[18px] font-semibold text-[#333333]">{selectedCorr.col1} vs {selectedCorr.col2}</h3>
                    <p className="text-[14px] text-[#666666]">
                      Correlation: <span className={`px-2 py-0.5 rounded font-mono ${getCorrColor(selectedCorr.r)}`}>r = {selectedCorr.r.toFixed(3)}</span>
                      {selectedCorr.lag !== 0 && <span className="ml-2 text-[#458EE2]">(lag: {selectedCorr.lag})</span>}
                      <span className="ml-2 text-[#999999]">
                        ({Math.abs(selectedCorr.r) > 0.7 ? "Strong" : Math.abs(selectedCorr.r) > 0.4 ? "Moderate" : "Weak"} 
                        {selectedCorr.r < 0 ? " negative" : " positive"})
                      </span>
                    </p>
                  </div>
                  <button onClick={() => setSelectedCorr(null)} className="p-2 hover:bg-[#F5F5F5] rounded-lg">
                    <X size={20} className="text-[#999999]" />
                  </button>
                </div>

                {/* Lag Analysis */}
                {lagAnalysis && (
                  <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[14px] font-medium text-[#333333]">Lag Analysis</h4>
                          {/* SaveButton removed - no reports in client version */}
                        </div>
                        {(() => {
                          const best = lagAnalysis.reduce((a, b) => Math.abs(b.r) > Math.abs(a.r) ? b : a);
                          const interpretation = best.lag > 0 
                            ? `${selectedCorr.col2} leads by ${best.lag} periods` 
                            : best.lag < 0 
                              ? `${selectedCorr.col1} leads by ${Math.abs(best.lag)} periods`
                              : "No lag (simultaneous)";
                          return (
                            <p className="text-[12px] text-[#666666]">
                              Best correlation at lag {best.lag}: <span className="font-mono font-semibold">{best.r.toFixed(3)}</span>
                              <span className="ml-2 text-[#458EE2]">({interpretation})</span>
                            </p>
                          );
                        })()}
                      </div>
                      <button 
                        onClick={() => {
                          const best = lagAnalysis.reduce((a, b) => Math.abs(b.r) > Math.abs(a.r) ? b : a);
                          setSelectedCorr({ ...selectedCorr, r: best.r, lag: best.lag });
                          setLag(best.lag);
                        }}
                        className="px-3 py-1.5 bg-[#458EE2] text-white rounded-lg text-[12px] hover:bg-[#3A7BC8] transition"
                      >
                        Use Best Lag
                      </button>
                    </div>
                    <div ref={lagAnalysisRef}>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={lagAnalysis}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                        <XAxis dataKey="lag" tick={{ fontSize: 10, fill: "#666666" }} label={{ value: "Lag", position: "bottom", fontSize: 11, fill: "#666666" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#666666" }} domain={[-1, 1]} />
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => v.toFixed(3)} />
                        <Line type="monotone" dataKey="r" stroke="#FFBD59" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-[10px] text-[#999999] mt-2 text-center">
                      Negative lag = {selectedCorr.col1} leads • Positive lag = {selectedCorr.col2} leads
                    </p>
                    </div>
                  </div>
                )}

                {/* Trend Chart */}
                <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[14px] font-medium text-[#333333]">Trend Over {timeColumn || "Index"}</h4>
                    {/* SaveButton removed - no reports in client version */}
                  </div>
                  <div ref={trendChartRef}>
                    {selectedCorr.lag !== 0 && (
                      <p className="text-[12px] text-[#458EE2] mb-2">
                        ⚡ {selectedCorr.lag > 0 
                          ? `${selectedCorr.col2} shifted back by ${selectedCorr.lag} periods (${selectedCorr.col2} leads)`
                          : `${selectedCorr.col1} shifted back by ${Math.abs(selectedCorr.lag)} periods (${selectedCorr.col1} leads)`
                        }
                      </p>
                    )}
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={trendData || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                        <XAxis dataKey="index" tick={{ fontSize: 11, fill: "#666666" }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#41C185" }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#458EE2" }} />
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {/* Dynamic dataKeys based on lag sign */}
                        <Line 
                          yAxisId="left" 
                          type="monotone" 
                          dataKey={selectedCorr.lag < 0 ? `${selectedCorr.col1} (shifted -${Math.abs(selectedCorr.lag)})` : selectedCorr.col1} 
                          stroke="#41C185" 
                          strokeWidth={2} 
                          dot={false} 
                          strokeDasharray={selectedCorr.lag < 0 ? "5 5" : undefined}
                        />
                        <Line 
                          yAxisId="right" 
                          type="monotone" 
                          dataKey={selectedCorr.lag > 0 ? `${selectedCorr.col2} (shifted -${selectedCorr.lag})` : selectedCorr.col2} 
                          stroke="#458EE2" 
                          strokeWidth={2} 
                          dot={false} 
                          strokeDasharray={selectedCorr.lag > 0 ? "5 5" : undefined}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Scatter Chart */}
                <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[14px] font-medium text-[#333333]">Scatter Plot</h4>
                    {/* SaveButton removed - no reports in client version */}
                  </div>
                  <div ref={scatterChartRef}>
                    <ResponsiveContainer width="100%" height={250}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                        <XAxis dataKey="x" name={selectedCorr.col1} tick={{ fontSize: 11, fill: "#666666" }} label={{ value: selectedCorr.col1, position: "bottom", fontSize: 12, fill: "#666666" }} />
                        <YAxis dataKey="y" name={selectedCorr.col2} tick={{ fontSize: 11, fill: "#666666" }} label={{ value: selectedCorr.col2, angle: -90, position: "insideLeft", fontSize: 12, fill: "#666666" }} />
                        <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Scatter data={scatterData || []} fill="#FFBD59" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MULTI-TARGET ANALYSIS SECTION - MOVED ABOVE */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-[18px] font-semibold text-[#333333]">Multi-Target Analysis</h3>
              <p className="text-[12px] text-[#999999]">Select target variables to analyze correlations with all other columns</p>
            </div>
            <div className="bg-[#F5F5F5] rounded-lg px-3 py-2 text-[11px] text-[#666666] max-w-sm">
              <p className="font-medium text-[#333333] mb-1">Analysis Modes:</p>
              <p><span className="text-[#FFBD59] font-medium">Lag:</span> Find best time shift (e.g., +2 = X from 2 periods ago affects Y today)</p>
              <p><span className="text-[#41C185] font-medium">Rolling Sum:</span> Correlate X[t] with sum of Y over next N periods</p>
            </div>
          </div>

          {/* Target Variable Selection - Compact Dropdown */}
          <div className="mb-4 flex items-start gap-3">
            <div className="relative flex-1 max-w-md">
              <button
                type="button"
                onClick={() => setTargetDropdownOpen(!targetDropdownOpen)}
                className="w-full border border-[#E5E5E5] rounded-lg px-4 py-2.5 text-left bg-white flex items-center justify-between text-[14px]"
              >
                <span className={targetVariables.length === 0 ? "text-[#999999]" : "text-[#333333]"}>
                  {targetVariables.length === 0 ? "Select target variables..." : `${targetVariables.length} selected`}
                </span>
                <svg className={`w-4 h-4 transition-transform ${targetDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {targetDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setTargetDropdownOpen(false)} />
                  <div 
                    className="absolute z-20 mt-1 w-full bg-white border border-[#E5E5E5] rounded-lg shadow-lg max-h-64 overflow-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {numericCols.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetVariables(prev => 
                            prev.includes(c.name) ? prev.filter(x => x !== c.name) : [...prev, c.name]
                          );
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-[#FFF8ED] flex items-center gap-3 text-[14px] border-b border-[#F5F5F5] last:border-0"
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          targetVariables.includes(c.name) ? "bg-[#FFBD59] border-[#FFBD59]" : "border-[#E5E5E5]"
                        }`}>
                          {targetVariables.includes(c.name) && <Check size={14} className="text-white" />}
                        </div>
                        <span>{c.name}</span>
                      </button>
                    ))}
                    {numericCols.length > 0 && (
                      <div className="sticky bottom-0 bg-[#F9F9F9] px-4 py-2 border-t border-[#E5E5E5] flex justify-between">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setTargetVariables(numericCols.map(c => c.name));
                          }} 
                          className="text-[12px] text-[#458EE2] hover:underline"
                        >
                          Select all
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setTargetVariables([]);
                          }} 
                          className="text-[12px] text-[#999999] hover:text-[#666666]"
                        >
                          Clear all
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            {targetVariables.length > 0 && (
              <div className="flex flex-wrap gap-1.5 flex-1">
                {targetVariables.map(v => (
                  <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#FFBD59] text-[#333333] rounded-lg text-[13px] font-medium">
                    {v}
                    <button onClick={() => setTargetVariables(prev => prev.filter(x => x !== v))} className="hover:text-[#666666] ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Mode Toggle & Filters */}
          {targetVariables.length > 0 && (
            <div className="mb-4 space-y-3">
              {/* Mode Toggle */}
              <div className="flex items-center gap-4">
                <span className="text-[13px] text-[#666666] font-medium">Analysis Mode:</span>
                <div className="flex rounded-lg border border-[#E5E5E5] overflow-hidden">
                  <button
                    onClick={() => setCorrelationMode("lag")}
                    className={`px-4 py-2 text-[13px] font-medium transition ${
                      correlationMode === "lag" 
                        ? "bg-[#FFBD59] text-[#333333]" 
                        : "bg-white text-[#666666] hover:bg-[#F5F5F5]"
                    }`}
                  >
                    Lag Analysis
                  </button>
                  <button
                    onClick={() => setCorrelationMode("rolling")}
                    className={`px-4 py-2 text-[13px] font-medium transition ${
                      correlationMode === "rolling" 
                        ? "bg-[#41C185] text-white" 
                        : "bg-white text-[#666666] hover:bg-[#F5F5F5]"
                    }`}
                  >
                    Rolling Sum
                  </button>
                </div>
                {correlationMode === "rolling" && (
                  <div className="flex items-center gap-2 text-[13px] ml-2 px-3 py-1.5 bg-[#E8F8F0] rounded-lg">
                    <span className="text-[#2D8A4E]">Window:</span>
                    <input
                      type="number"
                      min={2}
                      max={52}
                      value={rollingWindow}
                      onChange={(e) => setRollingWindow(Math.max(2, Math.min(52, Number(e.target.value))))}
                      className="w-16 border border-[#41C185] rounded px-2 py-1 text-center text-[13px] focus:ring-1 focus:ring-[#41C185] outline-none"
                    />
                    <span className="text-[#2D8A4E]">periods</span>
                  </div>
                )}
              </div>
              
              {/* Mode explanation */}
              <div className="text-[11px] text-[#999999] bg-[#F9F9F9] rounded-lg px-3 py-2">
                {correlationMode === "lag" ? (
                  <span>📊 <strong>Lag Analysis:</strong> Find the best time shift where X correlates with Y. Positive lag = X leads Y.</span>
                ) : (
                  <span>📈 <strong>Rolling Sum:</strong> Correlate X[t] with the sum of Y over the next {rollingWindow} periods (Y[t] + Y[t+1] + ... + Y[t+{rollingWindow-1}]).</span>
                )}
              </div>

              {/* Other Filters */}
              <div className="flex items-center gap-6 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer text-[13px]">
                  <input 
                    type="checkbox" 
                    checked={showOnlyPositive} 
                    onChange={(e) => setShowOnlyPositive(e.target.checked)}
                    className="w-4 h-4 rounded border-[#E5E5E5] text-[#41C185] focus:ring-[#41C185]"
                  />
                  <span className="text-[#333333]">Show only positive correlations</span>
                </label>
                {correlationMode === "lag" && (
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="text-[#666666]">Lag range:</span>
                    <input
                      type="number"
                      value={lagMin}
                      onChange={(e) => setLagMin(Math.min(Number(e.target.value), lagMax - 1))}
                      className="w-16 border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-center text-[13px] focus:ring-1 focus:ring-[#FFBD59] outline-none"
                    />
                    <span className="text-[#999999]">to</span>
                    <input
                      type="number"
                      value={lagMax}
                      onChange={(e) => setLagMax(Math.max(Number(e.target.value), lagMin + 1))}
                      className="w-16 border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-center text-[13px] focus:ring-1 focus:ring-[#FFBD59] outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results Tables */}
          {multiTargetAnalysis && targetVariables.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              {targetVariables.map(target => (
                <MultiTargetTable 
                  key={target}
                  target={target}
                  data={multiTargetAnalysis[target]}
                  showOnlyPositive={showOnlyPositive}
                  onRemove={() => setTargetVariables(prev => prev.filter(x => x !== target))}
                  onRowClick={(item) => setMultiTargetModal({ target, col: item.col, r: item.rBest, bestLag: item.bestLag })}
                  mode={correlationMode}
                  rollingWindow={rollingWindow}
                />
              ))}
            </div>
          )}

          {targetVariables.length === 0 && (
            <div className="text-center py-8 text-[#999999]">
              <TrendingUp size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-[14px]">Select target variables above to see correlation analysis</p>
            </div>
          )}
        </div>

        {/* Multi-Target Trend Modal */}
        {multiTargetModal && (
          <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" 
            onClick={() => setMultiTargetModal(null)}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto my-8" 
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0]">
                <div>
                  <h3 className="text-[20px] font-bold text-[#333333]">{multiTargetModal.target} vs {multiTargetModal.col}</h3>
                  <p className="text-[13px] text-[#666666]">
                    {correlationMode === "rolling" ? (
                      <>
                        Rolling Sum Correlation: <span className={`font-mono font-semibold ${
                          Math.abs(multiTargetModal.r) > 0.7 
                            ? multiTargetModal.r > 0 ? "text-[#2D8A4E]" : "text-[#DC2626]"
                            : "text-[#B8860B]"
                        }`}>r = {multiTargetModal.r.toFixed(3)}</span>
                        <span className="ml-2 text-[#41C185]">(window: {multiTargetModal.bestLag} periods)</span>
                      </>
                    ) : (
                      <>
                        Correlation: <span className={`font-mono font-semibold ${
                          Math.abs(multiTargetModal.r) > 0.7 
                            ? multiTargetModal.r > 0 ? "text-[#2D8A4E]" : "text-[#DC2626]"
                            : "text-[#B8860B]"
                        }`}>r = {multiTargetModal.r.toFixed(3)}</span>
                        {multiTargetModal.bestLag !== 0 && (
                          <span className="ml-2 text-[#458EE2]">
                            (best at lag {multiTargetModal.bestLag > 0 ? `+${multiTargetModal.bestLag}` : multiTargetModal.bestLag})
                          </span>
                        )}
                      </>
                    )}
                  </p>
                </div>
                <button 
                  onClick={() => setMultiTargetModal(null)} 
                  className="p-2 hover:bg-[#F5F5F5] rounded-lg transition"
                >
                  <X size={22} className="text-[#666666]" />
                </button>
              </div>
              
              {correlationMode === "rolling" ? (
                /* Rolling Sum Mode Content */
                <div className="p-6 space-y-6">
                  {/* Rolling Sum Explanation */}
                  <div className="bg-[#E8F8F0] rounded-lg p-4">
                    <h4 className="text-[14px] font-semibold text-[#2D8A4E] mb-2">📈 Rolling Sum Analysis</h4>
                    <p className="text-[13px] text-[#333333]">
                      This shows how <strong>{multiTargetModal.col}</strong> correlates with the rolling sum of <strong>{multiTargetModal.target}</strong> over {multiTargetModal.bestLag} periods.
                    </p>
                    <p className="text-[12px] text-[#666666] mt-1">
                      Formula: corr({multiTargetModal.col}[t], Σ{multiTargetModal.target}[t to t+{multiTargetModal.bestLag - 1}])
                    </p>
                  </div>

                  {/* Rolling Sum Trend Chart */}
                  <div className="bg-[#F9F9F9] rounded-lg p-4">
                    <h4 className="text-[14px] font-semibold text-[#333333] mb-3">
                      {multiTargetModal.col} vs Rolling Sum of {multiTargetModal.target} (window: {multiTargetModal.bestLag})
                    </h4>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={(() => {
                        // Calculate rolling sum data for visualization
                        const rows = filteredRows;
                        const window = multiTargetModal.bestLag;
                        const result = [];
                        for (let i = 0; i <= rows.length - window; i++) {
                          let sum = 0;
                          for (let j = 0; j < window; j++) {
                            sum += Number(rows[i + j][multiTargetModal.target]) || 0;
                          }
                          result.push({
                            index: timeColumn ? rows[i][timeColumn] : i,
                            [multiTargetModal.col]: Number(rows[i][multiTargetModal.col]) || 0,
                            [`Σ${multiTargetModal.target} (${window})`]: sum,
                          });
                        }
                        return result;
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                        <XAxis dataKey="index" tick={{ fontSize: 11, fill: "#666666" }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#458EE2" }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#41C185" }} />
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line 
                          yAxisId="left" 
                          type="monotone" 
                          dataKey={multiTargetModal.col} 
                          stroke="#458EE2" 
                          strokeWidth={2} 
                          dot={false} 
                        />
                        <Line 
                          yAxisId="right" 
                          type="monotone" 
                          dataKey={`Σ${multiTargetModal.target} (${multiTargetModal.bestLag})`} 
                          stroke="#41C185" 
                          strokeWidth={2} 
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Scatter Plot for Rolling Sum */}
                  <div className="bg-[#F9F9F9] rounded-lg p-4">
                    <h4 className="text-[14px] font-semibold text-[#333333] mb-3">Scatter: {multiTargetModal.col} vs Rolling Sum</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                        <XAxis 
                          dataKey="x" 
                          name={multiTargetModal.col} 
                          tick={{ fontSize: 11, fill: "#666666" }} 
                          label={{ value: multiTargetModal.col, position: "bottom", fontSize: 12, fill: "#666666" }} 
                        />
                        <YAxis 
                          dataKey="y" 
                          name={`Σ${multiTargetModal.target}`} 
                          tick={{ fontSize: 11, fill: "#666666" }} 
                          label={{ value: `Σ${multiTargetModal.target} (${multiTargetModal.bestLag})`, angle: -90, position: "insideLeft", fontSize: 12, fill: "#666666" }} 
                        />
                        <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Scatter 
                          data={(() => {
                            const rows = filteredRows;
                            const window = multiTargetModal.bestLag;
                            const result = [];
                            for (let i = 0; i <= rows.length - window; i++) {
                              let sum = 0;
                              for (let j = 0; j < window; j++) {
                                sum += Number(rows[i + j][multiTargetModal.target]) || 0;
                              }
                              result.push({
                                x: Number(rows[i][multiTargetModal.col]) || 0,
                                y: sum,
                              });
                            }
                            return result;
                          })()} 
                          fill="#41C185" 
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                /* Lag Mode Content (original) */
                <div className="p-6 grid grid-cols-3 gap-6">
                  {/* Lag Analysis Chart */}
                  <div className="col-span-1 bg-[#F9F9F9] rounded-lg p-4">
                    <h4 className="text-[14px] font-semibold text-[#333333] mb-3">Correlation by Lag</h4>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={multiTargetLagAnalysis || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                        <XAxis dataKey="lag" tick={{ fontSize: 11, fill: "#666666" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#666666" }} domain={[-1, 1]} />
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => v.toFixed(3)} />
                        <Line type="monotone" dataKey="r" stroke="#FFBD59" strokeWidth={3} dot={{ r: 4, fill: "#FFBD59" }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="text-[11px] text-[#666666] mt-3 text-center space-y-1">
                      <p className="font-medium">Best: lag {multiTargetModal.bestLag} → r = {multiTargetModal.r.toFixed(3)}</p>
                      <p className="text-[#999999]">-lag = {multiTargetModal.target} leads • +lag = {multiTargetModal.col} leads</p>
                    </div>
                  </div>

                  {/* Trend Chart */}
                  <div className="col-span-2">
                    <h4 className="text-[14px] font-semibold text-[#333333] mb-3">Trend Comparison {multiTargetModal.bestLag !== 0 && `(lag ${multiTargetModal.bestLag})`}</h4>
                    <ResponsiveContainer width="100%" height={380}>
                      <LineChart data={multiTargetTrendData || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                        <XAxis dataKey="index" tick={{ fontSize: 11, fill: "#666666" }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#41C185" }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#458EE2" }} />
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line 
                          yAxisId="left" 
                          type="monotone" 
                          dataKey={multiTargetModal.target} 
                          stroke="#41C185" 
                          strokeWidth={2} 
                          dot={false} 
                        />
                        <Line 
                          yAxisId="right" 
                          type="monotone" 
                          dataKey={multiTargetModal.bestLag !== 0 ? `${multiTargetModal.col} (lag ${multiTargetModal.bestLag})` : multiTargetModal.col} 
                          stroke="#458EE2" 
                          strokeWidth={2} 
                          dot={false}
                          strokeDasharray="5 5"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </>
      )}

      {/* CLUSTERING SECTION */}
      {activeSection === "clustering" && dataset && (
        <ClusteringSection dataset={dataset} />
      )}

      {/* TIME SERIES SECTION - Hidden for client version */}
      {/* {activeSection === "timeseries" && dataset && (
        <TimeSeriesSection dataset={dataset} />
      )} */}
    </div>
  );
}
