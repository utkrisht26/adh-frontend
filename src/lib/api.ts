import type { paths, components } from './api-types';

// Crawl endpoints moved from /api/* to /api/crawl/* when the harness grew its
// gateway (per-domain routers); regenerate types with `npm run gen:api`.
export type CrawlJobRequest = paths['/api/crawl/jobs']['post']['requestBody']['content']['application/json'];
export type JobOut = paths['/api/crawl/jobs/{job_id}']['get']['responses']['200']['content']['application/json'];
export type JobSummaryOut = paths['/api/crawl/jobs']['get']['responses']['200']['content']['application/json'][number];
export type PageOut = NonNullable<JobOut['pages']>[number];

// Run and discovery schemas
export type RunSummaryOut = components['schemas']['RunSummaryOut'];
export type RunOut = components['schemas']['RunOut'];
export type PlanOut = components['schemas']['PlanOut'];
export type PlanSourceOut = components['schemas']['PlanSourceOut'];
export type PlanAspectOut = components['schemas']['PlanAspectOut'];
// FastAPI emits separate shapes for JobSpec as request body (-Input) vs
// response model (-Output, e.g. GET /runs/{id}/spec); same wire document.
export type JobSpec = components['schemas']['JobSpec-Input'];
export type JobSpecSaved = components['schemas']['JobSpec-Output'];
export type ApprovalRequest = components['schemas']['ApprovalRequest'];
export type MetricsOut = components['schemas']['MetricsOut'];
export type Limits = components['schemas']['Limits'];

export type SpecBuilderSchema = components['schemas']['SpecBuilderSchema'];
export type SpecIssue = components['schemas']['SpecIssue'];
export type SpecValidationResult = components['schemas']['SpecValidationResult'];
export type TelemetryEvent = components['schemas']['TelemetryEventOut'];

// Engine B build summary (engine_b_summary.json). The endpoint returns a
// free-form dict, so this mirrors the writer's shape — every field optional so
// older/edge summaries render instead of crashing the panel.
export interface DatasetQualityBlock {
  total_records?: number;
  counts_by_split?: Record<string, number>;
  duplicate_rate?: number;
  contamination_residual_count?: number;
  license_coverage?: number;
  schema_validation_pass_rate?: number;
  pii_residual_count?: number;
  warnings?: string[];
}

