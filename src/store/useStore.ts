import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IngestionSource, KpiSummaryResponse } from '../services/api';
import { FY25_DEFAULT_CUSTOM_END, FY25_DEFAULT_CUSTOM_START } from '../modules/summaryConfig';

export interface ColumnMeta {
  name: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'text' | 'id' | 'unknown';
}

export interface Dataset {
  rows: Record<string, unknown>[];
  columns: ColumnMeta[];
  rowCount?: number;
  isSampled?: boolean;
  sampleRowCount?: number;
  fileType?: string;
}

export interface UploadSummary {
  title: string;
  datasetTheme: string;
  story: string[];
  warnings: string[];
  analysisAngles: string[];
  modelUsed: string;
  usedFallback: boolean;
  profilingMode: 'full' | 'sampled';
  rowCount: number;
  rowCountIsEstimated: boolean;
  columnCount: number;
  sampleRowCount: number;
  fileType: string;
  timeColumn?: string | null;
  dateRange?: { min: string; max: string } | null;
  columnGroups?: Record<string, string[]>;
}

export interface ChartConfig {
  id: string;
  type: 'line' | 'bar' | 'pie';
  title: string;
  subtitle?: string;
  xColumn: string;
  yColumns: string[];
  showLegend: boolean;
  dualAxis?: boolean;
  normalize?: boolean; // Scale all values to 0-1 range
  leftAxisColumns?: string[];
  rightAxisColumns?: string[];
  leftAxisMin?: number;
  leftAxisMax?: number;
  rightAxisMin?: number;
  rightAxisMax?: number;
}

// Report item - saved chart/table as image
export interface ReportItem {
  id: string;
  title: string;
  imageData: string; // base64 PNG
  type: 'chart' | 'table' | 'metrics';
  createdAt: string;
  comment?: string; // User comment/note for this item
}

// Saved report - collection of items with a name
export interface SavedReport {
  id: string;
  name: string;
  items: ReportItem[];
  createdAt: string;
  updatedAt: string;
}



export interface CorrelationSelection {
  col1: string;
  col2: string;
  r: number;
  lag: number;
}

// Chart creation form state
export interface ChartFormState {
  chartType: 'line' | 'bar' | 'pie';
  title: string;
  xCol: string;
  yCols: string[];
  showLegend: boolean;
  dualAxis: boolean;
  normalize: boolean;
  leftCols: string[];
  rightCols: string[];
  leftMin: string;
  leftMax: string;
  rightMin: string;
  rightMax: string;
}

// Clustering state
export interface ClusteringState {
  algorithm: 'kmeans' | 'dbscan';
  selectedVars: string[];
  kValue: number;
  epsValue: number;
  minPtsValue: number;
  filterCatCol: string;
  filterCatValue: string;
  // Results
  clusters: number[] | null;
  elbowData: { k: number; inertia: number }[] | null;
  showElbow: boolean;
  optimalK: number | null;
}

// Time Series state
export interface TimeSeriesState {
  timeCol: string;
  valueCol: string;
  smaWindow: number;
  emaWindow: number;
  seasonalPeriod: number;
  showSMA: boolean;
  showEMA: boolean;
  showDecomposition: boolean;
  filterTimeCol: string;
  filterCatCol: string;
  filterCatValue: string;
}

// Kalman state - persisted results
export interface KalmanState {
  // Configuration
  targetCol: string;
  featureCols: string[];
  q: number;
  r: number;
  adaptive: boolean;
  standardize: boolean;
  nonPositiveFeatures: string[];
  nonNegativeFeatures: string[];
  // Adstock settings
  adstockEnabled: boolean;
  adstockCols: string[];
  adstockDecay: number;
  adstockAuto: boolean;
  // S-curve settings
  scurveEnabled: boolean;
  scurveCols: string[];
  scurveSteepness: number;
  scurveMidpoint: number;
  scurveAuto: boolean;
  // Results (persisted)
  results: {
    predictions: number[];
    actuals: number[];
    metrics: { r2: number; mape: number; mae: number };
    coefficients: Record<string, number>;
    coefficientsInstantaneous: Record<string, number>;
    tvCoefficients: Record<string, number[]>;
    elasticities: Record<string, number>;
    contributions: Record<string, number>;
    qHistory: number[];
    rHistory: number[];
    adstockDecays: Record<string, number> | null;
    logisticMetadata: Record<string, unknown> | null;
  } | null;
  // UI state
  hasRun: boolean;
}

