import { useState, useMemo, useRef, useEffect } from "react";
import { TrendingUp, X, Upload, BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useStore } from "../store/useStore";
import Papa from "papaparse";

// Format column names for display
function formatColumnName(name: string): string {
  return name
    .replace(/^(Meta_|Amazon_|Shopify_|Google_)/, '') // Remove platform prefix
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim() // Remove leading/trailing spaces
    .replace(/\b\w/g, (char) => char.toUpperCase()) // Capitalize first letter of each word
    .replace(/Thruplays/gi, 'ThruPlays') // Fix ThruPlays capitalization
    .replace(/Pmax/gi, 'PMax') // Fix PMax capitalization
    .replace(/Youtube/gi, 'YouTube') // Fix YouTube capitalization
    .replace(/Atc/gi, 'ATC') // Fix ATC capitalization
    .replace(/\bAnd\b/g, 'and') // Lowercase 'and'
    .replace(/\bOf\b/g, 'of') // Lowercase 'of'
    .replace(/\bThe\b/g, 'the'); // Lowercase 'the'
}

// OLS Regression calculation
function calculateOLS(x: number[], y: number[]): {
  beta: number;
  intercept: number;
  rSquared: number;
  standardError: number;
  tStat: number;
  pValue: number;
  elasticity: number;
} {
  const n = x.length;
  if (n === 0) return { beta: 0, intercept: 0, rSquared: 0, standardError: 0, tStat: 0, pValue: 1, elasticity: 0 };
  
  // Log-log transformation for elasticity (filter out zeros and negatives)
  const logX: number[] = [];
  const logY: number[] = [];
  
  for (let i = 0; i < n; i++) {
    if (x[i] > 0 && y[i] > 0) {
      logX.push(Math.log(x[i]));
      logY.push(Math.log(y[i]));
    }
  }
  
  const nLog = logX.length;
  if (nLog < 3) {
    // Not enough valid data points for log-log regression, return zeros
    return { beta: 0, intercept: 0, rSquared: 0, standardError: 0, tStat: 0, pValue: 1, elasticity: 0 };
  }
  
  // Calculate means of log-transformed data
  const meanLogX = logX.reduce((a, b) => a + b, 0) / nLog;
  const meanLogY = logY.reduce((a, b) => a + b, 0) / nLog;
  
  // Calculate beta (slope) - this IS the elasticity in log-log model
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < nLog; i++) {
    numerator += (logX[i] - meanLogX) * (logY[i] - meanLogY);
    denominator += (logX[i] - meanLogX) * (logX[i] - meanLogX);
  }
  const beta = denominator === 0 ? 0 : numerator / denominator;
  
  // Calculate intercept
  const intercept = meanLogY - beta * meanLogX;
  
  // Calculate R-squared
  let ssTotal = 0;
  let ssResidual = 0;
  for (let i = 0; i < nLog; i++) {
    const predicted = intercept + beta * logX[i];
    ssTotal += (logY[i] - meanLogY) * (logY[i] - meanLogY);
    ssResidual += (logY[i] - predicted) * (logY[i] - predicted);
  }
  const rSquared = ssTotal === 0 ? 0 : 1 - (ssResidual / ssTotal);
  
  // Calculate standard error of beta
  const mse = ssResidual / (nLog - 2);
  const standardError = Math.sqrt(mse / denominator);
  
  // Calculate t-statistic
  const tStat = standardError === 0 ? 0 : beta / standardError;
  
  // Calculate p-value (two-tailed test)
  const df = nLog - 2;
  const pValue = calculatePValue(Math.abs(tStat), df);
  
  // In log-log model, beta IS the elasticity
  // β = d(log Y) / d(log X) = (dY/Y) / (dX/X) = elasticity
  const elasticity = beta;
  
  return { beta, intercept, rSquared, standardError, tStat, pValue, elasticity };
}

// Calculate p-value from t-statistic (approximation)
function calculatePValue(t: number, df: number): number {
  if (df <= 0) return 1;
  
  // Using approximation for two-tailed t-test
  // For large df, t-distribution approaches normal distribution
  const x = df / (df + t * t);
  
  // Beta function approximation
  let p: number;
  if (df > 30) {
    // Normal approximation for large df
    p = 2 * (1 - normalCDF(t));
  } else {
    // Simple approximation for smaller df
    p = Math.pow(x, df / 2);
  }
  
  return Math.min(1, Math.max(0, p));
}

// Normal CDF approximation
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

