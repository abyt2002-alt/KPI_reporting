/**
 * API Service - Connect to FastAPI backend
 */

// In production behind Nginx, use same-origin paths by default.
// In local dev, also prefer same-origin and rely on Vite proxy.
const rawApiUrl = import.meta.env.VITE_API_URL?.trim();
const API_BASE_URL = rawApiUrl
  ? rawApiUrl.replace(/\/+$/, "")
  : "";

// Log the API URL for debugging
console.log('[API] Backend URL:', API_BASE_URL);

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const error = await response.json();
      return error?.detail || error?.message || fallback;
    } catch {
      return fallback;
    }
  }

  try {
    const text = await response.text();
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}

export interface UploadAnalysisResponse {
  filename: string;
  file_type: string;
  profiling_mode: 'full' | 'sampled';
  row_count: number;
  row_count_is_estimated: boolean;
  column_count: number;
  sample_row_count: number;
  sample_rows: Record<string, unknown>[];
  columns: Array<{
    n: string;
    d: string;
    t: 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'text' | 'id' | 'unknown';
    null: number;
    uniq: number;
    note?: string;
    s?: unknown[];
    stats?: Record<string, number>;
    range?: { min: string; max: string } | null;
    top?: { value: string; count: number }[];
  }>;
  column_groups: Record<string, string[]>;
  time_column?: string | null;
  date_range?: { min: string; max: string } | null;
  summary: {
    title: string;
    dataset_theme: string;
    story: string[];
    warnings: string[];
    analysis_angles: string[];
  };
  dataset_theme: string;
  model_used: string;
  used_fallback: boolean;
}

/**
 * Generic fetch wrapper with error handling and timeout
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<ApiResponse<T>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { error: await readErrorMessage(response, 'API request failed') };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { error: 'Request timeout. Backend may be unreachable. Check your network connection.' };
    }
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

/**
 * Health check
 */
export async function checkHealth(): Promise<boolean> {
  const result = await fetchApi<{ status: string }>('/health');
  return result.data?.status === 'healthy';
}

export type IngestionSource = 'google_ads' | 'google_analytics' | 'meta_ads' | 'shopify' | 'amazon_ads';

export interface IngestionRequest {
  source: IngestionSource;
  template_key: string;
  account_id: string;
  start_date: string;
  end_date: string;
  columns: string[];
}

export interface IngestionResponse {
  ingestion_id: string;
  source: IngestionSource;
  source_label: string;
  template_key: string;
  template_label: string;
  account_id: string;
  account_label: string;
  status: string;
  start_date: string;
  end_date: string;
  row_count: number;
  column_count: number;
  requested_columns: string[];
  required_columns: string[];
  optional_columns: string[];
  preview_rows: Record<string, unknown>[];
  columns: Array<{
    name: string;
    type: 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'text' | 'id' | 'unknown';
  }>;
  key_metrics: Record<string, number>;
  warnings: string[];
  notes: string[];
  column_groups: Record<string, string[]>;
  received_at: string;
  download_filename: string;
}