// Modeling state - persisted results
export interface ModelingState {
  // Configuration
  targetCol: string;
  featureCols: string[];
  modelType: string;
  standardization: string;
  nonPositiveFeatures: string[];
  nonNegativeFeatures: string[];
  removeOutliers: boolean;
  // Results
  results: {
    predictions: number[];
    actuals: number[];
    metrics: Record<string, number>;
    coefficients: Record<string, number>;
    elasticities: Record<string, number>;
    contributions: Record<string, number>;
  } | null;
  hasRun: boolean;
}

export interface User {
  id: number;
  email: string;
  name: string;
}

export type Theme = 'light' | 'dark' | 'auto';
export type SummaryTimeRange = 'yesterday' | 'last_7' | 'last_13' | 'last_30' | 'last_90' | 'last_180' | 'last_365' | 'custom';
export type SummaryMarketFilter = 'all' | 'US' | 'UK' | 'UAE';
export type SummaryCategoryFilter = 'all' | 'ring' | 'necklace' | 'bracelet' | 'earring';
export type SummarySourceFilter = 'all' | 'shopify' | 'amazon';

export interface CachedAiSummary {
  data: KpiSummaryResponse | null;
  signature: string | null;
  error: string | null;
  isLoading: boolean;
}

interface AppState {
  // Auth state
  user: User | null;
  isAuthenticated: boolean;
  // Settings
  theme: Theme;
  compactMode: boolean;
  // App state
  dataset: Dataset | null;
  uploadSummary: UploadSummary | null;
  charts: ChartConfig[];
  // Current report (working draft)
  currentReportItems: ReportItem[];
  // Saved reports
  savedReports: SavedReport[];
  activeTab: 'upload' | 'summary' | 'campaign_assessment' | 'roas_playground' | 'charts' | 'modeling' | 'kalman' | 'reports';
  summaryTimeRange: SummaryTimeRange;
  summaryMarketFilter: SummaryMarketFilter;
  summaryCategoryFilter: SummaryCategoryFilter;
  summarySourceFilter: SummarySourceFilter;
  summaryStartDate: string;
  summaryEndDate: string;
  ingestionModalSource: IngestionSource | null;
  isIngestionModalOpen: boolean;
  // AI Summary cache
  aiSummaryCache: CachedAiSummary;
  // Chart creation form state (persisted)
  chartForm: ChartFormState;
  // Clustering state
  clusteringState: ClusteringState;
  // Time Series state
  timeSeriesState: TimeSeriesState;

  // Kalman state (persisted)
  kalmanState: KalmanState;
  // Modeling state (persisted)
  modelingState: ModelingState;
  // Correlation state
  correlationSection: 'charts' | 'correlation' | 'clustering' | 'timeseries';
  correlationCol1: string;
  correlationCol2: string;
  correlationTimeCol: string;
  correlationLag: number;
  selectedCorrelation: CorrelationSelection | null;
  // Actions
  setDataset: (dataset: Dataset) => void;
  setUploadSummary: (summary: UploadSummary | null) => void;
  openIngestionModal: (source: IngestionSource) => void;
  closeIngestionModal: () => void;
  addChart: (chart: ChartConfig) => void;
  removeChart: (id: string) => void;
  updateChart: (id: string, updates: Partial<ChartConfig>) => void;
  setActiveTab: (tab: 'upload' | 'summary' | 'campaign_assessment' | 'roas_playground' | 'charts' | 'modeling' | 'kalman' | 'reports') => void;
  setSummaryTimeRange: (range: SummaryTimeRange) => void;
  setSummaryMarketFilter: (market: SummaryMarketFilter) => void;
  setSummaryCategoryFilter: (category: SummaryCategoryFilter) => void;
  setSummarySourceFilter: (source: SummarySourceFilter) => void;
  setSummaryDateRange: (startDate: string, endDate: string) => void;
  // AI Summary cache actions
  setAiSummaryCache: (cache: Partial<CachedAiSummary>) => void;
  clearAiSummaryCache: () => void;
  // Report item actions
  updateReportItemComment: (itemId: string, comment: string) => void;
  updateSavedReportItemComment: (reportId: string, itemId: string, comment: string) => void;
  updateChartForm: (updates: Partial<ChartFormState>) => void;
  resetChartFormTitle: () => void;
  updateClusteringState: (updates: Partial<ClusteringState>) => void;
  updateTimeSeriesState: (updates: Partial<TimeSeriesState>) => void;

