import { useState, useMemo, useRef } from "react";
import { Activity, AlertCircle, Loader2, BarChart3, TrendingUp, Download, Lock, Zap, LineChart as LineChartIcon } from "lucide-react";
import { useStore } from "../store/useStore";
import { runKalmanFilter } from "../services/api";
import { SaveButton } from "../components/SaveToReportModal";
import { LockedResults } from "../components/LockedResults";
import type { AdstockSettings, LogisticSettings } from "../services/api";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  BarChart,
  Scatter,
  ZAxis,
} from "recharts";

interface KalmanResult {
  predictions: number[];
  actuals: number[];
  metrics: Record<string, number>;
  coefficients: Record<string, number>;
  coefficients_instantaneous?: Record<string, number>;
  tv_coefficients: Record<string, number[]>;
  elasticities: Record<string, number>;
  contributions: Record<string, number>;
  q_history: number[];
  r_history: number[];
  adstock_decays?: Record<string, number>;
  logistic_metadata?: Record<string, Record<string, number>>;
}

interface LogisticMeta {
  median?: number;
  scale?: number;
  steepness?: number;
  midpoint?: number;
  min_raw?: number;
  max_raw?: number;
  mean_raw?: number;
  mean_transformed?: number;
  current_derivative?: number;
  max_derivative?: number;
  responsiveness?: number;
}

// Helper: Classify responsiveness
function classifyResponsiveness(value?: number): string {
  if (value === undefined || !isFinite(value)) return "—";
  if (value >= 0.7) return "High";
  if (value >= 0.3) return "Medium";
  if (value >= 0.1) return "Low";
  return "Very Low";
}

// Helper: Get responsiveness color
function getResponsivenessColor(value?: number): string {
  if (value === undefined || !isFinite(value)) return "text-gray-400";
  if (value >= 0.7) return "text-green-600";
  if (value >= 0.3) return "text-yellow-600";
  if (value >= 0.1) return "text-orange-600";
  return "text-red-600";
}

// Helper: Download data as CSV
function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map(row => headers.map(h => {
      const val = row[h];
      if (typeof val === "number") return val.toFixed(6);
      return String(val ?? "");
    }).join(","))
  ].join("\n");
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// S-Curve Visualization Component - REWRITTEN FROM SCRATCH
interface SCurveVisualizationProps {
  metadata: Record<string, Record<string, number>>;
}

