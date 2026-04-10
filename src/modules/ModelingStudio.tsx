import { useState, useMemo } from "react";
import { TrendingUp, AlertCircle, Loader2, BarChart3 } from "lucide-react";
import { useStore } from "../store/useStore";
import { runPrediction } from "../services/api";
import { LockedResults } from "../components/LockedResults";

type ModelType = "linear" | "ridge" | "lasso" | "elasticnet" | "bayesian" | "constrained_ridge";
type StandardizationType = "none" | "standardize" | "minmax" | "robust" | "log" | "sqrt";

interface ModelResult {
  predictions: number[];
  actuals?: number[];
  outlier_indices?: number[];
  metrics: Record<string, number>;
  coefficients?: Record<string, number>;
  coefficients_transformed?: Record<string, number>;
  elasticities?: Record<string, number>;
  betas?: Record<string, number>;
  contributions?: Record<string, number>;
  standardization_used?: string;
  model_type?: string;
}

export function ModelingStudio() {
  const { dataset, modelingState, updateModelingState } = useStore();
  
  // Use persisted state from store
  const modelType = modelingState.modelType as ModelType;
  const standardization = modelingState.standardization as StandardizationType;
  const targetColumn = modelingState.targetCol;
  const featureColumns = modelingState.featureCols;
  const nonPositiveFeatures = modelingState.nonPositiveFeatures;
  const nonNegativeFeatures = modelingState.nonNegativeFeatures;
  const removeOutliers = modelingState.removeOutliers;
  
  // Setters that update the store
  const setModelType = (val: ModelType) => updateModelingState({ modelType: val });
  const setStandardization = (val: StandardizationType) => updateModelingState({ standardization: val });
  const setTargetColumn = (val: string) => updateModelingState({ targetCol: val });
  const setFeatureColumns = (val: string[] | ((prev: string[]) => string[])) => {
    if (typeof val === 'function') {
      updateModelingState({ featureCols: val(modelingState.featureCols) });
    } else {
      updateModelingState({ featureCols: val });
    }
  };
  const setNonPositiveFeatures = (val: string[] | ((prev: string[]) => string[])) => {
    if (typeof val === 'function') {
      updateModelingState({ nonPositiveFeatures: val(modelingState.nonPositiveFeatures) });
    } else {
      updateModelingState({ nonPositiveFeatures: val });
    }
  };
  const setNonNegativeFeatures = (val: string[] | ((prev: string[]) => string[])) => {
    if (typeof val === 'function') {
      updateModelingState({ nonNegativeFeatures: val(modelingState.nonNegativeFeatures) });
    } else {
      updateModelingState({ nonNegativeFeatures: val });
    }
  };
  const setRemoveOutliers = (val: boolean) => updateModelingState({ removeOutliers: val });
  
  // Local UI state (not persisted)
  const [timeColumn, setTimeColumn] = useState("");
  const [filterColumn, setFilterColumn] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Result from persisted state - with safety checks
  const modelResult: ModelResult | null = modelingState.results && modelingState.results.predictions?.length > 0 ? {
    predictions: modelingState.results.predictions || [],
    actuals: modelingState.results.actuals || [],
    metrics: modelingState.results.metrics || {},
    coefficients: modelingState.results.coefficients || {},
    elasticities: modelingState.results.elasticities || {},
    contributions: modelingState.results.contributions || {},
  } : null;

  const numericColumns = dataset?.columns.filter((c) => c.type === "numeric").map((c) => c.name) || [];
  const allColumns = dataset?.columns.map((c) => c.name) || [];

  // Get unique values for filter column (preserve original order from data)
  const filterValues = useMemo(() => {
    if (!dataset || !filterColumn) return [];
    const seen = new Set<string>();
    const values: string[] = [];
    dataset.rows.forEach((r) => {
      const v = String(r[filterColumn] ?? "");
      if (!seen.has(v)) {
        seen.add(v);
        values.push(v);
      }
    });
    return values; // Keep original order from data
  }, [dataset, filterColumn]);

  // Filter data based on selection using index positions
  const filteredData = useMemo(() => {
    if (!dataset) return [];
    if (!filterColumn || (!filterStart && !filterEnd)) return dataset.rows;
    
    const startIdx = filterStart ? filterValues.indexOf(filterStart) : 0;
    const endIdx = filterEnd ? filterValues.indexOf(filterEnd) : filterValues.length - 1;
    
    if (startIdx === -1 || endIdx === -1) return dataset.rows;
    
    const validValues = new Set(filterValues.slice(startIdx, endIdx + 1));
    
    return dataset.rows.filter((row) => {
      const val = String(row[filterColumn] ?? "");
      return validValues.has(val);
    });
  }, [dataset, filterColumn, filterStart, filterEnd, filterValues]);

  const handleFeatureToggle = (col: string) => {
    setFeatureColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  };

  const selectAllFeatures = () => {
    setFeatureColumns(numericColumns.filter((c) => c !== targetColumn));
  };

  const clearFeatures = () => setFeatureColumns([]);



  const runRegressionModel = async () => {
    if (!dataset || !targetColumn || featureColumns.length === 0) {
      setError("Please select target and at least one feature column");
      return;
    }
    if (filteredData.length === 0) {
      setError("No data after filtering. Adjust your filter range.");
      return;
    }
    setLoading(true);
    setError(null);
    updateModelingState({ results: null, hasRun: false });

    const result = await runPrediction({
      data: filteredData,
      target_column: targetColumn,
      feature_columns: featureColumns,
      model_type: modelType,
      standardization: standardization,
      non_positive_features: nonPositiveFeatures.length > 0 ? nonPositiveFeatures : undefined,
      non_negative_features: nonNegativeFeatures.length > 0 ? nonNegativeFeatures : undefined,
      remove_outliers: removeOutliers,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      // Save results to persisted store
      updateModelingState({
        results: {
          predictions: result.data.predictions,
          actuals: result.data.actuals || [],
          metrics: result.data.metrics,
          coefficients: result.data.coefficients || {},
          elasticities: result.data.elasticities || {},
          contributions: result.data.contributions || {},
        },
        hasRun: true,
      });
    }
  };

  if (!dataset) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-gray-500">
        <TrendingUp size={48} className="mb-4 opacity-50" />
        <p className="text-lg">Upload data first to start modeling</p>
      </div>
    );
  }


  return (
    <div className="p-6 h-full overflow-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <TrendingUp className="text-[#FFBD59]" /> Modeling Studio
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
            <h3 className="font-semibold text-gray-700 mb-4">Model Configuration</h3>

            {/* Model Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">Model Type</label>
              <select
                value={modelType}
                onChange={(e) => setModelType(e.target.value as ModelType)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#FFBD59] focus:border-transparent"
              >
                <option value="linear">Linear Regression</option>
                <option value="ridge">Ridge Regression</option>
                <option value="lasso">Lasso Regression</option>
                <option value="elasticnet">ElasticNet</option>
                <option value="bayesian">Bayesian Ridge</option>
                <option value="constrained_ridge">Constrained Ridge</option>
              </select>
            </div>

            {/* Standardization */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">Standardization</label>
              <select
                value={standardization}
                onChange={(e) => setStandardization(e.target.value as StandardizationType)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#FFBD59] focus:border-transparent"
              >
                <option value="none">None (Raw Data)</option>
                <option value="standardize">Z-Score (StandardScaler)</option>
                <option value="minmax">Min-Max (0-1 Scale)</option>
                <option value="robust">Robust (Median/IQR)</option>
                <option value="log">Log Transform</option>
                <option value="sqrt">Square Root</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {standardization === "none" && "Use raw data values"}
                {standardization === "standardize" && "Mean=0, Std=1"}
                {standardization === "minmax" && "Scale to [0, 1] range"}
                {standardization === "robust" && "Robust to outliers"}
                {standardization === "log" && "log(1+x) transform"}
                {standardization === "sqrt" && "√x transform"}
              </p>
            </div>

            {/* Outlier Detection Toggle */}
            <div className="mb-4 p-3 bg-orange-50 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeOutliers}
                  onChange={(e) => setRemoveOutliers(e.target.checked)}
                  className="rounded text-[#FFBD59] focus:ring-[#FFBD59]"
                />
                <span className="text-sm font-medium text-gray-700">🎯 Remove Outliers</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Uses IQR method on target variable to detect and exclude outliers from training
              </p>
            </div>

            {/* Target Column */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">Target Variable (Y)</label>
              <select
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#FFBD59] focus:border-transparent"
              >
                <option value="">Select target...</option>
                {numericColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {/* Time Column for X-axis */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">Time Column (X-axis)</label>
              <select
                value={timeColumn}
                onChange={(e) => setTimeColumn(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#FFBD59] focus:border-transparent"
              >
                <option value="">Index (1, 2, 3...)</option>
                {allColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Used for Actual vs Predicted chart</p>
            </div>

            {/* Data Filter */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-600 mb-2">📅 Data Filter</label>
              <select
                value={filterColumn}
                onChange={(e) => {
                  setFilterColumn(e.target.value);
                  setFilterStart("");
                  setFilterEnd("");
                }}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#FFBD59] focus:border-transparent mb-2"
              >
                <option value="">No filter (use all data)</option>
                {allColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
              {filterColumn && filterValues.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">From</label>
                    <select
                      value={filterStart}
                      onChange={(e) => setFilterStart(e.target.value)}
                      className="w-full p-1.5 text-sm border rounded focus:ring-1 focus:ring-[#FFBD59]"
                    >
                      <option value="">Start</option>
                      {filterValues.map((v) => (
                        <option key={String(v)} value={String(v)}>{String(v)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">To</label>
                    <select
                      value={filterEnd}
                      onChange={(e) => setFilterEnd(e.target.value)}
                      className="w-full p-1.5 text-sm border rounded focus:ring-1 focus:ring-[#FFBD59]"
                    >
                      <option value="">End</option>
                      {filterValues.map((v) => (
                        <option key={String(v)} value={String(v)}>{String(v)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {filteredData.length} of {dataset?.rows.length ?? 0} rows selected
              </p>
            </div>

            {/* Feature Columns */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-600">Features (X)</label>
                <span className="text-xs text-gray-400">{featureColumns.length} selected</span>
              </div>
              <div className="flex gap-1 mb-2">
                <button onClick={selectAllFeatures} className="text-xs text-blue-600 hover:underline">Select All</button>
                <span className="text-gray-300">|</span>
                <button onClick={clearFeatures} className="text-xs text-blue-600 hover:underline">Clear</button>
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                {numericColumns.filter((c) => c !== targetColumn).map((col) => (
                  <label key={col} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featureColumns.includes(col)}
                      onChange={() => handleFeatureToggle(col)}
                      className="rounded text-[#FFBD59] focus:ring-[#FFBD59]"
                    />
                    <span className="text-sm truncate" title={col}>{col}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Coefficient Constraints (for Constrained Ridge) */}
            {modelType === "constrained_ridge" && featureColumns.length > 0 && (
              <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                <label className="block text-sm font-medium text-purple-700 mb-2">⚙️ Coefficient Constraints</label>
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
                <p className="text-xs text-purple-500 mt-2">Force coefficients to be positive or negative</p>
              </div>
            )}

            <button
              onClick={runRegressionModel}
              disabled={true}
              className="w-full py-3 bg-gray-400 text-white font-semibold rounded-lg cursor-not-allowed flex items-center justify-center gap-2 opacity-60"
              title="Contact administrator for access"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Run Model (Locked)
            </button>
            

          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          {!modelResult && !loading && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
              <BarChart3 size={64} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg">Configure and run a model to see results</p>
            </div>
          )}

          {loading && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Loader2 size={48} className="mx-auto mb-4 animate-spin text-[#FFBD59]" />
              <p className="text-gray-600">Running {modelType} regression...</p>
            </div>
          )}

          {/* Locked Results - Client Version */}
          <LockedResults feature="Modeling Studio" />
        </div>
      </div>
    </div>
  );
}