export interface DatasetSummary {
  job_id?: string;
  engine?: string;
  exit_reason?: string;
  counts?: {
    generated?: number;
    accepted?: number;
    accept_rate?: number;
    dropped_novelty?: number;
    dropped_quality?: number;
    dropped_verifier?: number;
    dropped_jury?: number;
    duplicates?: number;
    dead_lettered?: number;
    pii_dropped?: number;
    pii_redacted?: number;
    contaminated?: number;
    total_records?: number;
    tokens_per_accepted_record?: number;
    cost_per_accepted_record?: number | null;
    thin_aspects?: string[];
  };
  output_format?: string;
  counts_by_split?: Record<string, number>;
  coverage?: {
    per_aspect?: Record<string, number>;
    target_per_aspect?: number;
    thin_aspects?: string[];
  };
  quality?: DatasetQualityBlock | null;
  notes?: string[];
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getApiKey(): string {
  try { return sessionStorage.getItem('adh_api_key') || ''; } catch { return ''; }
}

export function setApiKey(key: string) {
  if (key.trim()) sessionStorage.setItem('adh_api_key', key.trim());
  else sessionStorage.removeItem('adh_api_key');
  window.dispatchEvent(new Event('adh:credentials-changed'));
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body) headers.set('Content-Type', 'application/json');
  const key = getApiKey();
  if (key && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${key}`);
  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers,
      signal: options?.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    throw new Error('Unable to reach the server. Check the connection and try again.');
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) window.dispatchEvent(new Event('adh:auth-required'));
    const body: unknown = await res.json().catch(() => null);
    const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null;
    const message = typeof detail === 'string' ? detail : Array.isArray(detail)
      ? detail.map(issue => `${issue.loc?.slice(1).join('.') || 'Request'}: ${issue.msg || 'Invalid value'}`).join('\n')
      : `Request failed (${res.status}). Please try again.`;
    throw new ApiError(res.status, res.status === 401 ? 'An API key is required. Open Connection settings to connect.' : message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  testConnection: (key: string) => request<RunSummaryOut[]>('/api/runs', {
    headers: { Authorization: key.trim() ? `Bearer ${key.trim()}` : '' },
  }),
  getSpecBuilder: () => request<SpecBuilderSchema>('/api/specs/schema'),
  validateSpec: (spec: Record<string, unknown>) => request<SpecValidationResult>('/api/specs/validate', {
    method: 'POST', body: JSON.stringify({ spec }),
  }),
  importSpec: (yaml_text: string) => request<SpecValidationResult>('/api/specs/import', {
    method: 'POST', body: JSON.stringify({ yaml_text }),
  }),
  submitJob: (data: CrawlJobRequest) =>
    request<{ job_id: string }>('/api/crawl/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listJobs: (status?: string) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<JobSummaryOut[]>(`/api/crawl/jobs${query}`);
  },

  getJob: (jobId: string, includeContent = true) =>
    request<JobOut>(`/api/crawl/jobs/${encodeURIComponent(jobId)}?include_content=${includeContent}`),

  cancelJob: (jobId: string) =>
    request<{ cancelled: boolean }>(`/api/crawl/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
    }),

  getJobEvents: (jobId: string, since = 0) =>
    request<{ events: any[]; next_since: number }>(`/api/crawl/jobs/${encodeURIComponent(jobId)}/events?since=${since}`),

  getHealthz: () =>
    request<{ status: string; jobs: Record<string, number> }>('/api/healthz'),

  getUsage: () =>
    request<{
      llm: { calls: number; total_tokens: number; total_input_tokens: number; total_output_tokens: number };
      jobs: Record<string, number>;
    }>('/api/crawl/usage'),

  // Run lifecycle (Phase 2)
  createRun: (data: JobSpec) =>
    request<RunSummaryOut>('/api/runs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listRuns: () =>
    request<RunSummaryOut[]>('/api/runs'),

  getRun: (runId: string) =>
    request<RunOut>(`/api/runs/${encodeURIComponent(runId)}`),

  getRunEvents: (runId: string, after = 0, signal?: AbortSignal) =>
    request<TelemetryEvent[]>(`/api/runs/${encodeURIComponent(runId)}/events?after=${after}&limit=200`, { signal }),

  approveRun: (runId: string, data: ApprovalRequest) =>
    request<RunSummaryOut>(`/api/runs/${encodeURIComponent(runId)}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelRun: (runId: string) =>
    request<RunSummaryOut>(`/api/runs/${encodeURIComponent(runId)}/cancel`, {
      method: 'POST',
    }),

  // Engine B synthesis + curation over a succeeded run's corpus (202; poll status)
  buildRun: (runId: string) =>
    request<RunSummaryOut>(`/api/runs/${encodeURIComponent(runId)}/build`, {
      method: 'POST',
    }),

  // The saved JobSpec of a run — the prefill source for edit-and-restart
  getRunSpec: (runId: string) =>
    request<JobSpecSaved>(`/api/runs/${encodeURIComponent(runId)}/spec`),

  // Start a NEW run from a terminal run's config — same saved spec, or an
  // edited one passed as { spec } for the restart-with-changes flow
  restartRun: (runId: string, data?: { spec: JobSpec }) =>
    request<RunSummaryOut>(`/api/runs/${encodeURIComponent(runId)}/restart`, {
      method: 'POST',
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    }),

  // The Engine B summary once a dataset has been built, else 404
  getDatasetSummary: (runId: string) =>
    request<DatasetSummary>(`/api/runs/${encodeURIComponent(runId)}/dataset`),
};