function SCurveVisualization({ metadata }: SCurveVisualizationProps) {
  const [selectedVar, setSelectedVar] = useState<string>(Object.keys(metadata)[0] || "");
  
  const meta = metadata[selectedVar] as LogisticMeta | undefined;
  
  // Generate S-curve using NORMALIZED z-values (0-1 scale on X-axis)
  // This guarantees we always see the S-shape regardless of raw data scale
  const { curveData, xAxisLabel, meanZPosition } = useMemo(() => {
    if (!meta) return { curveData: [], xAxisLabel: "Normalized Position", meanZPosition: 0.5 };
    
    const median = meta.median ?? 0;
    const scale = meta.scale && meta.scale !== 0 ? Math.abs(meta.scale) : 1;
    const k = meta.steepness ?? 1;
    const midpoint = meta.midpoint ?? 0;
    
    // Generate curve in z-space from -4 to +4 (covers 2% to 98% of sigmoid)
    const points: { z: number; sigma: number; rawValue: number }[] = [];
    const zMin = -4;
    const zMax = 4;
    const numPoints = 100;
    
    for (let i = 0; i <= numPoints; i++) {
      const zNorm = zMin + (zMax - zMin) * (i / numPoints); // z relative to midpoint
      const z = zNorm + midpoint; // actual z value
      const arg = k * zNorm; // k * (z - midpoint)
      const clipped = Math.max(-60, Math.min(60, arg));
      const sigma = 1 / (1 + Math.exp(-clipped));
      const rawValue = median + scale * z;
      points.push({ z: zNorm, sigma, rawValue });
    }
    
    // Calculate mean position in z-space
    let meanZ = 0;
    if (meta.mean_raw !== undefined) {
      const zActual = (meta.mean_raw - median) / scale;
      meanZ = zActual - midpoint; // z relative to midpoint
    }
    
    return { 
      curveData: points, 
      xAxisLabel: `Normalized Position (z - ${midpoint.toFixed(1)})`,
      meanZPosition: meanZ
    };
  }, [meta]);
  
  // Mean point marker in z-space
  const meanPoint = useMemo(() => {
    if (!meta || meta.mean_raw === undefined) return null;
    const meanY = meta.mean_transformed ?? 0.5;
    return { z: meanZPosition, sigma: meanY };
  }, [meta, meanZPosition]);
  
  // Data range in z-space
  const dataRangeZ = useMemo(() => {
    if (!meta) return null;
    const median = meta.median ?? 0;
    const scale = meta.scale && meta.scale !== 0 ? Math.abs(meta.scale) : 1;
    const midpoint = meta.midpoint ?? 0;
    
    const minZ = meta.min_raw !== undefined ? (meta.min_raw - median) / scale - midpoint : -2;
    const maxZ = meta.max_raw !== undefined ? (meta.max_raw - median) / scale - midpoint : 2;
    
    return { minZ, maxZ };
  }, [meta]);
  
  // 70% responsiveness band in z-space (where sigma is between 0.21 and 0.79)
  // For sigma = 0.21: k*zNorm = ln(0.21/0.79) ≈ -1.32, so zNorm = -1.32/k
  // For sigma = 0.79: k*zNorm = ln(0.79/0.21) ≈ 1.32, so zNorm = 1.32/k
  const responsiveBandZ = useMemo(() => {
    if (!meta) return null;
    const k = meta.steepness ?? 1;
    const zLow = -1.32 / Math.max(k, 0.001);
    const zHigh = 1.32 / Math.max(k, 0.001);
    return { z1: zLow, z2: zHigh };
  }, [meta]);
  
  if (!meta || Object.keys(metadata).length === 0) {
    return (
      <div className="bg-yellow-50 rounded-xl p-4 text-yellow-700">
        No S-curve metadata available
      </div>
    );
  }
  
  if (curveData.length === 0) {
    return (
      <div className="bg-red-50 rounded-xl p-4 text-red-700">
        S-curve data could not be generated.
      </div>
    );
  }
  
  const responsiveness = meta.responsiveness;
  const status = classifyResponsiveness(responsiveness);
  const statusColor = getResponsivenessColor(responsiveness);
  
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <TrendingUp size={18} className="text-blue-500" /> S-Curve Transform Details
      </h4>
      
      {/* Variable Selector */}
      <div className="mb-4">
        <select
          value={selectedVar}
          onChange={(e) => setSelectedVar(e.target.value)}
          className="p-2 border rounded-lg text-sm"
        >
          {Object.keys(metadata).map((col) => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>
      
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500">Mean Raw Value</div>
          <div className="text-lg font-bold text-gray-800">
            {meta.mean_raw !== undefined ? meta.mean_raw.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500">Transformed (σ)</div>
          <div className="text-lg font-bold text-gray-800">
            {meta.mean_transformed !== undefined ? `${(meta.mean_transformed * 100).toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-xs text-gray-500">Responsiveness</div>
          <div className={`text-lg font-bold ${statusColor}`}>
            {responsiveness !== undefined ? `${(responsiveness * 100).toFixed(1)}%` : "—"}
          </div>
          <div className={`text-xs ${statusColor}`}>{status}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500">Steepness (k)</div>
          <div className="text-lg font-bold text-gray-800">
            {meta.steepness !== undefined ? meta.steepness.toFixed(2) : "—"}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500">Midpoint</div>
          <div className="text-lg font-bold text-gray-800">
            {meta.midpoint !== undefined ? meta.midpoint.toFixed(2) : "0"}
          </div>
        </div>
      </div>
      
      {/* S-Curve Chart - Using normalized z-space */}
      <div className="border rounded-lg p-2 bg-gray-50">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart 
            data={curveData} 
            margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
            <XAxis 
              dataKey="z" 
              type="number"
              domain={[-4, 4]}
              tick={{ fontSize: 10 }} 
              tickFormatter={(v) => v.toFixed(1)}
              label={{ value: xAxisLabel, position: 'bottom', offset: 0, fontSize: 11 }}
            />
            <YAxis 
              domain={[0, 1]} 
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              label={{ value: 'Response (σ)', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <ZAxis range={[120, 120]} />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === "sigma" || name === "S-Curve") return [`${(value * 100).toFixed(1)}%`, "Response"];
                return [value, name];
              }}
              labelFormatter={(label) => `z = ${Number(label).toFixed(2)}`}
            />
            
            {/* 70% Responsiveness Band */}
            {responsiveBandZ && (
              <ReferenceArea 
                x1={Math.max(-4, responsiveBandZ.z1)} 
                x2={Math.min(4, responsiveBandZ.z2)}
                y1={0.21}
                y2={0.79}
                fill="#22c55e" 
                fillOpacity={0.15}
                stroke="#22c55e"
                strokeOpacity={0.3}
              />
            )}
            
            {/* Main S-curve line */}
            <Line 
              type="monotone" 
              dataKey="sigma" 
              stroke="#2563eb" 
              strokeWidth={3} 
              dot={false} 
              name="S-Curve"
              isAnimationActive={false}
            />
            
            {/* Mean point marker */}
            {meanPoint && (
              <Scatter 
                data={[{ z: meanPoint.z, sigma: meanPoint.sigma }]} 
                dataKey="sigma"
                fill="#f97316" 
                name="Your Position"
                isAnimationActive={false}
                shape={(props: { cx?: number; cy?: number }) => (
                  <circle cx={props.cx} cy={props.cy} r={8} fill="#f97316" stroke="#fff" strokeWidth={2} />
                )}
              />
            )}
            
            {/* Data range indicators */}
            {dataRangeZ && (
              <>
                <ReferenceLine x={dataRangeZ.minZ} stroke="#6366f1" strokeDasharray="4 4" strokeWidth={2} />
                <ReferenceLine x={dataRangeZ.maxZ} stroke="#6366f1" strokeDasharray="4 4" strokeWidth={2} />
              </>
            )}
            
            {/* Inflection point (z=0) */}
            <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="5 5" />
            
            {/* 50% horizontal line */}
            <ReferenceLine y={0.5} stroke="#9ca3af" strokeDasharray="3 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-3 text-xs">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
          Your Position (Mean)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-6 h-3 bg-green-500/20 border border-green-500/30"></span>
          High Response Zone
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-4 border-t-2 border-dashed border-indigo-500"></span>
          Data Range
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-4 border-t border-dashed border-gray-400"></span>
          Inflection (50%)
        </span>
      </div>
      
      {/* Info box */}
      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>Reading the chart:</strong> The X-axis shows normalized position (z). 
        Your data ranges from z={dataRangeZ?.minZ.toFixed(1)} to z={dataRangeZ?.maxZ.toFixed(1)}. 
        The green zone is where small changes have the biggest impact.
        {meanPoint && (
          <span className="block mt-1">
            Current position: z={meanPoint.z.toFixed(2)} → {(meanPoint.sigma * 100).toFixed(1)}% response
          </span>
        )}
      </div>
      
      {/* Low responsiveness warning */}
      {responsiveness !== undefined && responsiveness < 0.3 && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          ⚠️ <strong>Low Responsiveness ({(responsiveness * 100).toFixed(0)}%):</strong> Your data is in the flat zone of the S-curve. 
          Consider adjusting steepness (k) to shift the responsive zone to your data range.
        </div>
      )}
      
      {/* Responsiveness Summary Table */}
      <div className="mt-4 border-t pt-4">
        <h5 className="text-sm font-semibold text-gray-600 mb-2 flex items-center justify-between">
          <span>Responsiveness Overview</span>
          <span className="text-xs text-gray-400 font-normal">{Object.keys(metadata).length} variables</span>
        </h5>
        <div className="overflow-auto border rounded-lg" style={{ maxHeight: 250 }}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left p-2">Variable</th>
                <th className="text-right p-2">Steepness (k)</th>
                <th className="text-right p-2">Responsiveness</th>
                <th className="text-right p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metadata).map(([col, m]) => {
                const colMeta = m as LogisticMeta;
                const resp = colMeta.responsiveness;
                const colStatus = classifyResponsiveness(resp);
                const colColor = getResponsivenessColor(resp);
                return (
                  <tr key={col} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium truncate max-w-[200px]" title={col}>{col}</td>
                    <td className="p-2 text-right font-mono">{colMeta.steepness?.toFixed(2) ?? "—"}</td>
                    <td className="p-2 text-right font-mono">
                      {resp !== undefined ? `${(resp * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className={`p-2 text-right font-semibold ${colColor}`}>{colStatus}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function KalmanStudio() {
  const { dataset, kalmanState, updateKalmanState } = useStore();
  
  // Use persisted state from store
  const targetColumn = kalmanState.targetCol;
  const featureColumns = kalmanState.featureCols;
  const q = String(kalmanState.q);
  const r = String(kalmanState.r);
  const adaptive = kalmanState.adaptive;
  const standardize = kalmanState.standardize;
  const nonPositiveFeatures = kalmanState.nonPositiveFeatures;
  const nonNegativeFeatures = kalmanState.nonNegativeFeatures;
  const adstockEnabled = kalmanState.adstockEnabled;
  const adstockColumns = kalmanState.adstockCols;
  const adstockDecay = String(kalmanState.adstockDecay);
  const adstockAuto = kalmanState.adstockAuto;
  const logisticEnabled = kalmanState.scurveEnabled;
  const logisticColumns = kalmanState.scurveCols;
  const logisticSteepness = String(kalmanState.scurveSteepness);
  const logisticMidpoint = String(kalmanState.scurveMidpoint);
  const logisticAuto = kalmanState.scurveAuto;
  
  // Setters that update the store
  const setTargetColumn = (val: string) => updateKalmanState({ targetCol: val });
  const setFeatureColumns = (val: string[] | ((prev: string[]) => string[])) => {
    if (typeof val === 'function') {
      updateKalmanState({ featureCols: val(kalmanState.featureCols) });
    } else {
      updateKalmanState({ featureCols: val });
    }
  };
  const setQ = (val: string) => updateKalmanState({ q: parseFloat(val) || 0.0001 });
  const setR = (val: string) => updateKalmanState({ r: parseFloat(val) || 1.0 });
  const setAdaptive = (val: boolean) => updateKalmanState({ adaptive: val });
  const setStandardize = (val: boolean) => updateKalmanState({ standardize: val });
  const setNonPositiveFeatures = (val: string[] | ((prev: string[]) => string[])) => {
    if (typeof val === 'function') {
      updateKalmanState({ nonPositiveFeatures: val(kalmanState.nonPositiveFeatures) });
    } else {
      updateKalmanState({ nonPositiveFeatures: val });
    }
  };
  const setNonNegativeFeatures = (val: string[] | ((prev: string[]) => string[])) => {
    if (typeof val === 'function') {
      updateKalmanState({ nonNegativeFeatures: val(kalmanState.nonNegativeFeatures) });
    } else {
      updateKalmanState({ nonNegativeFeatures: val });
    }
  };
  const setAdstockEnabled = (val: boolean) => updateKalmanState({ adstockEnabled: val });
  const setAdstockColumns = (val: string[] | ((prev: string[]) => string[])) => {
    if (typeof val === 'function') {
      updateKalmanState({ adstockCols: val(kalmanState.adstockCols) });
    } else {
      updateKalmanState({ adstockCols: val });
    }
  };
  const setAdstockDecay = (val: string) => updateKalmanState({ adstockDecay: parseFloat(val) || 0.5 });
  const setAdstockAuto = (val: boolean) => updateKalmanState({ adstockAuto: val });
  const setLogisticEnabled = (val: boolean) => updateKalmanState({ scurveEnabled: val });
  const setLogisticColumns = (val: string[] | ((prev: string[]) => string[])) => {
    if (typeof val === 'function') {
      updateKalmanState({ scurveCols: val(kalmanState.scurveCols) });
    } else {
      updateKalmanState({ scurveCols: val });
    }
  };
  const setLogisticSteepness = (val: string) => updateKalmanState({ scurveSteepness: parseFloat(val) || 1.0 });
  const setLogisticMidpoint = (val: string) => updateKalmanState({ scurveMidpoint: parseFloat(val) || 0.5 });
  const setLogisticAuto = (val: boolean) => updateKalmanState({ scurveAuto: val });
  
  // Local UI state (not persisted)
  const [timeColumn, setTimeColumn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCoef, setSelectedCoef] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"results" | "advanced">("results");
  // Refs for saving charts
  const actualVsPredRef = useRef<HTMLDivElement>(null);
  const contributionsRef = useRef<HTMLDivElement>(null);

  // Result from persisted state - with safety checks
  const result: KalmanResult | null = kalmanState.results && kalmanState.results.predictions?.length > 0 ? {
    predictions: kalmanState.results.predictions || [],
    actuals: kalmanState.results.actuals || [],
    metrics: kalmanState.results.metrics || { r2: 0, mape: 0, mae: 0 },
    coefficients: kalmanState.results.coefficients || {},
    coefficients_instantaneous: kalmanState.results.coefficientsInstantaneous || kalmanState.results.coefficients || {},
    tv_coefficients: kalmanState.results.tvCoefficients || {},
    elasticities: kalmanState.results.elasticities || {},
    contributions: kalmanState.results.contributions || {},
    q_history: kalmanState.results.qHistory || [],
    r_history: kalmanState.results.rHistory || [],
    adstock_decays: kalmanState.results.adstockDecays || undefined,
    logistic_metadata: kalmanState.results.logisticMetadata as Record<string, Record<string, number>> | undefined,
  } : null;

  const numericColumns = dataset?.columns.filter((c) => c.type === "numeric").map((c) => c.name) || [];
  const allColumns = dataset?.columns.map((c) => c.name) || [];

  const handleFeatureToggle = (col: string) => {
    setFeatureColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  };

  const selectAllFeatures = () => {
    setFeatureColumns(numericColumns.filter((c) => c !== targetColumn));
  };

  const clearFeatures = () => setFeatureColumns([]);

  const runKalman = async () => {
    if (!dataset || !targetColumn || featureColumns.length === 0) {
      setError("Please select target and at least one feature column");
      return;
    }
    setLoading(true);
    setError(null);
    updateKalmanState({ results: null, hasRun: false });

    // Build adstock settings
    const adstockSettings: AdstockSettings | undefined = adstockEnabled && adstockColumns.length > 0
      ? {
          enabled: true,
          columns: adstockColumns,
          decay: parseFloat(adstockDecay) || 0.5,
          auto: adstockAuto,
          candidate_decays: adstockAuto ? [0.2, 0.4, 0.6, 0.8] : undefined,
        }
      : undefined;

    // Build logistic settings
    const logisticSettings: LogisticSettings | undefined = logisticEnabled && logisticColumns.length > 0
      ? {
          enabled: true,
          columns: logisticColumns,
          steepness: parseFloat(logisticSteepness) || 1.0,
          midpoint: parseFloat(logisticMidpoint) || 0.0,
          auto: logisticAuto,
          candidate_k: logisticAuto ? [0.5, 1.0, 2.0, 3.0] : undefined,
        }
      : undefined;

    const res = await runKalmanFilter({
      data: dataset.rows,
      target_column: targetColumn,
      feature_columns: featureColumns,
      q: parseFloat(q) || 0.0001,
      r: parseFloat(r) || 1.0,
      adaptive,
      standardize,
      non_positive_features: nonPositiveFeatures.length > 0 ? nonPositiveFeatures : undefined,
      non_negative_features: nonNegativeFeatures.length > 0 ? nonNegativeFeatures : undefined,
      adstock_settings: adstockSettings,
      logistic_settings: logisticSettings,
    });
    
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      // Save results to persisted store
      updateKalmanState({
        results: {
          predictions: res.data.predictions,
          actuals: res.data.actuals,
          metrics: res.data.metrics as { r2: number; mape: number; mae: number },
          coefficients: res.data.coefficients,
          coefficientsInstantaneous: res.data.coefficients_instantaneous || res.data.coefficients,
          tvCoefficients: res.data.tv_coefficients,
          elasticities: res.data.elasticities,
          contributions: res.data.contributions,
          qHistory: res.data.q_history,
          rHistory: res.data.r_history,
          adstockDecays: res.data.adstock_decays || null,
          logisticMetadata: res.data.logistic_metadata || null,
        },
        hasRun: true,
      });
      // Select first feature by default for TV plot
      if (featureColumns.length > 0) {
        setSelectedCoef(featureColumns[0]);
      }
    }
  };

  // Chart data
  const actualVsPredictedData = useMemo(() => {
    if (!result) return [];
    return result.predictions.map((pred, i) => ({
      index: i + 1,
      timeLabel: timeColumn && dataset ? String(dataset.rows[i]?.[timeColumn] ?? i + 1) : String(i + 1),
      actual: result.actuals[i],
      predicted: pred,
      residual: result.actuals[i] - pred,
    }));
  }, [result, timeColumn, dataset]);

  // Time-varying coefficient data
  const tvCoefData = useMemo(() => {
    if (!result || !selectedCoef || !result.tv_coefficients[selectedCoef]) return [];
    return result.tv_coefficients[selectedCoef].map((val, i) => ({
      index: i + 1,
      timeLabel: timeColumn && dataset ? String(dataset.rows[i]?.[timeColumn] ?? i + 1) : String(i + 1),
      coefficient: val,
    }));
  }, [result, selectedCoef, timeColumn, dataset]);

  const contributionData = useMemo(() => {
    if (!result?.coefficients) return [];
    return Object.entries(result.coefficients)
      .filter(([key]) => key !== "Intercept")
      .map(([feature, coef]) => ({
        feature: feature.length > 15 ? feature.slice(0, 15) + "…" : feature,
        fullName: feature,
        coefficient: coef,
        elasticity: result.elasticities?.[feature] ?? 0,
        contribution: result.contributions?.[feature] ?? 0,
        absContribution: Math.abs(result.contributions?.[feature] ?? 0),
      }))
      .sort((a, b) => b.absContribution - a.absContribution);
  }, [result]);

  if (!dataset) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-gray-500">
        <Activity size={48} className="mb-4 opacity-50" />
        <p className="text-lg">Upload data first to use Kalman Filter</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Activity className="text-[#10b981]" /> Kalman Filter Studio
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel - Configuration */}
        <div className="col-span-12 lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm p-5 sticky top-0">
            <h3 className="font-semibold text-gray-700 mb-4">Kalman Configuration</h3>

            {/* Target Column */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">Target Variable (Y)</label>
              <select
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
              >
                <option value="">Select target...</option>
                {numericColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {/* Time Column */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">Time Column (X-axis)</label>
              <select
                value={timeColumn}
                onChange={(e) => setTimeColumn(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
              >
                <option value="">Index (1, 2, 3...)</option>
                {allColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {/* Kalman Parameters */}
            <div className="mb-4 p-3 bg-emerald-50 rounded-lg">
              <label className="block text-sm font-medium text-emerald-700 mb-2">⚙️ Kalman Parameters</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Q (Process Noise)</label>
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="w-full p-1.5 text-sm border rounded focus:ring-1 focus:ring-[#10b981]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">R (Measurement Noise)</label>
                  <input
                    type="text"
                    value={r}
                    onChange={(e) => setR(e.target.value)}
                    className="w-full p-1.5 text-sm border rounded focus:ring-1 focus:ring-[#10b981]"
                  />
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adaptive}
                    onChange={(e) => setAdaptive(e.target.checked)}
                    className="rounded text-[#10b981] focus:ring-[#10b981]"
                  />
                  Adaptive Q & R
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={standardize}
                    onChange={(e) => setStandardize(e.target.checked)}
                    className="rounded text-[#10b981] focus:ring-[#10b981]"
                  />
                  Standardize Features
                </label>
              </div>
            </div>

            {/* Feature Columns */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-600">Features (X)</label>
                <span className="text-xs text-gray-400">{featureColumns.length} selected</span>
              </div>
              <div className="flex gap-1 mb-2">
                <button onClick={selectAllFeatures} className="text-xs text-emerald-600 hover:underline">Select All</button>
                <span className="text-gray-300">|</span>
                <button onClick={clearFeatures} className="text-xs text-emerald-600 hover:underline">Clear</button>
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                {numericColumns.filter((c) => c !== targetColumn).map((col) => (
                  <label key={col} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featureColumns.includes(col)}
                      onChange={() => handleFeatureToggle(col)}
                      className="rounded text-[#10b981] focus:ring-[#10b981]"
                    />
                    <span className="text-sm truncate" title={col}>{col}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Coefficient Constraints */}
            {featureColumns.length > 0 && (
              <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                <label className="block text-sm font-medium text-purple-700 mb-2">⚙️ Coefficient Constraints</label>
                <p className="text-xs text-purple-500 mb-2">Uses Mahalanobis projection</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {featureColumns.map((col) => (
                    <div key={col} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 truncate" title={col}>{col}</span>
                      <select
                        value={
                          nonPositiveFeatures.includes(col) ? "negative" :
                          nonNegativeFeatures.includes(col) ? "positive" : "any"
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          setNonPositiveFeatures((prev) => prev.filter((f) => f !== col));
                          setNonNegativeFeatures((prev) => prev.filter((f) => f !== col));
                          if (val === "negative") setNonPositiveFeatures((prev) => [...prev, col]);
                          if (val === "positive") setNonNegativeFeatures((prev) => [...prev, col]);
                        }}
                        className="p-1 text-xs border rounded"
                      >
                        <option value="any">Any</option>
                        <option value="positive">≥ 0</option>
                        <option value="negative">≤ 0</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Adstock Transformation */}
            {featureColumns.length > 0 && (
              <div className="mb-4 p-3 bg-orange-50 rounded-lg">
                <label className="flex items-center gap-2 text-sm font-medium text-orange-700 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adstockEnabled}
                    onChange={(e) => setAdstockEnabled(e.target.checked)}
                    className="rounded text-orange-500 focus:ring-orange-500"
                  />
                  <Zap size={14} /> Adstock (Carryover)
                </label>
                {adstockEnabled && (
                  <>
                    <p className="text-xs text-orange-500 mb-2">x[t] = x[t] + λ·x[t-1]</p>
                    <div className="mb-2">
                      <label className="text-xs text-gray-500">Decay (λ)</label>
                      <input
                        type="text"
                        value={adstockDecay}
                        onChange={(e) => setAdstockDecay(e.target.value)}
                        className="w-full p-1.5 text-sm border rounded focus:ring-1 focus:ring-orange-500"
                        placeholder="0.5"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={adstockAuto}
                        onChange={(e) => setAdstockAuto(e.target.checked)}
                        className="rounded text-orange-500 focus:ring-orange-500"
                      />
                      Auto-select best decay
                    </label>
                    <div className="text-xs text-gray-500 mb-1">Apply to columns:</div>
                    <div className="max-h-24 overflow-y-auto border rounded p-1 bg-white">
                      {featureColumns.map((col) => (
                        <label key={col} className="flex items-center gap-1 p-0.5 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={adstockColumns.includes(col)}
                            onChange={() => setAdstockColumns((prev) =>
                              prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
                            )}
                            className="rounded text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs truncate">{col}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Logistic S-Curve Transformation */}
            {featureColumns.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <label className="flex items-center gap-2 text-sm font-medium text-blue-700 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={logisticEnabled}
                    onChange={(e) => setLogisticEnabled(e.target.checked)}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <TrendingUp size={14} /> Logistic S-Curve
                </label>
                {logisticEnabled && (
                  <>
                    <p className="text-xs text-blue-500 mb-2">σ(z) = 1/(1+e^(-k·z))</p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-xs text-gray-500">Steepness (k)</label>
                        <input
                          type="text"
                          value={logisticSteepness}
                          onChange={(e) => setLogisticSteepness(e.target.value)}
                          className="w-full p-1.5 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                          placeholder="1.0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Midpoint</label>
                        <input
                          type="text"
                          value={logisticMidpoint}
                          onChange={(e) => setLogisticMidpoint(e.target.value)}
                          className="w-full p-1.5 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                          placeholder="0.0"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={logisticAuto}
                        onChange={(e) => setLogisticAuto(e.target.checked)}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      Auto-select best steepness
                    </label>
                    <div className="text-xs text-gray-500 mb-1">Apply to columns:</div>
                    <div className="max-h-24 overflow-y-auto border rounded p-1 bg-white">
                      {featureColumns.map((col) => (
                        <label key={col} className="flex items-center gap-1 p-0.5 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={logisticColumns.includes(col)}
                            onChange={() => setLogisticColumns((prev) =>
                              prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
                            )}
                            className="rounded text-blue-500 focus:ring-blue-500"
                          />
                          <span className="text-xs truncate">{col}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              onClick={runKalman}
              disabled={true}
              className="w-full py-3 bg-gray-400 text-white font-semibold rounded-lg cursor-not-allowed flex items-center justify-center gap-2 opacity-60"
              title="Contact administrator for access"
            >
              <Lock size={18} />
              Run Kalman Filter (Locked)
            </button>
            
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          {!result && !loading && (
            <LockedResults feature="Kalman Filter" />
          )}

          {loading && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Loader2 size={48} className="mx-auto mb-4 animate-spin text-[#10b981]" />
              <p className="text-gray-600">Running Kalman Filter...</p>
            </div>
          )}

          {result && (
            <>
              {/* TAB NAVIGATION */}
              <div className="flex border-b border-gray-200 mb-4">
                <button
                  onClick={() => setActiveTab("results")}
                  className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === "results"
                      ? "border-[#10b981] text-[#10b981]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  📊 Results
                </button>
                <button
                  onClick={() => setActiveTab("advanced")}
                  className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === "advanced"
                      ? "border-[#10b981] text-[#10b981]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  🔬 Advanced (S-Curve, Betas, Q/R)
                </button>
              </div>

              {/* ==================== RESULTS TAB ==================== */}
              {activeTab === "results" && (
                <>
                  {/* Metrics Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                    {Object.entries(result.metrics)
                      .filter(([, value]) => value != null && !isNaN(value))
                      .map(([key, value]) => (
                      <div key={key} className="bg-white rounded-xl shadow-sm p-4">
                        <div className="text-xs text-gray-500 uppercase mb-1">{key}</div>
                        <div className="text-2xl font-bold text-gray-800">{(value as number).toFixed(4)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Actual vs Predicted - Full Width */}
                  <div ref={actualVsPredRef} className="bg-white rounded-xl shadow-sm p-5 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                        <LineChartIcon size={18} className="text-[#10b981]" /> Actual vs Predicted
                      </h4>
                      <SaveButton targetRef={actualVsPredRef as React.RefObject<HTMLElement>} title="Kalman: Actual vs Predicted" type="chart" />
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={actualVsPredictedData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="timeLabel" tick={{ fontSize: 10 }} height={40} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} dot={false} name="Actual" />
                        <Line type="monotone" dataKey="predicted" stroke="#10b981" strokeWidth={2} dot={false} name="Predicted" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Feature Contributions */}
                  <div ref={contributionsRef} className="bg-white rounded-xl shadow-sm p-5 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                        <BarChart3 size={18} className="text-emerald-500" /> Feature Contributions
                        <span className="text-xs text-gray-400 ml-2">{contributionData.length} features</span>
                      </h4>
                      <SaveButton targetRef={contributionsRef as React.RefObject<HTMLElement>} title="Kalman: Feature Contributions" type="chart" />
                    </div>
                    <div className="border rounded-lg" style={{ height: Math.min(400, Math.max(200, contributionData.length * 32 + 40)), overflowY: contributionData.length > 10 ? 'auto' : 'hidden' }}>
                      <ResponsiveContainer width="100%" height={Math.max(180, contributionData.length * 32)}>
                        <BarChart data={contributionData} layout="vertical" margin={{ left: 10, right: 50, top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                          <XAxis type="number" tick={{ fontSize: 10 }} unit="%" />
                          <YAxis type="category" dataKey="feature" tick={{ fontSize: 10 }} width={110} interval={0} />
                          <Tooltip 
                            formatter={(value: number) => [`${value.toFixed(2)}%`, "Contribution"]} 
                            labelFormatter={(label) => contributionData.find(d => d.feature === label)?.fullName || label}
                          />
                          <ReferenceLine x={0} stroke="#666" />
                          <Bar dataKey="contribution" fill="#10b981" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Coefficients Table */}
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-700">Final Coefficients</h4>
                      <span className="text-xs text-gray-400">{contributionData.length} features</span>
                    </div>
                    <div className="overflow-auto border rounded-lg" style={{ maxHeight: Math.min(450, Math.max(200, contributionData.length * 45 + 50)) }}>
                      <table className="w-full" style={{ minWidth: 550 }}>
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="text-left p-2.5 font-semibold text-gray-700 text-sm">Feature</th>
                            <th className="text-right p-2.5 font-semibold text-gray-700 text-sm">Coefficient</th>
                            <th className="text-right p-2.5 font-semibold text-gray-700 text-sm">Elasticity</th>
                            <th className="text-right p-2.5 font-semibold text-gray-700 text-sm">Contrib %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contributionData.map((row) => (
                            <tr key={row.fullName} className="border-t hover:bg-gray-50">
                              <td className="p-2.5 text-sm font-medium truncate max-w-[200px]" title={row.fullName}>{row.fullName}</td>
                              <td className="p-2.5 text-right font-mono text-sm">
                                <span className={row.coefficient >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                  {row.coefficient.toFixed(4)}
                                </span>
                              </td>
                              <td className="p-2.5 text-right font-mono text-sm">
                                <span className={row.elasticity >= 0 ? "text-blue-600 font-semibold" : "text-orange-600 font-semibold"}>
                                  {row.elasticity.toFixed(4)}
                                </span>
                              </td>
                              <td className="p-2.5 text-right font-mono text-sm">
                                <span className={row.contribution >= 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                                  {row.contribution.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {result.coefficients?.Intercept !== undefined && (
                      <p className="text-sm text-gray-500 mt-3 text-center">
                        Intercept: <span className="font-mono font-semibold">{result.coefficients.Intercept.toFixed(4)}</span>
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* ==================== ADVANCED TAB ==================== */}
              {activeTab === "advanced" && (
                <>
                  {/* SECTION 1: S-Curve Visualization (FIRST) */}
                  {result.logistic_metadata && Object.keys(result.logistic_metadata).length > 0 && (
                    <div className="mb-6">
                      <SCurveVisualization metadata={result.logistic_metadata} />
                    </div>
                  )}

                  {/* SECTION 2: Time-Varying Coefficients (Beta Change) */}
                  <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Activity size={18} className="text-purple-500" /> Time-Varying Coefficients (Beta Change)
                    </h4>
                    <div className="mb-3">
                      <select
                        value={selectedCoef || ""}
                        onChange={(e) => setSelectedCoef(e.target.value)}
                        className="p-2 border rounded-lg text-sm"
                      >
                        {featureColumns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <ComposedChart data={tvCoefData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="timeLabel" tick={{ fontSize: 10 }} height={40} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <ReferenceLine y={0} stroke="#666" />
                        <Line type="monotone" dataKey="coefficient" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Coefficient" isAnimationActive={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-gray-400 text-center mt-2">
                      Shows how the coefficient for "{selectedCoef}" evolves over time
                    </p>
                  </div>

                  {/* SECTION 3: Q and R History (Adaptive) */}
                  {adaptive && result.q_history && result.q_history.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
                      <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        ⚙️ Adaptive Q & R History
                      </h4>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                          <h5 className="text-sm font-medium text-gray-600 mb-2">Q (Process Noise)</h5>
                          <ResponsiveContainer width="100%" height={180}>
                            <ComposedChart data={result.q_history.map((q, i) => ({ index: i + 1, q }))}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                              <XAxis dataKey="index" tick={{ fontSize: 9 }} />
                              <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v.toExponential(1)} />
                              <Tooltip formatter={(v: number) => v.toExponential(3)} />
                              <Line type="monotone" dataKey="q" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-gray-600 mb-2">R (Measurement Noise)</h5>
                          <ResponsiveContainer width="100%" height={180}>
                            <ComposedChart data={result.r_history.map((r, i) => ({ index: i + 1, r }))}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                              <XAxis dataKey="index" tick={{ fontSize: 9 }} />
                              <YAxis tick={{ fontSize: 9 }} />
                              <Tooltip />
                              <Line type="monotone" dataKey="r" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 text-center mt-2">
                        Adaptive estimation of process and measurement noise over time
                      </p>
                    </div>
                  )}

                  {/* SECTION 4: Transformation Summary (Adstock & S-Curve Info) */}
                  {(result.adstock_decays && Object.keys(result.adstock_decays).length > 0) || 
                   (result.logistic_metadata && Object.keys(result.logistic_metadata).length > 0) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {result.adstock_decays && Object.keys(result.adstock_decays).length > 0 && (
                        <div className="bg-orange-50 rounded-xl p-4">
                          <h4 className="font-semibold text-orange-700 mb-3 flex items-center gap-2">
                            <Zap size={16} /> Adstock Transformations
                          </h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {Object.entries(result.adstock_decays).map(([col, decay]) => (
                              <div key={col} className="flex justify-between items-center bg-white rounded-lg px-3 py-2">
                                <span className="text-sm text-gray-700 font-medium truncate" title={col}>{col}</span>
                                <div className="text-right flex-shrink-0">
                                  <span className="font-mono text-orange-600 text-sm">λ = {decay.toFixed(2)}</span>
                                  <span className="text-xs text-gray-500 ml-2">({(1 / (1 - decay)).toFixed(2)}x)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.logistic_metadata && Object.keys(result.logistic_metadata).length > 0 && (
                        <div className="bg-blue-50 rounded-xl p-4">
                          <h4 className="font-semibold text-blue-700 mb-3 flex items-center gap-2">
                            <TrendingUp size={16} /> S-Curve Parameters
                          </h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {Object.entries(result.logistic_metadata).map(([col, meta]) => {
                              const resp = meta.responsiveness ?? 0;
                              const respColor = resp >= 0.7 ? "text-green-600" : resp >= 0.3 ? "text-yellow-600" : "text-red-600";
                              return (
                                <div key={col} className="flex justify-between items-center bg-white rounded-lg px-3 py-2">
                                  <span className="text-sm text-gray-700 font-medium truncate" title={col}>{col}</span>
                                  <div className="text-right flex-shrink-0">
                                    <span className="font-mono text-blue-600 text-sm">k = {meta.steepness?.toFixed(2) ?? "?"}</span>
                                    <span className={`text-xs ml-2 font-semibold ${respColor}`}>
                                      {(resp * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-500 mb-6">
                      No transformations applied. Enable Adstock or S-Curve in the configuration panel.
                    </div>
                  )}

                  {/* Beta History Table with Download */}
                  {result.tv_coefficients && Object.keys(result.tv_coefficients).length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                          📊 Coefficient History Table
                          <span className="text-xs text-gray-400 font-normal">
                            ({Object.keys(result.tv_coefficients).length} features × {result.tv_coefficients[Object.keys(result.tv_coefficients)[0]]?.length || 0} periods)
                          </span>
                        </h4>
                        <button
                          onClick={() => {
                            const features = Object.keys(result.tv_coefficients);
                            const numRows = result.tv_coefficients[features[0]]?.length || 0;
                            const data: Record<string, unknown>[] = [];
                            for (let i = 0; i < numRows; i++) {
                              const row: Record<string, unknown> = { 
                                Period: i + 1,
                                TimeLabel: timeColumn && dataset ? String(dataset.rows[i]?.[timeColumn] ?? i + 1) : String(i + 1)
                              };
                              features.forEach(f => {
                                row[f] = result.tv_coefficients[f]?.[i] ?? 0;
                              });
                              data.push(row);
                            }
                            downloadCSV(data, "kalman_beta_history.csv");
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm font-medium"
                        >
                          <Download size={16} /> Download CSV
                        </button>
                      </div>
                      <div className="overflow-auto border rounded-lg" style={{ maxHeight: 350 }}>
                        <table className="w-full text-sm" style={{ minWidth: Math.max(400, Object.keys(result.tv_coefficients).length * 90 + 150) }}>
                          <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                              <th className="text-left p-2 font-semibold text-gray-700 sticky left-0 bg-gray-50 z-20">Period</th>
                              {timeColumn && <th className="text-left p-2 font-semibold text-gray-700">Time</th>}
                              {Object.keys(result.tv_coefficients).map(feature => (
                                <th key={feature} className="text-right p-2 font-semibold text-gray-700 whitespace-nowrap" title={feature}>
                                  {feature.length > 10 ? feature.slice(0, 10) + "…" : feature}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: result.tv_coefficients[Object.keys(result.tv_coefficients)[0]]?.length || 0 }).map((_, i) => (
                              <tr key={i} className="border-t hover:bg-gray-50">
                                <td className="p-2 font-mono text-gray-600 sticky left-0 bg-white">{i + 1}</td>
                                {timeColumn && dataset && (
                                  <td className="p-2 text-gray-600 whitespace-nowrap">{String(dataset.rows[i]?.[timeColumn] ?? "")}</td>
                                )}
                                {Object.keys(result.tv_coefficients).map(feature => {
                                  const val = result.tv_coefficients[feature]?.[i] ?? 0;
                                  return (
                                    <td key={feature} className="p-2 text-right font-mono whitespace-nowrap">
                                      <span className={val >= 0 ? "text-green-600" : "text-red-600"}>
                                        {val.toFixed(4)}
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Shows how each coefficient evolves at every time period. Download to analyze in Excel.
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