  updateKalmanState: (updates: Partial<KalmanState>) => void;
  updateModelingState: (updates: Partial<ModelingState>) => void;
  setCorrelationSection: (section: 'charts' | 'correlation' | 'clustering' | 'timeseries') => void;
  setCorrelationCol1: (col: string) => void;
  setCorrelationCol2: (col: string) => void;
  setCorrelationTimeCol: (col: string) => void;
  setCorrelationLag: (lag: number) => void;
  setSelectedCorrelation: (corr: CorrelationSelection | null) => void;
  // Auth actions
  login: (user: User) => void;
  logout: () => void;
  // Settings actions
  setTheme: (theme: Theme) => void;
  setCompactMode: (compact: boolean) => void;
  // Current report actions
  addToCurrentReport: (item: ReportItem) => void;
  removeFromCurrentReport: (id: string) => void;
  clearCurrentReport: () => void;
  // Saved reports actions
  saveCurrentReport: (name: string) => void;
  deleteSavedReport: (id: string) => void;
  loadSavedReport: (id: string) => void;
  clearAll: () => void;
}

const defaultChartForm: ChartFormState = {
  chartType: 'bar',
  title: '',
  xCol: '',
  yCols: [],
  showLegend: true,
  dualAxis: false,
  normalize: false,
  leftCols: [],
  rightCols: [],
  leftMin: '',
  leftMax: '',
  rightMin: '',
  rightMax: '',
};

const defaultClusteringState: ClusteringState = {
  algorithm: 'kmeans',
  selectedVars: [],
  kValue: 3,
  epsValue: 0.5,
  minPtsValue: 5,
  filterCatCol: '',
  filterCatValue: '',
  clusters: null,
  elbowData: null,
  showElbow: false,
  optimalK: null,
};

const defaultTimeSeriesState: TimeSeriesState = {
  timeCol: '',
  valueCol: '',
  smaWindow: 7,
  emaWindow: 7,
  seasonalPeriod: 12,
  showSMA: true,
  showEMA: false,
  showDecomposition: false,
  filterTimeCol: '',
  filterCatCol: '',
  filterCatValue: '',
};

const defaultKalmanState: KalmanState = {
  targetCol: '',
  featureCols: [],
  q: 0.0001,
  r: 1.0,
  adaptive: true,
  standardize: true,
  nonPositiveFeatures: [],
  nonNegativeFeatures: [],
  adstockEnabled: false,
  adstockCols: [],
  adstockDecay: 0.5,
  adstockAuto: false,
  scurveEnabled: false,
  scurveCols: [],
  scurveSteepness: 1.0,
  scurveMidpoint: 0.5,
  scurveAuto: false,
  results: null,
  hasRun: false,
};

