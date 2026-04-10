import { useMemo, useRef, useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, LineChart, Line } from "recharts";
import { Play, Info, Filter, CheckCircle, Loader } from "lucide-react";
import { useStore } from "../store/useStore";
// Hidden for client version - no reports
// import { SaveButton } from "./SaveToReportModal";

interface ClusteringSectionProps {
  dataset: { rows: Record<string, unknown>[]; columns: { name: string; type: string }[] };
}

// K-Means clustering implementation
function kMeans(data: number[][], k: number, maxIter: number = 100): { clusters: number[]; centroids: number[][]; inertia: number } {
  const n = data.length;
  const dims = data[0].length;
  
  // Initialize centroids randomly
  let centroids: number[][] = [];
  const usedIndices = new Set<number>();
  while (centroids.length < k) {
    const randomIdx = Math.floor(Math.random() * n);
    if (!usedIndices.has(randomIdx)) {
      centroids.push([...data[randomIdx]]);
      usedIndices.add(randomIdx);
    }
  }
  
  let clusters = new Array(n).fill(0);
  let changed = true;
  let iter = 0;
  
  while (changed && iter < maxIter) {
    changed = false;
    
    // Assign points to nearest centroid
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      
      for (let j = 0; j < k; j++) {
        const dist = data[i].reduce((sum, val, d) => sum + Math.pow(val - centroids[j][d], 2), 0);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = j;
        }
      }
      
      if (clusters[i] !== bestCluster) {
        clusters[i] = bestCluster;
        changed = true;
      }
    }
    
    // Update centroids
    const newCentroids: number[][] = Array(k).fill(0).map(() => Array(dims).fill(0));
    const counts = Array(k).fill(0);
    
    for (let i = 0; i < n; i++) {
      const c = clusters[i];
      counts[c]++;
      for (let d = 0; d < dims; d++) {
        newCentroids[c][d] += data[i][d];
      }
    }
    
    for (let j = 0; j < k; j++) {
      if (counts[j] > 0) {
        for (let d = 0; d < dims; d++) {
          centroids[j][d] = newCentroids[j][d] / counts[j];
        }
      }
    }
    
    iter++;
  }
  
  // Calculate inertia (within-cluster sum of squares)
  let inertia = 0;
  for (let i = 0; i < n; i++) {
    const c = clusters[i];
    inertia += data[i].reduce((sum, val, d) => sum + Math.pow(val - centroids[c][d], 2), 0);
  }
  
  return { clusters, centroids, inertia };
}

