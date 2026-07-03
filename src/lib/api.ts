import type { paths } from './api-types';

export type CrawlJobRequest = paths['/api/jobs']['post']['requestBody']['content']['application/json'];
export type JobOut = paths['/api/jobs/{job_id}']['get']['responses']['200']['content']['application/json'];
export type JobSummaryOut = paths['/api/jobs']['get']['responses']['200']['content']['application/json'][number];
export type PageOut = NonNullable<JobOut['pages']>[number];

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`API Error (${res.status}): ${errorText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  submitJob: (data: CrawlJobRequest) =>
    request<{ job_id: string }>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listJobs: (status?: string) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<JobSummaryOut[]>(`/api/jobs${query}`);
  },

  getJob: (jobId: string, includeContent = true) =>
    request<JobOut>(`/api/jobs/${jobId}?include_content=${includeContent}`),

  cancelJob: (jobId: string) =>
    request<{ cancelled: boolean }>(`/api/jobs/${jobId}/cancel`, {
      method: 'POST',
    }),

  getJobEvents: (jobId: string, since = 0) =>
    request<{ events: any[]; next_since: number }>(`/api/jobs/${jobId}/events?since=${since}`),

  getHealthz: () =>
    request<{ status: string; jobs: Record<string, number> }>('/api/healthz'),

  getUsage: () =>
    request<{
      llm: { calls: number; total_tokens: number; total_input_tokens: number; total_output_tokens: number };
      jobs: Record<string, number>;
    }>('/api/usage'),
};