export async function ingestData(params: IngestionRequest): Promise<ApiResponse<IngestionResponse>> {
  return fetchApi('/ingest', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Upload CSV file to backend
 */
export async function uploadFile(file: File): Promise<ApiResponse<{
  filename: string;
  rows: number;
  columns: string[];
}>> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for file upload

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { error: await readErrorMessage(response, 'Upload failed') };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { error: 'Upload timeout. Backend may be unreachable.' };
    }
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

/**
 * Analyze an uploaded file and generate an AI summary.
 */
export async function analyzeUploadFile(file: File): Promise<ApiResponse<UploadAnalysisResponse>> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(`${API_BASE_URL}/analysis/upload-summary`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { error: await readErrorMessage(response, 'Upload analysis failed') };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { error: 'Upload analysis timeout. Backend may be unreachable.' };
    }
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

export interface KpiSummaryMetric {
  label: string;
  value: number;
  formatted_value: string;
  trend_percent: number | null;
  kind: string;
}

export interface KpiSummaryResponse {
  headline: string;
  overview: string;
  insights: string[];
  actions: string[];
  watchout: string;
  model_used: string;
}

export async function generateKpiSummary(params: {
  time_range: string;
  market: string;
  category: string;
  source: string;
  metrics: KpiSummaryMetric[];
}): Promise<ApiResponse<KpiSummaryResponse>> {
  return fetchApi('/analysis/kpi-summary', {
    method: 'POST',
    body: JSON.stringify(params),
  }, 60000);
}

export async function generateKpiCompareSummary(params: {
  left: {
    label: string;
    time_range: string;
    market: string;
    category: string;
    source: string;
    metrics: KpiSummaryMetric[];
  };
  right: {
    label: string;
    time_range: string;
    market: string;
    category: string;
    source: string;
    metrics: KpiSummaryMetric[];
  };
}): Promise<ApiResponse<KpiSummaryResponse>> {
  return fetchApi('/analysis/kpi-compare-summary', {
    method: 'POST',
    body: JSON.stringify(params),
  }, 60000);
}

/**
 * Run prediction model
 */
export async function runPrediction(params: {
  data: Record<string, unknown>[];
  target_column: string;
  feature_columns: string[];
  model_type?: string;
  standardization?: string;
  non_positive_features?: string[];
  non_negative_features?: string[];
  remove_outliers?: boolean;
}): Promise<ApiResponse<{
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
}>> {
  return fetchApi('/predict', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Calculate correlation matrix
 */
export async function getCorrelation(params: {
  data: Record<string, unknown>[];
  columns: string[];
}): Promise<ApiResponse<{
  correlation_matrix: Record<string, Record<string, number>>;
}>> {
  return fetchApi('/analyze/correlation', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Adstock transformation settings
 */
export interface AdstockSettings {
  enabled: boolean;
  columns: string[];
  decay: number;
  auto: boolean;
  candidate_decays?: number[];
}

/**
 * Logistic S-curve transformation settings
 */
export interface LogisticSettings {
  enabled: boolean;
  columns: string[];
  steepness: number;
  midpoint: number;
  auto: boolean;
  candidate_k?: number[];
  candidate_midpoints?: number[];
  steepness_map?: Record<string, number>;
  midpoint_map?: Record<string, number>;
}

/**
 * Run Kalman Filter model
 */
export async function runKalmanFilter(params: {
  data: Record<string, unknown>[];
  target_column: string;
  feature_columns: string[];
  q?: number;
  r?: number;
  adaptive?: boolean;
  standardize?: boolean;
  non_positive_features?: string[];
  non_negative_features?: string[];
  adstock_settings?: AdstockSettings;
  logistic_settings?: LogisticSettings;
}): Promise<ApiResponse<{
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
}>> {
  return fetchApi('/kalman', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Generic model endpoint caller
 */
export async function callModelEndpoint<T>(
  endpoint: string,
  data: unknown
): Promise<ApiResponse<T>> {
  return fetchApi<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


// ============== AUTH API ==============

/**
 * Register a new user
 */
export async function registerUser(params: {
  username: string;
  password: string;
  email?: string;
}): Promise<ApiResponse<{
  id: number;
  username: string;
  email?: string;
  created_at: string;
}>> {
  return fetchApi('/api/db/users/register', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Login user
 */
export async function loginUser(params: {
  username: string;
  password: string;
}): Promise<ApiResponse<{
  id: number;
  username: string;
  email?: string;
  created_at: string;
  last_login?: string;
}>> {
  return fetchApi('/api/db/users/login', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}


// ============== AI INSIGHTS API ==============

export interface MetricValue {
  value: string;
  change_percent: number;
}

export interface AIInsightsRequest {
  revenue: MetricValue;
  orders: MetricValue;
  media_spend: MetricValue;
  google_spend: MetricValue;
  aov: MetricValue;
  new_customers_pct: MetricValue;
  meta_roas: MetricValue;
  google_roas: MetricValue;
  region?: string;
  product?: string;
  period?: string;
}

export interface AIInsightsResponse {
  headline: string;
  bullets: string[];
  green_flag: string;
  red_flag: string;
  variants?: Array<{
    headline: string;
    bullets: string[];
    green_flag: string;
    red_flag: string;
  }>;
  retrieval_examples?: string[];
  rag_scope?: string;
}

/**
 * Generate AI insights based on 8 KPI metrics
 */
export async function generateAIInsights(params: AIInsightsRequest): Promise<ApiResponse<AIInsightsResponse>> {
  return fetchApi('/ai/generate-insights', {
    method: 'POST',
    body: JSON.stringify(params),
  }, 30000);
}