export function ClusteringSection({ dataset }: ClusteringSectionProps) {
  const numericCols = dataset.columns.filter(c => c.type === "numeric");
  const allCols = dataset.columns;
  const categoricalCols = dataset.columns.filter(c => c.type === "categorical");
  
  const { clusteringState, updateClusteringState } = useStore();
  
  // Local state for loading and success feedback
  const [isRunning, setIsRunning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Refs for saving
  const elbowChartRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<HTMLDivElement>(null);

  const {
    selectedVars,
    kValue,
    filterCatCol,
    filterCatValue,
    clusters,
    elbowData,
    showElbow,
    optimalK,
  } = clusteringState;
  
  const setSelectedVars = (val: string[]) => updateClusteringState({ selectedVars: val });
  const setKValue = (val: number) => updateClusteringState({ kValue: val });
  const setFilterCatCol = (val: string) => updateClusteringState({ filterCatCol: val });
  const setFilterCatValue = (val: string) => updateClusteringState({ filterCatValue: val });
  const setFilterCatValues = (val: string[]) => updateClusteringState({ filterCatValue: val.join(',') });
  const setClusters = (val: number[] | null) => updateClusteringState({ clusters: val });
  const setElbowData = (val: { k: number; inertia: number }[] | null) => updateClusteringState({ elbowData: val });
  const setShowElbow = (val: boolean) => updateClusteringState({ showElbow: val });
  const setOptimalK = (val: number | null) => updateClusteringState({ optimalK: val });
  
  // Local state for filter UI
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [filterSearchTerm, setFilterSearchTerm] = useState("");
  
  // Filter data - support multi-select
  const filteredRows = useMemo(() => {
    let rows = dataset.rows;
    
    // Category filter - support multiple values
    if (filterCatCol && filterCatValue) {
      const selectedValues = filterCatValue.split(',').filter(v => v);
      if (selectedValues.length > 0) {
        rows = rows.filter(r => selectedValues.includes(String(r[filterCatCol])));
      }
    }
    
    return rows;
  }, [dataset, filterCatCol, filterCatValue]);
  
  // Get category filter values for clustering
  const catFilterValues = useMemo(() => {
    if (!filterCatCol) return [];
    const values = new Set(dataset.rows.map(r => String(r[filterCatCol] ?? "")));
    return Array.from(values).sort();
  }, [dataset, filterCatCol]);
  
  // Get selected filter values as array
  const selectedFilterValues = useMemo(() => {
    return filterCatValue ? filterCatValue.split(',').filter(v => v) : [];
  }, [filterCatValue]);
  
  // Filtered values based on search
  const filteredCatValues = useMemo(() => {
    if (!filterSearchTerm) return catFilterValues;
    return catFilterValues.filter(v => 
      v.toLowerCase().includes(filterSearchTerm.toLowerCase())
    );
  }, [catFilterValues, filterSearchTerm]);
  
  // Normalize data
  const normalizedData = useMemo(() => {
    if (selectedVars.length === 0) return null;
    
    const data: number[][] = filteredRows.map(row => 
      selectedVars.map(v => Number(row[v]) || 0)
    );
    
    // Normalize each dimension to [0, 1]
    const mins = selectedVars.map((_, i) => Math.min(...data.map(row => row[i])));
    const maxs = selectedVars.map((_, i) => Math.max(...data.map(row => row[i])));
    
    return data.map(row => 
      row.map((val, i) => maxs[i] === mins[i] ? 0 : (val - mins[i]) / (maxs[i] - mins[i]))
    );
  }, [filteredRows, selectedVars]);
  
  // Run clustering (K-Means only)
  const runClustering = () => {
    if (!normalizedData) return;
    
    setIsRunning(true);
    setShowSuccess(false);
    
    // Use setTimeout to allow UI to update with loading state
    setTimeout(() => {
      const result = kMeans(normalizedData, kValue);
      setClusters(result.clusters);
      
      setIsRunning(false);
      setShowSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000);
    }, 100);
  };
  
  // Find optimal K using elbow method (point of maximum curvature / inflection point)
  // This finds where the slope changes the most (maximum second derivative)
  const findOptimalK = (elbowResults: { k: number; inertia: number }[]): number => {
    if (elbowResults.length < 3) return 3;
    
    // Normalize the data to [0, 1] range for fair comparison
    const kValues = elbowResults.map(r => r.k);
    const inertiaValues = elbowResults.map(r => r.inertia);
    
    const minK = Math.min(...kValues);
    const maxK = Math.max(...kValues);
    const minInertia = Math.min(...inertiaValues);
    const maxInertia = Math.max(...inertiaValues);
    
    const normalizedPoints = elbowResults.map(r => ({
      k: (r.k - minK) / (maxK - minK || 1),
      inertia: (r.inertia - minInertia) / (maxInertia - minInertia || 1)
    }));
    
    // Calculate the distance from each point to the line connecting first and last points
    // The elbow is the point with maximum perpendicular distance
    const firstPoint = normalizedPoints[0];
    const lastPoint = normalizedPoints[normalizedPoints.length - 1];
    
    // Line equation: ax + by + c = 0
    const a = lastPoint.inertia - firstPoint.inertia;
    const b = firstPoint.k - lastPoint.k;
    const c = lastPoint.k * firstPoint.inertia - firstPoint.k * lastPoint.inertia;
    
    const denominator = Math.sqrt(a * a + b * b);
    
    let maxDistance = -Infinity;
    let optimalIdx = 1;
    
    // Find point with maximum perpendicular distance from the line
    for (let i = 1; i < normalizedPoints.length - 1; i++) {
      const point = normalizedPoints[i];
      const distance = Math.abs(a * point.k + b * point.inertia + c) / denominator;
      
      if (distance > maxDistance) {
        maxDistance = distance;
        optimalIdx = i;
      }
    }
    
    return elbowResults[optimalIdx].k;
  };
  
  // Calculate elbow method
  const calculateElbow = () => {
    if (!normalizedData) return;
    
    const results: { k: number; inertia: number }[] = [];
    const maxK = Math.min(10, Math.floor(dataset.rows.length / 2));
    
    for (let k = 1; k <= maxK; k++) {
      const result = kMeans(normalizedData, k);
      results.push({ k, inertia: result.inertia });
    }
    
    // Find optimal K automatically
    const optimal = findOptimalK(results);
    setOptimalK(optimal);
    setKValue(optimal);
    setElbowData(results);
    setShowElbow(true);
  };
  
  // Visualization data
  const vizData = useMemo(() => {
    if (!clusters || selectedVars.length === 0) return null;
    
    const clusterColors = ["#FFBD59", "#41C185", "#458EE2", "#EF4444", "#A855F7", "#EC4899", "#F59E0B", "#10B981"];
    
    return filteredRows.map((row, i) => ({
      ...selectedVars.reduce((acc, v) => ({ ...acc, [v]: Number(row[v]) || 0 }), {}),
      cluster: clusters[i],
      clusterName: clusters[i] === -1 ? "Noise" : `Cluster ${clusters[i] + 1}`,
      fill: clusters[i] === -1 ? "#999999" : clusterColors[clusters[i] % clusterColors.length],
    }));
  }, [clusters, selectedVars, filteredRows]);
  
  // Cluster statistics
  const clusterStats = useMemo(() => {
    if (!clusters || selectedVars.length === 0) return null;
    
    const uniqueClusters = Array.from(new Set(clusters)).sort((a, b) => a - b);
    return uniqueClusters.map(c => {
      const points = filteredRows.filter((_, i) => clusters[i] === c);
      const stats = selectedVars.map(v => {
        const values = points.map(p => Number(p[v]) || 0);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
        return { variable: v, mean, std };
      });
      return { cluster: c, count: points.length, stats };
    });
  }, [clusters, selectedVars, filteredRows]);
  
  return (
    <div className="space-y-6">
      {/* Data Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-[#666666]" />
          <span className="text-[14px] font-semibold text-[#333333]">Data Filter</span>
          {(filterCatCol && selectedFilterValues.length > 0) && (
            <span className="ml-auto text-[12px] bg-[#E8F8F0] text-[#41C185] px-3 py-1 rounded-full font-medium">
              {filteredRows.length} of {dataset.rows.length} rows
            </span>
          )}
        </div>
        
        <div className="flex flex-wrap gap-3 items-start">
          {/* Column Selector - Multi-select */}
          <div className="flex items-center gap-2">
            <label className="text-[12px] text-[#666666] font-medium">Columns:</label>
            <div className="relative">
              <button
                onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                className="border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px] bg-white min-w-[150px] flex items-center justify-between hover:border-[#FFBD59] transition"
              >
                <span className={filterCatCol ? "text-[#333333]" : "text-[#999999]"}>
                  {filterCatCol || "Select column..."}
                </span>
                <svg className={`w-4 h-4 ml-2 transition-transform ${filterDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {filterDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFilterDropdownOpen(false)} />
                  <div className="absolute z-20 mt-1 w-64 bg-white border border-[#E5E5E5] rounded-lg shadow-lg max-h-80 overflow-auto">
                    <div className="sticky top-0 bg-white p-2 border-b border-[#E5E5E5]">
                      <input
                        type="text"
                        placeholder="Search columns..."
                        value={filterSearchTerm}
                        onChange={(e) => setFilterSearchTerm(e.target.value)}
                        className="w-full border border-[#E5E5E5] rounded px-2 py-1 text-[12px] focus:ring-1 focus:ring-[#FFBD59] outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {(categoricalCols.length > 0 ? categoricalCols : allCols)
                      .filter(c => !filterSearchTerm || c.name.toLowerCase().includes(filterSearchTerm.toLowerCase()))
                      .map((c) => (
                        <button
                          key={c.name}
                          onClick={() => {
                            setFilterCatCol(c.name);
                            setFilterCatValue("");
                            setFilterDropdownOpen(false);
                            setFilterSearchTerm("");
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-[#FFF8ED] text-[13px] ${
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
          </div>

          {/* Value Selector - Checkboxes */}
          {filterCatCol && (
            <div className="flex-1 min-w-[300px]">
              <label className="block text-[12px] text-[#666666] font-medium mb-2">Values:</label>
              <div className="border border-[#E5E5E5] rounded-lg p-3 bg-[#FAFAFA] max-h-48 overflow-y-auto">
                <div className="mb-2 pb-2 border-b border-[#E5E5E5]">
                  <input
                    type="text"
                    placeholder="Search values..."
                    value={filterSearchTerm}
                    onChange={(e) => setFilterSearchTerm(e.target.value)}
                    className="w-full border border-[#E5E5E5] rounded px-2 py-1 text-[12px] focus:ring-1 focus:ring-[#FFBD59] outline-none bg-white"
                  />
                </div>
                <div className="space-y-1">
                  {filteredCatValues.map((v) => (
                    <label key={v} className="flex items-center gap-2 py-1 px-2 hover:bg-white rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedFilterValues.includes(v)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilterCatValues([...selectedFilterValues, v]);
                          } else {
                            setFilterCatValues(selectedFilterValues.filter(val => val !== v));
                          }
                        }}
                        className="w-4 h-4 text-[#41C185] rounded border-[#E5E5E5] focus:ring-[#41C185]"
                      />
                      <span className="text-[13px] text-[#333333]">{v}</span>
                    </label>
                  ))}
                </div>
                {filteredCatValues.length === 0 && (
                  <p className="text-[12px] text-[#999999] text-center py-2">No values found</p>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={() => setFilterCatValues(catFilterValues)}
                  className="text-[11px] text-[#458EE2] hover:underline"
                >
                  Select all
                </button>
                <button
                  onClick={() => setFilterCatValues([])}
                  className="text-[11px] text-[#999999] hover:text-[#666666]"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Selected Filters Display */}
        {filterCatCol && selectedFilterValues.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#F0F0F0]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] text-[#666666] font-medium">Active filters:</span>
              <button
                onClick={() => { setFilterCatCol(""); setFilterCatValue(""); }}
                className="text-[11px] text-[#EF4444] hover:text-[#DC2626] ml-auto"
              >
                Clear all filters
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#458EE2] text-white rounded text-[11px] font-medium">
                {filterCatCol}
              </span>
              {selectedFilterValues.map(val => (
                <span key={val} className="inline-flex items-center gap-1 px-2 py-1 bg-[#E8F8F0] text-[#41C185] rounded text-[11px] font-medium">
                  {val}
                  <button 
                    onClick={() => setFilterCatValues(selectedFilterValues.filter(v => v !== val))}
                    className="hover:text-[#2D8A4E]"
                  >×</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Configuration Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-5">
        <h3 className="text-[18px] font-semibold text-[#333333] mb-4">Clustering Configuration</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Variable Selection */}
          <div>
            <label className="block text-[13px] font-medium text-[#666666] mb-2">Select Variables (1-10)</label>
            <div className="border border-[#E5E5E5] rounded-lg p-3 max-h-64 overflow-y-auto bg-[#FAFAFA]">
              {numericCols.map(col => (
                <label key={col.name} className="flex items-center gap-2 py-2 px-2 hover:bg-white rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedVars.includes(col.name)}
                    onChange={(e) => {
                      if (e.target.checked && selectedVars.length < 10) {
                        setSelectedVars([...selectedVars, col.name]);
                      } else if (!e.target.checked) {
                        setSelectedVars(selectedVars.filter(v => v !== col.name));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-[14px] text-[#333333]">{col.name}</span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-[#999999] mt-2">
              Selected: {selectedVars.length}/10 variables
            </p>
          </div>
          
          {/* Right: Algorithm Settings */}
          <div className="space-y-4">
            {/* Algorithm label only - K-Means is the only option */}
            <div>
              <label className="block text-[13px] font-medium text-[#666666] mb-2">Algorithm: K-Means</label>
            </div>
            
            <div>
              <label className="block text-[13px] font-medium text-[#666666] mb-2">
                Number of Clusters (k)
              </label>
              <input
                type="number"
                min="2"
                max="10"
                value={kValue}
                onChange={(e) => setKValue(Number(e.target.value))}
                className="w-full border border-[#E5E5E5] rounded-lg px-4 py-2.5 text-[14px]"
              />
            </div>
            <button
              onClick={calculateElbow}
              disabled={selectedVars.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#458EE2] text-white rounded-lg font-medium hover:bg-[#3A7BC8] disabled:opacity-50 transition"
            >
              <Info size={16} /> Auto-Detect Optimal K
            </button>
            {optimalK && (
              <div className="p-2 bg-[#E8F8F0] rounded-lg text-center">
                <p className="text-[12px] text-[#41C185] font-semibold">
                  ✓ Using K = {optimalK}
                </p>
              </div>
            )}
            
            <button
              onClick={runClustering}
              disabled={selectedVars.length === 0 || isRunning}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition text-[15px] ${
                showSuccess 
                  ? "bg-[#41C185] text-white"
                  : isRunning
                    ? "bg-[#999999] text-white cursor-wait"
                    : "bg-[#41C185] text-white hover:bg-[#38A874] disabled:opacity-50"
              }`}
            >
              {isRunning ? (
                <>
                  <Loader size={18} className="animate-spin" /> Running...
                </>
              ) : showSuccess ? (
                <>
                  <CheckCircle size={18} /> Clustering Complete!
                </>
              ) : (
                <>
                  <Play size={18} /> Run Clustering
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Elbow Method Chart */}
      {showElbow && elbowData && (
        <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[16px] font-semibold text-[#333333]">Elbow Method - Optimal K</h3>
              {optimalK && (
                <p className="text-[14px] text-[#41C185] font-semibold mt-1">
                  ✓ Optimal K detected: {optimalK} clusters
                </p>
              )}
              <p className="text-[12px] text-[#999999] mt-1">The elbow point shows where adding more clusters provides diminishing returns</p>
            </div>
            <div className="flex items-center gap-2">
              {/* SaveButton removed - no reports in client version */}
              <button
                onClick={() => setShowElbow(false)}
                className="text-[#999999] hover:text-[#666666]"
              >
                ✕
              </button>
            </div>
          </div>
          <div ref={elbowChartRef}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={elbowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="k" label={{ value: "Number of Clusters (k)", position: "bottom", fontSize: 12 }} tick={{ fontSize: 11 }} />
              <YAxis label={{ value: "Inertia (Within-cluster sum of squares)", angle: -90, position: "insideLeft", fontSize: 11 }} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Line 
                type="monotone" 
                dataKey="inertia" 
                stroke="#458EE2" 
                strokeWidth={3} 
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  const isOptimal = payload.k === optimalK;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isOptimal ? 8 : 5}
                      fill={isOptimal ? "#41C185" : "#458EE2"}
                      stroke={isOptimal ? "#2D8A4E" : "#458EE2"}
                      strokeWidth={isOptimal ? 3 : 0}
                    />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
          <div className="mt-4 p-3 bg-[#E8F8F0] rounded-lg">
            <p className="text-[13px] text-[#41C185] font-medium">
              💡 K value has been automatically set to {optimalK}. You can adjust it manually if needed.
            </p>
          </div>
        </div>
      )}
      
      {/* Results */}
      {clusters && vizData && (
        <>
          {/* Cluster Statistics */}
          <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-[#333333]">Cluster Statistics</h3>
              {/* SaveButton removed - no reports in client version */}
            </div>
            <div ref={statsRef} className="max-h-[400px] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clusterStats?.map(({ cluster, count, stats }) => {
                  const color = vizData?.find(d => d.cluster === cluster)?.fill || "#999999";
                  return (
                    <div key={cluster} className="border-2 rounded-lg p-4 bg-[#FAFAFA]" style={{ borderColor: color }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                          <h4 className="text-[14px] font-bold text-[#333333]">
                            {cluster === -1 ? "Noise" : `Cluster ${cluster + 1}`}
                          </h4>
                        </div>
                        <span className="text-[11px] bg-white text-[#666666] px-2 py-1 rounded-full font-semibold border border-[#E5E5E5]">
                          {count} pts
                        </span>
                      </div>
                      <div className="space-y-2 max-h-[150px] overflow-y-auto">
                        {stats.map(({ variable, mean, std }) => (
                          <div key={variable} className="text-[11px] bg-white p-2 rounded border border-[#E5E5E5]">
                            <p className="text-[#666666] font-semibold mb-0.5">{variable}</p>
                            <div className="flex gap-3">
                              <span className="text-[#333333]">μ: {mean.toFixed(2)}</span>
                              <span className="text-[#666666]">σ: {std.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Visualizations */}
          <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-[#333333]">Cluster Visualization</h3>
              <div className="flex items-center gap-2">
                {selectedVars.length > 3 && (
                  <span className="text-[12px] bg-[#E8F8F0] text-[#41C185] px-3 py-1 rounded-full font-medium">
                    {selectedVars.length} variables • Showing first 3
                  </span>
                )}
                {/* SaveButton removed - no reports in client version */}
              </div>
            </div>
            
            {/* Custom Legend - Compact and Horizontal */}
            <div className="mb-4 p-3 bg-[#FAFAFA] rounded-lg border border-[#E5E5E5]">
              <div className="flex flex-wrap gap-3 items-center">
                <span className="text-[12px] font-semibold text-[#666666]">Clusters:</span>
                {Array.from(new Set(clusters)).sort((a, b) => a - b).map(c => {
                  const color = vizData?.find(d => d.cluster === c)?.fill || "#999999";
                  const count = clusters.filter(cl => cl === c).length;
                  return (
                    <div key={c} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-[#E5E5E5]">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[13px] font-medium text-[#333333]">
                        {c === -1 ? "Noise" : `Cluster ${c + 1}`}
                      </span>
                      <span className="text-[11px] text-[#999999]">({count})</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div ref={vizRef}>
            {selectedVars.length === 1 && (
              <div className="p-3 bg-[#FFF2DF] rounded-lg text-[13px] text-[#B8860B]">
                ℹ️ Single variable clustering - showing distribution
              </div>
            )}
            
            {selectedVars.length >= 2 && (
              <div className="max-h-[600px] overflow-y-auto pr-2 space-y-4">
                {/* Show all pairwise combinations for first 3 variables */}
                {selectedVars.slice(0, 3).map((var1, i) => 
                  selectedVars.slice(i + 1, 3).map((var2) => (
                    <div key={`${var1}-${var2}`} className="border border-[#E5E5E5] rounded-lg p-4 bg-[#FAFAFA]">
                      <h4 className="text-[14px] font-semibold text-[#333333] mb-3">
                        {var1} vs {var2}
                      </h4>
                      <ResponsiveContainer width="100%" height={350}>
                        <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                          <XAxis 
                            dataKey={var1} 
                            name={var1} 
                            tick={{ fontSize: 11, fill: "#666666" }} 
                            label={{ value: var1, position: "bottom", offset: 0, fontSize: 12, fill: "#333333" }} 
                          />
                          <YAxis 
                            dataKey={var2} 
                            name={var2} 
                            tick={{ fontSize: 11, fill: "#666666" }} 
                            label={{ value: var2, angle: -90, position: "insideLeft", fontSize: 12, fill: "#333333" }} 
                          />
                          <ZAxis range={[80, 80]} />
                          <Tooltip 
                            cursor={{ strokeDasharray: "3 3" }} 
                            contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #E5E5E5" }}
                            formatter={(value: number) => value.toFixed(2)}
                          />
                          {Array.from(new Set(clusters)).sort((a, b) => a - b).map(c => (
                            <Scatter
                              key={c}
                              name={c === -1 ? "Noise" : `Cluster ${c + 1}`}
                              data={vizData.filter(d => d.cluster === c)}
                              fill={vizData.find(d => d.cluster === c)?.fill || "#999999"}
                              fillOpacity={0.7}
                            />
                          ))}
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  ))
                )}
              </div>
            )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
