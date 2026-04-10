import { useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { TrendingUp, Calendar, Filter } from "lucide-react";
import { useStore } from "../store/useStore";
import { SaveButton } from "./SaveToReportModal";

interface TimeSeriesSectionProps {
  dataset: { rows: Record<string, unknown>[]; columns: { name: string; type: string }[] };
}

// Simple Moving Average
function calculateSMA(data: number[], window: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / window);
    }
  }
  return result;
}

// Exponential Moving Average
function calculateEMA(data: number[], window: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (window + 1);
  
  // Start with SMA for first value
  let ema = data.slice(0, window).reduce((a, b) => a + b, 0) / window;
  
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(null);
    } else if (i === window - 1) {
      result.push(ema);
    } else {
      ema = (data[i] - ema) * multiplier + ema;
      result.push(ema);
    }
  }
  return result;
}

// Trend decomposition using moving average
function decomposeTimeSeries(data: number[], period: number) {
  const n = data.length;
  
  // Calculate trend using centered moving average
  const trend: (number | null)[] = new Array(n).fill(null);
  const halfPeriod = Math.floor(period / 2);
  
  for (let i = halfPeriod; i < n - halfPeriod; i++) {
    let sum = 0;
    for (let j = i - halfPeriod; j <= i + halfPeriod; j++) {
      sum += data[j];
    }
    trend[i] = sum / period;
  }
  
  // Calculate seasonal component
  const seasonal: (number | null)[] = new Array(n).fill(null);
  const seasonalAverages: number[] = new Array(period).fill(0);
  const seasonalCounts: number[] = new Array(period).fill(0);
  
  for (let i = 0; i < n; i++) {
    if (trend[i] !== null) {
      const seasonIdx = i % period;
      seasonalAverages[seasonIdx] += data[i] - trend[i]!;
      seasonalCounts[seasonIdx]++;
    }
  }
  
  for (let i = 0; i < period; i++) {
    if (seasonalCounts[i] > 0) {
      seasonalAverages[i] /= seasonalCounts[i];
    }
  }
  
  // Normalize seasonal component to sum to zero
  const seasonalMean = seasonalAverages.reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period; i++) {
    seasonalAverages[i] -= seasonalMean;
  }
  
  // Apply seasonal pattern
  for (let i = 0; i < n; i++) {
    seasonal[i] = seasonalAverages[i % period];
  }
  
  // Calculate residual
  const residual: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (trend[i] !== null) {
      residual[i] = data[i] - trend[i]! - seasonal[i]!;
    }
  }
  
  return { trend, seasonal, residual };
}