// Format p-value with significance stars
function formatPValue(p: number): { text: string; stars: string; color: string } {
  let stars = '';
  let color = '#999999';
  
  if (p < 0.001) {
    stars = '***';
    color = '#2D8A4E'; // Green - highly significant
  } else if (p < 0.01) {
    stars = '**';
    color = '#41C185'; // Light green - very significant
  } else if (p < 0.05) {
    stars = '*';
    color = '#B8860B'; // Gold - significant
  } else {
    stars = 'ns';
    color = '#DC2626'; // Red - not significant
  }
  
  return {
    text: p < 0.001 ? '< 0.001' : p.toFixed(3),
    stars,
    color
  };
}

// Multi-target correlation table component
function MultiTargetTable({
  target,
  data,
  showOnlyPositive,
  onRemove,
  onRowClick,
  mode,
  rollingWindow,
  selectedPlatform,
}: {
  target: string;
  data: { col: string; r0: number; rBest: number; bestLag: number }[];
  showOnlyPositive: boolean;
  onRemove: () => void;
  onRowClick: (item: { col: string; r0: number; rBest: number; bestLag: number }) => void;
  mode: "lag" | "rolling";
  rollingWindow?: number;
  selectedPlatform?: string;
}) {
  const tableRef = useRef<HTMLDivElement>(null);
  
  // Filter data by selected platform if provided
  const filteredData = useMemo(() => {
    if (!selectedPlatform || selectedPlatform === "All") return data;
    return data.filter(item => {
      return item.col.startsWith(`${selectedPlatform}_`);
    });
  }, [data, selectedPlatform]);
  
  return (
    <div ref={tableRef} className="border border-[#E5E5E5] rounded-xl overflow-hidden shadow-sm">
      <div className="bg-[#FFBD59] px-4 py-3 flex items-center justify-between">
        <div>
          <h4 className="text-[16px] font-bold text-[#333333]">{target}</h4>
          {mode === "rolling" && (
            <p className="text-[11px] text-[#333333]/70">Rolling sum of {rollingWindow} periods</p>
          )}
          {selectedPlatform && selectedPlatform !== "All" && (
            <p className="text-[11px] text-[#333333]/70">Filtered by: {selectedPlatform}</p>
          )}
        </div>
        <button onClick={onRemove} className="text-[#333333]/60 hover:text-[#333333] text-[20px] leading-none">×</button>
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
            {filteredData
              ?.filter(item => !showOnlyPositive || item.rBest > 0)
              .filter(item => item.col.toLowerCase() !== 'week')
              .sort((a, b) => {
                // When showing only positive, sort by rBest descending (highest positive first)
                // When showing all, sort by absolute value descending (strongest correlation first)
                if (showOnlyPositive) {
                  return b.rBest - a.rBest;
                } else {
                  return Math.abs(b.rBest) - Math.abs(a.rBest);
                }
              })
              .map((item, idx) => (
              <tr 
                key={item.col}
                onClick={() => onRowClick(item)}
                className={`cursor-pointer hover:bg-[#FFF8ED] transition border-b border-[#F0F0F0] ${idx === 0 ? "bg-[#FFF2DF]" : ""}`}
              >
                <td className="px-4 py-2.5 text-[#333333]" title={item.col}>
                  {idx === 0 && <span className="text-[#FFBD59] mr-1.5">★</span>}
                  <span className="truncate inline-block max-w-[150px] align-middle">{formatColumnName(item.col)}</span>
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

// Correlation calculation functions
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

export function CrossPlatformAnalysisPage() {
  const { dataset, setDataset } = useStore();
  
  // State
  const [targetVariables, setTargetVariables] = useState<string[]>([]);
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [showOnlyPositive, setShowOnlyPositive] = useState(false);
  const [lagMin, setLagMin] = useState(0);
  const [lagMax, setLagMax] = useState(15);
  const [correlationMode, setCorrelationMode] = useState<"lag" | "rolling">("lag");
  const [rollingWindow, setRollingWindow] = useState(4);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("All");
  const [startDate, setStartDate] = useState("2025-01-01");
  const [endDate, setEndDate] = useState("2025-11-15");
  
  // Modal state for detailed view
  const [multiTargetModal, setMultiTargetModal] = useState<{ 
    target: string; 
    col: string; 
    r: number; 
    bestLag: number;
  } | null>(null);
  
  // Close metrics dropdown when clicking outside
  const metricsRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (metricsRef.current && !metricsRef.current.contains(event.target as Node)) {
        setMetricsExpanded(false);
      }
    };
    
    if (metricsExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [metricsExpanded]);
  
  // Convert date to week number (based on Week_Start column in data)
  const dateToWeek = (dateStr: string) => {
    const date = new Date(dateStr);
    const startOfYear = new Date(2025, 0, 1); // Data starts from 2025
    const diff = date.getTime() - startOfYear.getTime();
    const weekNum = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, Math.min(46, weekNum)); // 46 weeks in sample data
  };
  
  // Filter data by date range (converted to weeks)
  const filteredDataset = useMemo(() => {
    if (!dataset) return null;
    
    const startWeek = dateToWeek(startDate);
    const endWeek = dateToWeek(endDate);
    
    const filteredRows = dataset.rows.filter(row => {
      const weekNum = Number(row.Week);
      return weekNum >= startWeek && weekNum <= endWeek;
    });
    
    return {
      rows: filteredRows,
      columns: dataset.columns,
      rowCount: filteredRows.length
    };
  }, [dataset, startDate, endDate]);
  
  const numericCols = filteredDataset?.columns.filter((c) => c.type === "numeric") || [];
  
  // Group metrics by platform and category
  const metricsByPlatform = useMemo(() => {
    const grouped: Record<string, Record<string, typeof numericCols>> = {
      Amazon: { "Sales & Performance": [] },
      Shopify: { "Sales & Performance": [] },
      Meta: { 
        "Total": [],
        "Gender": [],
        "Age × Gender": [],
        "Objective": [],
        "Media Type": [],
        "Audience": []
      },
      Google: {
        "Organic Search": [],
        "PMax": [],
        "Ads": [],
        "YouTube": []
      }
    };
    
    numericCols.forEach(col => {
      const name = col.name;
      
      // Amazon - all columns start with Amazon
      if (name.startsWith('Amazon')) {
        grouped.Amazon["Sales & Performance"].push(col);
      }
      // Shopify - all columns start with Shopify_
      else if (name.startsWith('Shopify_')) {
        grouped.Shopify["Sales & Performance"].push(col);
      }
      // Google - all columns start with Google_
      else if (name.startsWith('Google_')) {
        if (name.includes('_Organic_')) {
          grouped.Google["Organic Search"].push(col);
        } else if (name.includes('_PMax_')) {
          grouped.Google["PMax"].push(col);
        } else if (name.includes('_Ads_')) {
          grouped.Google["Ads"].push(col);
        } else if (name.includes('_YouTube_')) {
          grouped.Google["YouTube"].push(col);
        }
      }
      // Meta - all columns start with Meta_
      else if (name.startsWith('Meta_')) {
        // Skip unknown audience columns
        if (name.includes('unknown_Audience')) {
          return;
        }
        
        // Total
        if (name === 'Meta_Total_Impressions' || name === 'Meta_Total_ThruPlays') {
          grouped.Meta["Total"].push(col);
        }
        // Gender (without age breakdown)
        else if ((name === 'Meta_female_Impressions' || name === 'Meta_male_Impressions' || 
                  name === 'Meta_female_ThruPlays' || name === 'Meta_male_ThruPlays')) {
          grouped.Meta["Gender"].push(col);
        }
        // Age × Gender (e.g., Meta_female_45-54_Impressions)
        else if ((name.includes('_female_') || name.includes('_male_')) && (name.includes('-') || name.includes('+'))) {
          grouped.Meta["Age × Gender"].push(col);
        }
        // Objectives (LEARN_MORE, ORDER_NOW, SHOP_NOW, OUTCOME_ENGAGEMENT, OUTCOME_SALES, Traffic_and_Awareness)
        else if (name.includes('LEARN_MORE') || name.includes('ORDER_NOW') || name.includes('SHOP_NOW') || 
                 name.includes('OUTCOME_ENGAGEMENT') || name.includes('OUTCOME_SALES') || name.includes('Traffic_and_Awareness')) {
          grouped.Meta["Objective"].push(col);
        }
        // Media Type (Image, Video, ATC)
        else if (name.includes('_Image_') || name.includes('_Video_') || name.includes('_ATC_')) {
          grouped.Meta["Media Type"].push(col);
        }
        // Audience (engaged, prospecting only - skip unknown)
        else if (name.includes('_engaged_') || name.includes('_prospecting_')) {
          grouped.Meta["Audience"].push(col);
        }
        // Skip age groups without gender (Meta_18-24_Impressions, etc.) - these are uncategorized
        // Don't add them to any category
      }
    });
    
    return grouped;
  }, [numericCols]);
  
  // Load sample data function
  const loadSampleData = async () => {
    setIsLoadingSample(true);
    try {
      const response = await fetch('/cross_platform_marketing_data.csv');
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as Record<string, unknown>[];
          const columns = Object.keys(rows[0] || {}).map(name => ({
            name,
            type: (typeof rows[0][name] === 'number' ? 'numeric' : 'text') as 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'text' | 'id' | 'unknown'
          }));
          
          setDataset({
            rows,
            columns,
            rowCount: rows.length
          });
          
          setIsLoadingSample(false);
        },
        error: (error: Error) => {
          console.error('Error loading sample data:', error);
          setIsLoadingSample(false);
        }
      });
    } catch (error) {
      console.error('Error fetching sample data:', error);
      setIsLoadingSample(false);
    }
  };
  
  // Auto-select default metrics when data loads
  useEffect(() => {
    if (filteredDataset && targetVariables.length === 0) {
      const salesMetrics = filteredDataset.columns
        .filter(c => c.type === 'numeric' && (
          c.name === 'Amazon_total_product_sales' || 
          c.name === 'Shopify_Net_items_sold' ||
          c.name === 'Amazon_total_quantity'
        ))
        .map(c => c.name)
        .slice(0, 2);
      
      if (salesMetrics.length > 0) {
        setTargetVariables(salesMetrics);
      }
    }
  }, [filteredDataset]);

  // Calculate correlation with lag
  const calculateLaggedCorrelation = (col1: string, col2: string, lagValue: number, rows?: Record<string, unknown>[]) => {
    const dataRows = rows || filteredDataset?.rows;
    if (!dataRows || dataRows.length === 0) return 0;
    const x = dataRows.map((r) => Number(r[col1]) || 0);
    const y = dataRows.map((r) => Number(r[col2]) || 0);
    
    if (lagValue === 0) return calculateCorrelation(x, y);
    
    if (lagValue > 0) {
      const xTrimmed = x.slice(lagValue);
      const yTrimmed = y.slice(0, y.length - lagValue);
      return calculateCorrelation(xTrimmed, yTrimmed);
    } else {
      const absLag = Math.abs(lagValue);
      const xTrimmed = x.slice(0, x.length - absLag);
      const yTrimmed = y.slice(absLag);
      return calculateCorrelation(xTrimmed, yTrimmed);
    }
  };

  // Find best lag correlation
  const findBestLagCorrelation = (col1: string, col2: string, minLag: number = lagMin, maxLag: number = lagMax, rows?: Record<string, unknown>[]) => {
    let bestR = 0;
    let bestLag = 0;
    
    // If showOnlyPositive is enabled, only consider positive correlations
    if (showOnlyPositive) {
      // Start with r(0) if it's positive
      const r0 = calculateLaggedCorrelation(col1, col2, 0, rows);
      if (r0 > 0) {
        bestR = r0;
        bestLag = 0;
      }
      
      // Check all lags for better positive correlation
      for (let l = minLag; l <= maxLag; l++) {
        const r = calculateLaggedCorrelation(col1, col2, l, rows);
        if (r > bestR) {
          bestR = r;
          bestLag = l;
        }
      }
    } else {
      // Original logic - find strongest correlation by absolute value
      for (let l = minLag; l <= maxLag; l++) {
        const r = calculateLaggedCorrelation(col1, col2, l, rows);
        if (Math.abs(r) > Math.abs(bestR)) {
          bestR = r;
          bestLag = l;
        }
      }
    }
    
    return { r: bestR, lag: bestLag };
  };

  // Calculate rolling sum correlation
  const calculateRollingSumCorrelation = (xCol: string, yCol: string, window: number, rows?: Record<string, unknown>[]) => {
    const dataRows = rows || filteredDataset?.rows;
    if (!dataRows || dataRows.length === 0 || window < 1) return 0;
    
    const x = dataRows.map((r) => Number(r[xCol]) || 0);
    const y = dataRows.map((r) => Number(r[yCol]) || 0);
    
    if (x.length < window) return 0;
    
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

  // Multi-target correlation analysis - filter out Objective metrics
  const multiTargetAnalysis = useMemo(() => {
    if (!filteredDataset || targetVariables.length === 0 || filteredDataset.rows.length === 0) return null;
    const results: Record<string, { col: string; r0: number; rBest: number; bestLag: number }[]> = {};
    
    targetVariables.forEach(target => {
      const correlations: { col: string; r0: number; rBest: number; bestLag: number }[] = [];
      numericCols.forEach(c => {
        // Skip the target itself and Objective metrics (those are campaign types, not metrics)
        if (c.name !== target && !c.name.includes('Objective')) {
          if (correlationMode === "rolling") {
            const r0 = calculateLaggedCorrelation(target, c.name, 0, filteredDataset.rows);
            const rRolling = calculateRollingSumCorrelation(c.name, target, rollingWindow, filteredDataset.rows);
            correlations.push({ col: c.name, r0, rBest: rRolling, bestLag: rollingWindow });
          } else {
            const r0 = calculateLaggedCorrelation(target, c.name, 0, filteredDataset.rows);
            const { r: rBest, lag: bestLag } = findBestLagCorrelation(target, c.name, lagMin, lagMax, filteredDataset.rows);
            correlations.push({ col: c.name, r0, rBest, bestLag });
          }
        }
      });
      correlations.sort((a, b) => Math.abs(b.rBest) - Math.abs(a.rBest));
      results[target] = correlations;
    });
    
    return results;
  }, [filteredDataset, targetVariables, numericCols, lagMin, lagMax, correlationMode, rollingWindow]);

  // Lag analysis for modal
  const multiTargetLagAnalysis = useMemo(() => {
    if (!multiTargetModal || !filteredDataset || filteredDataset.rows.length === 0) return null;
    const { target, col } = multiTargetModal;
    const results: { lag: number; r: number }[] = [];
    for (let l = lagMin; l <= lagMax; l++) {
      results.push({ lag: l, r: calculateLaggedCorrelation(target, col, l, filteredDataset.rows) });
    }
    return results;
  }, [multiTargetModal, filteredDataset, lagMin, lagMax]);

  // Trend data for modal
  const multiTargetTrendData = useMemo(() => {
    if (!multiTargetModal || !filteredDataset || filteredDataset.rows.length === 0) return null;
    const { target, col, bestLag } = multiTargetModal;
    const rows = filteredDataset.rows;
    const colLagged = bestLag !== 0 ? `${col} (lag ${bestLag})` : col;
    
    if (bestLag === 0) {
      return rows.map((row, i) => ({
        index: i,
        [target]: Number(row[target]) || 0,
        [col]: Number(row[col]) || 0,
      }));
    }
    
    const result = [];
    if (bestLag > 0) {
      for (let i = bestLag; i < rows.length; i++) {
        result.push({
          index: i,
          [target]: Number(rows[i][target]) || 0,
          [colLagged]: Number(rows[i - bestLag][col]) || 0,
        });
      }
    } else {
      const absLag = Math.abs(bestLag);
      for (let i = absLag; i < rows.length; i++) {
        result.push({
          index: i,
          [target]: Number(rows[i - absLag][target]) || 0,
          [colLagged]: Number(rows[i][col]) || 0,
        });
      }
    }
    return result;
  }, [multiTargetModal, filteredDataset]);

  // OLS regression results for modal
  const olsResults = useMemo(() => {
    if (!multiTargetModal || !filteredDataset || filteredDataset.rows.length === 0) return null;
    
    const { target, col, bestLag } = multiTargetModal;
    const rows = filteredDataset.rows;
    
    // Prepare data with lag
    let xData: number[] = [];
    let yData: number[] = [];
    
    if (bestLag === 0) {
      xData = rows.map(r => Number(r[col]) || 0);
      yData = rows.map(r => Number(r[target]) || 0);
    } else if (bestLag > 0) {
      for (let i = bestLag; i < rows.length; i++) {
        xData.push(Number(rows[i - bestLag][col]) || 0);
        yData.push(Number(rows[i][target]) || 0);
      }
    } else {
      const absLag = Math.abs(bestLag);
      for (let i = absLag; i < rows.length; i++) {
        xData.push(Number(rows[i][col]) || 0);
        yData.push(Number(rows[i - absLag][target]) || 0);
      }
    }
    
    return calculateOLS(xData, yData);
  }, [multiTargetModal, filteredDataset]);

  if (!dataset) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
        <div className="p-8 max-w-[1600px] mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5E5] p-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-[#FFBD59] to-[#FFD699] rounded-2xl flex items-center justify-center mx-auto mb-6">
                <TrendingUp size={40} className="text-white" />
              </div>
              <h3 className="text-[24px] font-bold text-[#333333] mb-3">No Data Available</h3>
              <p className="text-[15px] text-[#666666] mb-8">Load sample data to get started with cross-platform correlation analysis and discover insights across your marketing channels</p>
              <button
                onClick={loadSampleData}
                disabled={isLoadingSample}
                className="px-8 py-4 bg-gradient-to-r from-[#FFBD59] to-[#FFD699] text-[#333333] rounded-xl hover:shadow-lg transition font-semibold inline-flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingSample ? (
                  <>
                    <div className="w-5 h-5 border-2 border-[#333333] border-t-transparent rounded-full animate-spin" />
                    Loading Sample Data...
                  </>
                ) : (
                  <>
                    <Upload size={20} />
                    Load Sample Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      <div className="p-8 max-w-[1600px] mx-auto">
        {/* Configuration Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5E5] p-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Select Metrics */}
            <div className="lg:col-span-2" ref={metricsRef}>
              <label className="block text-[13px] font-semibold text-[#333333] mb-3">Select Metrics</label>
              <div className="border border-[#E5E5E5] rounded-xl overflow-hidden">
                <button
                  onClick={() => setMetricsExpanded(!metricsExpanded)}
                  className="w-full px-4 py-3 bg-[#FAFAFA] flex items-center justify-between hover:bg-[#F5F5F5] transition"
                >
                  <span className="text-[14px] text-[#666666]">
                    {targetVariables.length > 0 ? `${targetVariables.length} metric${targetVariables.length > 1 ? 's' : ''} selected` : 'Click to select metrics'}
                  </span>
                  <svg className={`w-4 h-4 text-[#999999] transition-transform ${metricsExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {metricsExpanded && (
                  <div className="p-4 bg-white border-t border-[#E5E5E5]">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Amazon */}
                      {Object.keys(metricsByPlatform.Amazon).map(category => (
                        metricsByPlatform.Amazon[category].length > 0 && (
                          <div key={`Amazon-${category}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <img src="/image_resources/amazon.jpg" alt="Amazon" className="w-5 h-5 rounded object-cover" />
                              <h4 className="text-[13px] font-semibold text-[#333333]">Amazon</h4>
                            </div>
                            <div className="space-y-2">
                              {metricsByPlatform.Amazon[category].map((c) => (
                                <label
                                  key={c.name}
                                  className="flex items-center gap-2.5 cursor-pointer hover:bg-[#FFF8ED] px-3 py-2 rounded-lg transition group"
                                >
                                  <input
                                    type="checkbox"
                                    checked={targetVariables.includes(c.name)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setTargetVariables(prev => [...prev, c.name]);
                                      } else {
                                        setTargetVariables(prev => prev.filter(x => x !== c.name));
                                      }
                                    }}
                                    className="w-4 h-4 rounded border-[#E5E5E5] text-[#FF9500] focus:ring-[#FF9500] focus:ring-offset-0"
                                  />
                                  <span className="text-[13px] text-[#555555] group-hover:text-[#333333]">
                                    {formatColumnName(c.name)}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      ))}

                      {/* Shopify */}
                      {Object.keys(metricsByPlatform.Shopify).map(category => (
                        metricsByPlatform.Shopify[category].length > 0 && (
                          <div key={`Shopify-${category}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <img src="/image_resources/shopify.jpg" alt="Shopify" className="w-5 h-5 rounded object-cover" />
                              <h4 className="text-[13px] font-semibold text-[#333333]">Shopify</h4>
                            </div>
                            <div className="space-y-2">
                              {metricsByPlatform.Shopify[category].map((c) => (
                                <label
                                  key={c.name}
                                  className="flex items-center gap-2.5 cursor-pointer hover:bg-[#E8F8F0] px-3 py-2 rounded-lg transition group"
                                >
                                  <input
                                    type="checkbox"
                                    checked={targetVariables.includes(c.name)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setTargetVariables(prev => [...prev, c.name]);
                                      } else {
                                        setTargetVariables(prev => prev.filter(x => x !== c.name));
                                      }
                                    }}
                                    className="w-4 h-4 rounded border-[#E5E5E5] text-[#2D8A4E] focus:ring-[#2D8A4E] focus:ring-offset-0"
                                  />
                                  <span className="text-[13px] text-[#555555] group-hover:text-[#333333]">
                                    {formatColumnName(c.name)}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Selected Tags */}
              {targetVariables.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {targetVariables.map(v => (
                    <span key={v} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#FFBD59] to-[#FFD699] text-[#333333] rounded-full text-[12px] font-medium shadow-sm">
                      {formatColumnName(v)}
                      <button onClick={() => setTargetVariables(prev => prev.filter(x => x !== v))} className="hover:text-[#666666] ml-0.5 text-[16px] leading-none">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Analysis Mode */}
            <div>
              <label className="block text-[13px] font-semibold text-[#333333] mb-3">Analysis Mode</label>
              <div className="space-y-2">
                <button
                  onClick={() => setCorrelationMode("lag")}
                  className={`w-full px-4 py-3 text-[13px] font-medium transition rounded-xl text-left flex items-center gap-2 ${
                    correlationMode === "lag" 
                      ? "bg-gradient-to-r from-[#FFBD59] to-[#FFD699] text-[#333333] shadow-sm" 
                      : "bg-[#F8F9FA] text-[#666666] hover:bg-[#E9ECEF]"
                  }`}
                >
                  <TrendingUp size={16} />
                  Lag Analysis
                </button>
                <button
                  onClick={() => setCorrelationMode("rolling")}
                  className={`w-full px-4 py-3 text-[13px] font-medium transition rounded-xl text-left flex items-center gap-2 ${
                    correlationMode === "rolling" 
                      ? "bg-gradient-to-r from-[#41C185] to-[#5DD39E] text-white shadow-sm" 
                      : "bg-[#F8F9FA] text-[#666666] hover:bg-[#E9ECEF]"
                  }`}
                >
                  <BarChart3 size={16} />
                  Rolling Sum
                </button>
              </div>
            </div>

            {/* Parameters */}
            <div>
              <label className="block text-[13px] font-semibold text-[#333333] mb-3">
                {correlationMode === "lag" ? "Lag Range" : "Rolling Window"}
              </label>
              {correlationMode === "lag" ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] text-[#999999] mb-1">Min Lag</label>
                    <input
                      type="number"
                      value={lagMin}
                      onChange={(e) => setLagMin(Math.min(Number(e.target.value), lagMax - 1))}
                      className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2.5 text-[13px] focus:ring-2 focus:ring-[#FFBD59] focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#999999] mb-1">Max Lag</label>
                    <input
                      type="number"
                      value={lagMax}
                      onChange={(e) => setLagMax(Math.max(Number(e.target.value), lagMin + 1))}
                      className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2.5 text-[13px] focus:ring-2 focus:ring-[#FFBD59] focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="number"
                    min={2}
                    max={52}
                    value={rollingWindow}
                    onChange={(e) => setRollingWindow(Math.max(2, Math.min(52, Number(e.target.value))))}
                    className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2.5 text-[13px] focus:ring-2 focus:ring-[#41C185] focus:border-transparent outline-none"
                  />
                  <p className="text-[11px] text-[#999999] mt-1.5">Number of periods to sum</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter by Platform */}
        {targetVariables.length > 0 && (
          <div className="bg-white rounded-3xl shadow-md border border-slate-100 px-8 py-6 mb-6">
            <div className="flex items-center justify-between gap-8">
              {/* Platform Filter */}
              <div className="flex items-center gap-6">
                <span className="text-sm font-medium text-slate-500">Platform:</span>
                <div className="flex items-center gap-3 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-full px-5 py-2.5 shadow-inner border border-slate-200/50">
                  <button
                    onClick={() => setSelectedPlatform("All")}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <span className="text-base font-medium">All</span>
                  </button>
                  {[
                    { name: "Meta", img: "/image_resources/meta ads.jpg" },
                    { name: "Shopify", img: "/image_resources/shopify.jpg" },
                    { name: "Amazon", img: "/image_resources/amazon.jpg" },
                    { name: "Google", img: "/image_resources/google_ads.jpg" }
                  ].map((platform) => (
                    <button
                      key={platform.name}
                      onClick={() => setSelectedPlatform(platform.name)}
                      title={platform.name}
                      className={`px-5 py-3 rounded-2xl transition-all ${
                        selectedPlatform === platform.name
                          ? "bg-gradient-to-br from-cyan-50 to-cyan-100/80 border-2 border-cyan-300 shadow-lg" 
                          : "bg-white/50 hover:bg-white border-2 border-transparent hover:shadow-md"
                      }`}
                    >
                      <img src={platform.img} alt={platform.name} className="w-8 h-8 object-contain" />
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Date Range Filter */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-500">Date Range:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    min="2025-01-01"
                    max={endDate}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="date"
                    min={startDate}
                    max="2025-11-15"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
              </div>
              
              {/* Show Only Positive */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={showOnlyPositive} 
                    onChange={(e) => setShowOnlyPositive(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-0"
                  />
                  <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800">Show only positive</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Results Tables */}
        {multiTargetAnalysis && targetVariables.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
                selectedPlatform={selectedPlatform}
              />
            ))}
          </div>
        )}

        {targetVariables.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5E5] p-12 text-center">
            <TrendingUp size={48} className="mx-auto mb-4 text-[#CCCCCC]" />
            <h3 className="text-[18px] font-semibold text-[#333333] mb-2">No Metrics Selected</h3>
            <p className="text-[14px] text-[#999999]">Select sales or performance metrics above to see correlation analysis</p>
          </div>
        )}

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
                <div className="flex-1">
                  <h3 className="text-[20px] font-bold text-[#333333] mb-3">{formatColumnName(multiTargetModal.target)} vs {formatColumnName(multiTargetModal.col)}</h3>
                  
                  {/* Statistics Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Correlation Card */}
                    <div className="bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF] rounded-lg p-3 border border-[#E5E5E5]">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-[#458EE2]"></div>
                        <span className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">Correlation</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-[20px] font-bold font-mono ${
                          Math.abs(multiTargetModal.r) > 0.7 
                            ? multiTargetModal.r > 0 ? "text-[#2D8A4E]" : "text-[#DC2626]"
                            : "text-[#B8860B]"
                        }`}>
                          {multiTargetModal.r.toFixed(3)}
                        </span>
                        {multiTargetModal.bestLag !== 0 && (
                          <span className="text-[12px] text-[#458EE2] font-medium">
                            lag {multiTargetModal.bestLag > 0 ? `+${multiTargetModal.bestLag}` : multiTargetModal.bestLag}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#999999] mt-1">Strength of relationship</p>
                    </div>

                    {/* Elasticity Card */}
                    {olsResults && (
                      <div className="bg-gradient-to-br from-[#FFF8ED] to-[#FFF2DF] rounded-lg p-3 border border-[#FFE5B4]">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-[#FFBD59]"></div>
                          <span className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">Elasticity</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[20px] font-bold font-mono text-[#FF9500]">
                            {olsResults.elasticity.toFixed(4)}
                          </span>
                          <span className="text-[14px] text-[#999999]">
                            {olsResults.elasticity > 0 ? '↑' : '↓'}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#999999] mt-1">
                          Log-log regression coefficient
                        </p>
                      </div>
                    )}

                    {/* P-Value Card */}
                    {olsResults && (
                      <div className={`rounded-lg p-3 border ${
                        olsResults.pValue < 0.05 
                          ? 'bg-gradient-to-br from-[#E8F8F0] to-[#D4F4E7] border-[#B8E6D5]' 
                          : 'bg-gradient-to-br from-[#FEE2E2] to-[#FECACA] border-[#FCA5A5]'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${olsResults.pValue < 0.05 ? 'bg-[#2D8A4E]' : 'bg-[#DC2626]'}`}></div>
                          <span className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">Significance</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-[20px] font-bold font-mono`} style={{ color: formatPValue(olsResults.pValue).color }}>
                            {formatPValue(olsResults.pValue).text}
                          </span>
                          <span className={`text-[16px] font-bold`} style={{ color: formatPValue(olsResults.pValue).color }}>
                            {formatPValue(olsResults.pValue).stars}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#999999] mt-1">
                          {olsResults.pValue < 0.001 ? 'Highly significant' : 
                           olsResults.pValue < 0.01 ? 'Very significant' :
                           olsResults.pValue < 0.05 ? 'Significant' : 'Not significant'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Info Banner */}
                  {olsResults && (
                    <div className="mt-3 bg-[#F0F7FF] border border-[#B8DAFF] rounded-lg px-3 py-2 flex items-start gap-2">
                      <svg className="w-4 h-4 text-[#458EE2] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-[11px] text-[#2C5282] leading-relaxed">
                          <span className="font-semibold">Interpretation:</span> Elasticity of <span className="font-bold text-[#FF9500]">{olsResults.elasticity.toFixed(4)}</span> means 
                          a 1% increase in <span className="font-medium">{formatColumnName(multiTargetModal.col)}</span> leads to 
                          a <span className="font-bold text-[#FF9500]">{Math.abs(olsResults.elasticity).toFixed(4)}%</span> {olsResults.elasticity > 0 ? 'increase' : 'decrease'} in <span className="font-medium">{formatColumnName(multiTargetModal.target)}</span>.
                          {olsResults.pValue < 0.05 ? (
                            <span className="text-[#2D8A4E] font-medium"> This relationship is statistically reliable (p {formatPValue(olsResults.pValue).text}).</span>
                          ) : (
                            <span className="text-[#DC2626] font-medium"> This relationship may be due to chance (p = {formatPValue(olsResults.pValue).text}).</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={() => setMultiTargetModal(null)} 
                  className="p-2 hover:bg-[#F5F5F5] rounded-lg transition ml-4 flex-shrink-0"
                >
                  <X size={22} className="text-[#666666]" />
                </button>
              </div>
              
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
                    {olsResults && (
                      <p className="font-medium text-[#458EE2]">R² = {olsResults.rSquared.toFixed(3)} • β = {olsResults.beta.toFixed(4)}</p>
                    )}
                    <p className="text-[#999999]">-lag = {formatColumnName(multiTargetModal.target)} leads • +lag = {formatColumnName(multiTargetModal.col)} leads</p>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