const defaultModelingState: ModelingState = {
  targetCol: '',
  featureCols: [],
  modelType: 'ols',
  standardization: 'none',
  nonPositiveFeatures: [],
  nonNegativeFeatures: [],
  removeOutliers: false,
  results: null,
  hasRun: false,
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth state
      user: null,
      isAuthenticated: false,
      // Settings
      theme: 'light',
      compactMode: false,
      // App state
      dataset: null,
      uploadSummary: null,
      charts: [],
      currentReportItems: [],
      savedReports: [],
      activeTab: 'upload',
      summaryTimeRange: 'last_30',
      summaryMarketFilter: 'all',
      summaryCategoryFilter: 'all',
      summarySourceFilter: 'all',
      summaryStartDate: FY25_DEFAULT_CUSTOM_START,
      summaryEndDate: FY25_DEFAULT_CUSTOM_END,
      ingestionModalSource: null,
      isIngestionModalOpen: false,
      // AI Summary cache
      aiSummaryCache: {
        data: null,
        signature: null,
        error: null,
        isLoading: false,
      },
      // Chart form state
      chartForm: { ...defaultChartForm },
      // Clustering state
      clusteringState: { ...defaultClusteringState },
      // Time Series state
      timeSeriesState: { ...defaultTimeSeriesState },

      // Kalman state
      kalmanState: { ...defaultKalmanState },
      // Modeling state
      modelingState: { ...defaultModelingState },
      // Correlation state
      correlationSection: 'charts',
      correlationCol1: '',
      correlationCol2: '',
      correlationTimeCol: '',
      correlationLag: 0,
      selectedCorrelation: null,
      // Actions
      setDataset: (dataset) => set({ dataset }),
      setUploadSummary: (uploadSummary) => set({ uploadSummary }),
      openIngestionModal: (ingestionModalSource) => set({ ingestionModalSource, isIngestionModalOpen: true }),
      closeIngestionModal: () => set({ ingestionModalSource: null, isIngestionModalOpen: false }),
      addChart: (chart) => set((s) => ({ charts: [...s.charts, chart] })),
      removeChart: (id) => set((s) => ({ charts: s.charts.filter((c) => c.id !== id) })),
      updateChart: (id, updates) => set((s) => ({ 
        charts: s.charts.map((c) => c.id === id ? { ...c, ...updates } : c) 
      })),
      setActiveTab: (activeTab) => set({ activeTab }),
      setSummaryTimeRange: (summaryTimeRange) => set({ summaryTimeRange }),
      setSummaryMarketFilter: (summaryMarketFilter) => set({ summaryMarketFilter }),
      setSummaryCategoryFilter: (summaryCategoryFilter) => set({ summaryCategoryFilter }),
      setSummarySourceFilter: (summarySourceFilter) => set({ summarySourceFilter }),
      setSummaryDateRange: (summaryStartDate, summaryEndDate) => set({ summaryStartDate, summaryEndDate }),
      // AI Summary cache actions
      setAiSummaryCache: (cache) => set((s) => ({ aiSummaryCache: { ...s.aiSummaryCache, ...cache } })),
      clearAiSummaryCache: () => set({ aiSummaryCache: { data: null, signature: null, error: null, isLoading: false } }),
      updateChartForm: (updates) => set((s) => ({ chartForm: { ...s.chartForm, ...updates } })),
      resetChartFormTitle: () => set((s) => ({ chartForm: { ...s.chartForm, title: '' } })),
      updateClusteringState: (updates) => set((s) => ({ clusteringState: { ...s.clusteringState, ...updates } })),
      updateTimeSeriesState: (updates) => set((s) => ({ timeSeriesState: { ...s.timeSeriesState, ...updates } })),

      updateKalmanState: (updates) => set((s) => ({ kalmanState: { ...s.kalmanState, ...updates } })),
      updateModelingState: (updates) => set((s) => ({ modelingState: { ...s.modelingState, ...updates } })),
      setCorrelationSection: (correlationSection) => set({ correlationSection }),
      setCorrelationCol1: (correlationCol1) => set({ correlationCol1 }),
      setCorrelationCol2: (correlationCol2) => set({ correlationCol2 }),
      setCorrelationTimeCol: (correlationTimeCol) => set({ correlationTimeCol }),
      setCorrelationLag: (correlationLag) => set({ correlationLag }),
      setSelectedCorrelation: (selectedCorrelation) => set({ selectedCorrelation }),
      // Auth actions
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
      // Settings actions
      setTheme: (theme) => set({ theme }),
      setCompactMode: (compactMode) => set({ compactMode }),
      // Current report actions
      addToCurrentReport: (item) => set((s) => ({ currentReportItems: [...s.currentReportItems, item] })),
      removeFromCurrentReport: (id) => set((s) => ({ currentReportItems: s.currentReportItems.filter((r) => r.id !== id) })),
      clearCurrentReport: () => set({ currentReportItems: [] }),
      updateReportItemComment: (itemId, comment) => set((s) => ({
        currentReportItems: s.currentReportItems.map((item) =>
          item.id === itemId ? { ...item, comment } : item
        ),
      })),
      updateSavedReportItemComment: (reportId, itemId, comment) => set((s) => ({
        savedReports: s.savedReports.map((report) =>
          report.id === reportId
            ? {
                ...report,
                items: report.items.map((item) =>
                  item.id === itemId ? { ...item, comment } : item
                ),
                updatedAt: new Date().toISOString(),
              }
            : report
        ),
      })),
      // Saved reports actions
      saveCurrentReport: (name) => set((s) => {
        if (s.currentReportItems.length === 0) return s;
        const newReport: SavedReport = {
          id: crypto.randomUUID(),
          name,
          items: [...s.currentReportItems],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return { savedReports: [...s.savedReports, newReport], currentReportItems: [] };
      }),
      deleteSavedReport: (id) => set((s) => ({ savedReports: s.savedReports.filter((r) => r.id !== id) })),
      loadSavedReport: (id) => set((s) => {
        const report = s.savedReports.find((r) => r.id === id);
        if (!report) return s;
        return { currentReportItems: [...report.items] };
      }),
      clearAll: () => set(() => ({
        dataset: null,
        uploadSummary: null,
        charts: [],
        activeTab: 'upload',
        summaryTimeRange: 'last_30',
        summaryMarketFilter: 'all',
        summaryCategoryFilter: 'all',
        summarySourceFilter: 'all',
        summaryStartDate: FY25_DEFAULT_CUSTOM_START,
        summaryEndDate: FY25_DEFAULT_CUSTOM_END,
        ingestionModalSource: null,
        isIngestionModalOpen: false,
        chartForm: { ...defaultChartForm },
        correlationSection: 'charts',
        correlationCol1: '',
        correlationCol2: '',
        correlationTimeCol: '',
        correlationLag: 0,
        selectedCorrelation: null,
      })),
    }),
    {
      name: 'report-maker-storage',
      partialize: (state) => ({
        // Auth state
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // Settings
        theme: state.theme,
        compactMode: state.compactMode,
        // Only persist lightweight state - NOT the dataset
        charts: state.charts,
        // Persist current report items (limit to 20)
        currentReportItems: state.currentReportItems.slice(-20),
        // Persist saved reports (limit to 10 reports, 15 items each)
        savedReports: state.savedReports.slice(-10).map(r => ({
          ...r,
          items: r.items.slice(-15)
        })),
        activeTab: state.activeTab,
        summaryTimeRange: state.summaryTimeRange,
        summaryMarketFilter: state.summaryMarketFilter,
        summaryCategoryFilter: state.summaryCategoryFilter,
        summarySourceFilter: state.summarySourceFilter,
        summaryStartDate: state.summaryStartDate,
        summaryEndDate: state.summaryEndDate,
        // Persist AI summary cache
        aiSummaryCache: state.aiSummaryCache,
        chartForm: state.chartForm,
        clusteringState: state.clusteringState,
        timeSeriesState: state.timeSeriesState,

        // Persist Kalman state with limited results (skip large arrays for localStorage)
        kalmanState: {
          ...state.kalmanState,
          results: state.kalmanState.results ? {
            ...state.kalmanState.results,
            // Keep only last 500 points to avoid localStorage limits
            predictions: state.kalmanState.results.predictions.slice(-500),
            actuals: state.kalmanState.results.actuals.slice(-500),
            qHistory: state.kalmanState.results.qHistory.slice(-500),
            rHistory: state.kalmanState.results.rHistory.slice(-500),
            // Limit TV coefficients to last 500 points per feature
            tvCoefficients: Object.fromEntries(
              Object.entries(state.kalmanState.results.tvCoefficients).map(
                ([k, v]) => [k, v.slice(-500)]
              )
            ),
          } : null,
        },
        // Persist Modeling state with limited results
        modelingState: {
          ...state.modelingState,
          results: state.modelingState.results ? {
            ...state.modelingState.results,
            predictions: state.modelingState.results.predictions.slice(-500),
            actuals: state.modelingState.results.actuals.slice(-500),
          } : null,
        },
        correlationSection: state.correlationSection,
        correlationCol1: state.correlationCol1,
        correlationCol2: state.correlationCol2,
        correlationTimeCol: state.correlationTimeCol,
        correlationLag: state.correlationLag,
        selectedCorrelation: state.selectedCorrelation,
      }),
      version: 5, // Increment to force localStorage reset
      migrate: (persistedState: unknown, version: number) => {
        if (version < 4) {
          // Reset to defaults for new state structure
          return {
            ...(persistedState as Record<string, unknown>),
            ingestionModalSource: null,
            isIngestionModalOpen: false,
            summaryTimeRange: 'last_30',
            summaryMarketFilter: 'all',
            summaryCategoryFilter: 'all',
            summarySourceFilter: 'all',
            summaryStartDate: FY25_DEFAULT_CUSTOM_START,
            summaryEndDate: FY25_DEFAULT_CUSTOM_END,
            kalmanState: { ...defaultKalmanState },
            modelingState: { ...defaultModelingState },
          } as AppState;
        }
        if (version < 5) {
          return {
            ...(persistedState as Record<string, unknown>),
            summaryCategoryFilter: 'all',
            summarySourceFilter: 'all',
          } as AppState;
        }
        return persistedState as AppState;
      },
    }
  )
);