export function TimeSeriesSection({ dataset }: TimeSeriesSectionProps) {
  const numericCols = dataset.columns.filter(c => c.type === "numeric");
  const allCols = dataset.columns;
  const categoricalCols = dataset.columns.filter(c => c.type === "categorical");
  
  const { timeSeriesState, updateTimeSeriesState } = useStore();
  
  // Refs for saving
  const mainChartRef = useRef<HTMLDivElement>(null);
  const decompositionRef = useRef<HTMLDivElement>(null);
  const {
    timeCol,
    valueCol,
    smaWindow,
    emaWindow,
    seasonalPeriod,
    showSMA,
    showEMA,
    showDecomposition,
    filterCatCol,
    filterCatValue,
  } = timeSeriesState;
  
  const setTimeCol = (val: string) => updateTimeSeriesState({ timeCol: val });
  const setValueCol = (val: string) => updateTimeSeriesState({ valueCol: val });
  const setSmaWindow = (val: number) => updateTimeSeriesState({ smaWindow: val });
  const setEmaWindow = (val: number) => updateTimeSeriesState({ emaWindow: val });
  const setSeasonalPeriod = (val: number) => updateTimeSeriesState({ seasonalPeriod: val });
  const setShowSMA = (val: boolean) => updateTimeSeriesState({ showSMA: val });
  const setShowEMA = (val: boolean) => updateTimeSeriesState({ showEMA: val });
  const setShowDecomposition = (val: boolean) => updateTimeSeriesState({ showDecomposition: val });
  const setFilterCatCol = (val: string) => updateTimeSeriesState({ filterCatCol: val });
  const setFilterCatValue = (val: string) => updateTimeSeriesState({ filterCatValue: val });
  
  // Filter data
  const filteredRows = useMemo(() => {
    let rows = dataset.rows;
    
    // Category filter
    if (filterCatCol && filterCatValue) {
      rows = rows.filter(r => String(r[filterCatCol]) === filterCatValue);
    }
    
    return rows;
  }, [dataset, filterCatCol, filterCatValue]);
  
  // Get category filter values
  const catFilterValues = useMemo(() => {
    if (!filterCatCol) return [];
    const values = new Set(dataset.rows.map(r => String(r[filterCatCol] ?? "")));
    return Array.from(values).sort();
  }, [dataset, filterCatCol]);
  
  // Prepare time series data
  const timeSeriesData = useMemo(() => {
    if (!valueCol) return null;
    
    const values = filteredRows.map(row => Number(row[valueCol]) || 0);
    const timeValues = timeCol ? filteredRows.map(row => row[timeCol]) : filteredRows.map((_, i) => i);
    
    return { values, timeValues };
  }, [filteredRows, valueCol, timeCol]);
  
  // Calculate moving averages
  const movingAverages = useMemo(() => {
    if (!timeSeriesData) return null;
    
    const sma = calculateSMA(timeSeriesData.values, smaWindow);
    const ema = calculateEMA(timeSeriesData.values, emaWindow);
    
    return { sma, ema };
  }, [timeSeriesData, smaWindow, emaWindow]);
  
  // Decomposition
  const decomposition = useMemo(() => {
    if (!timeSeriesData || !showDecomposition) return null;
    
    return decomposeTimeSeries(timeSeriesData.values, seasonalPeriod);
  }, [timeSeriesData, seasonalPeriod, showDecomposition]);
  
  // Chart data for main view
  const mainChartData = useMemo(() => {
    if (!timeSeriesData || !movingAverages) return null;
    
    return timeSeriesData.timeValues.map((time, i) => ({
      time,
      value: timeSeriesData.values[i],
      sma: movingAverages.sma[i],
      ema: movingAverages.ema[i],
    }));
  }, [timeSeriesData, movingAverages]);
  
  // Decomposition chart data
  const decompositionChartData = useMemo(() => {
    if (!timeSeriesData || !decomposition) return null;
    
    return timeSeriesData.timeValues.map((time, i) => ({
      time,
      original: timeSeriesData.values[i],
      trend: decomposition.trend[i],
      seasonal: decomposition.seasonal[i],
      residual: decomposition.residual[i],
    }));
  }, [timeSeriesData, decomposition]);
  
  return (
    <div className="space-y-6">
      {/* Data Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-[#666666]" />
          <span className="text-[14px] font-semibold text-[#333333]">Data Filter</span>
          {(filterCatCol && filterCatValue) && (
            <span className="ml-auto text-[12px] bg-[#E8F8F0] text-[#41C185] px-3 py-1 rounded-full font-medium">
              {filteredRows.length} of {dataset.rows.length} rows
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-[12px] text-[#666666]">Category:</label>
            <select 
              value={filterCatCol} 
              onChange={(e) => { setFilterCatCol(e.target.value); setFilterCatValue(""); }}
              className="border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-[13px] bg-white min-w-[120px]"
            >
              <option value="">All data</option>
              {(categoricalCols.length > 0 ? categoricalCols : allCols).map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
            {filterCatCol && (
              <select 
                value={filterCatValue} 
                onChange={(e) => setFilterCatValue(e.target.value)}
                className="border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-[13px] bg-white min-w-[100px]"
              >
                <option value="">All</option>
                {catFilterValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
          </div>
          {(filterCatCol && filterCatValue) && (
            <button
              onClick={() => { setFilterCatCol(""); setFilterCatValue(""); }}
              className="text-[12px] text-[#EF4444] hover:text-[#DC2626]"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>
      
      {/* Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-5">
        <h3 className="text-[18px] font-semibold text-[#333333] mb-4">Time Series Configuration</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Variable Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[#666666] mb-2">
                <Calendar size={14} className="inline mr-1" />
                Time Column (optional)
              </label>
              <select
                value={timeCol}
                onChange={(e) => setTimeCol(e.target.value)}
                className="w-full border border-[#E5E5E5] rounded-lg px-4 py-2.5 text-[14px] bg-white"
              >
                <option value="">Use row index</option>
                {allCols.map(col => (
                  <option key={col.name} value={col.name}>{col.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-[13px] font-medium text-[#666666] mb-2">
                <TrendingUp size={14} className="inline mr-1" />
                Value Column
              </label>
              <select
                value={valueCol}
                onChange={(e) => setValueCol(e.target.value)}
                className="w-full border border-[#E5E5E5] rounded-lg px-4 py-2.5 text-[14px] bg-white"
              >
                <option value="">Select variable...</option>
                {numericCols.map(col => (
                  <option key={col.name} value={col.name}>{col.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Analysis Options */}
          <div className="space-y-3">
            <p className="text-[13px] font-medium text-[#666666] mb-2">Analysis Options</p>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showSMA}
                onChange={(e) => setShowSMA(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-[14px] text-[#333333]">Simple Moving Average (SMA)</span>
              <input
                type="number"
                min="2"
                max="50"
                value={smaWindow}
                onChange={(e) => setSmaWindow(Number(e.target.value))}
                className="ml-auto w-16 border border-[#E5E5E5] rounded px-2 py-1 text-[13px]"
                disabled={!showSMA}
              />
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showEMA}
                onChange={(e) => setShowEMA(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-[14px] text-[#333333]">Exponential Moving Average (EMA)</span>
              <input
                type="number"
                min="2"
                max="50"
                value={emaWindow}
                onChange={(e) => setEmaWindow(Number(e.target.value))}
                className="ml-auto w-16 border border-[#E5E5E5] rounded px-2 py-1 text-[13px]"
                disabled={!showEMA}
              />
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDecomposition}
                onChange={(e) => setShowDecomposition(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-[14px] text-[#333333]">Trend Decomposition</span>
              <input
                type="number"
                min="2"
                max="52"
                value={seasonalPeriod}
                onChange={(e) => setSeasonalPeriod(Number(e.target.value))}
                className="ml-auto w-16 border border-[#E5E5E5] rounded px-2 py-1 text-[13px]"
                placeholder="Period"
                disabled={!showDecomposition}
              />
            </label>
          </div>
        </div>
      </div>
      
      {!valueCol && (
        <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-12 text-center">
          <TrendingUp size={48} className="mx-auto mb-4 text-[#E5E5E5]" />
          <p className="text-[16px] text-[#999999]">Select a value column to start time series analysis</p>
        </div>
      )}
      
      {/* Main Time Series Chart */}
      {valueCol && mainChartData && (
        <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-semibold text-[#333333]">
              Time Series: {valueCol}
            </h3>
            {/* Custom Legend and Save Button */}
            <div className="flex flex-wrap gap-3 items-center">
              <SaveButton targetRef={mainChartRef as React.RefObject<HTMLElement>} title={`Time Series: ${valueCol}`} type="chart" />
              <div className="flex items-center gap-2 bg-[#FAFAFA] px-3 py-1.5 rounded-lg border border-[#E5E5E5]">
                <div className="w-6 h-0.5 bg-[#458EE2]" />
                <span className="text-[12px] font-medium text-[#333333]">Original</span>
              </div>
              {showSMA && (
                <div className="flex items-center gap-2 bg-[#FAFAFA] px-3 py-1.5 rounded-lg border border-[#E5E5E5]">
                  <div className="w-6 h-0.5 bg-[#FFBD59]" />
                  <span className="text-[12px] font-medium text-[#333333]">SMA({smaWindow})</span>
                </div>
              )}
              {showEMA && (
                <div className="flex items-center gap-2 bg-[#FAFAFA] px-3 py-1.5 rounded-lg border border-[#E5E5E5]">
                  <div className="w-6 h-0.5 bg-[#41C185]" />
                  <span className="text-[12px] font-medium text-[#333333]">EMA({emaWindow})</span>
                </div>
              )}

            </div>
          </div>
          <div ref={mainChartRef}>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={mainChartData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 11, fill: "#666666" }}
                  label={{ value: timeCol || "Index", position: "bottom", fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#666666" }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #E5E5E5" }} />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#458EE2" 
                  strokeWidth={2} 
                  dot={false}
                  name="Original"
                  connectNulls
                />
                {showSMA && (
                  <Line 
                    type="monotone" 
                    dataKey="sma" 
                    stroke="#FFBD59" 
                    strokeWidth={2} 
                    dot={false}
                    name={`SMA(${smaWindow})`}
                    connectNulls
                  />
                )}
                {showEMA && (
                  <Line 
                    type="monotone" 
                    dataKey="ema" 
                    stroke="#41C185" 
                    strokeWidth={2} 
                    dot={false}
                    name={`EMA(${emaWindow})`}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      
      {/* Decomposition */}
      {showDecomposition && decompositionChartData && (
        <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-semibold text-[#333333]">
              Trend Decomposition (Period: {seasonalPeriod})
            </h3>
            <SaveButton targetRef={decompositionRef as React.RefObject<HTMLElement>} title={`Decomposition: ${valueCol} (Period ${seasonalPeriod})`} type="chart" />
          </div>
          <div ref={decompositionRef} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Original */}
            <div className="border border-[#E5E5E5] rounded-lg p-3 bg-[#FAFAFA]">
              <h4 className="text-[13px] font-semibold text-[#333333] mb-2">Original Series</h4>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={decompositionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="original" stroke="#458EE2" fill="#458EE2" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            {/* Trend */}
            <div className="border border-[#E5E5E5] rounded-lg p-3 bg-[#FAFAFA]">
              <h4 className="text-[13px] font-semibold text-[#333333] mb-2">Trend Component</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={decompositionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="trend" stroke="#41C185" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Seasonal */}
            <div className="border border-[#E5E5E5] rounded-lg p-3 bg-[#FAFAFA]">
              <h4 className="text-[13px] font-semibold text-[#333333] mb-2">Seasonal Component</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={decompositionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="seasonal" stroke="#FFBD59" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Residual */}
            <div className="border border-[#E5E5E5] rounded-lg p-3 bg-[#FAFAFA]">
              <h4 className="text-[13px] font-semibold text-[#333333] mb-2">Residual Component</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={decompositionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="residual" stroke="#999999" strokeWidth={1} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      

    </div>
  );
}
