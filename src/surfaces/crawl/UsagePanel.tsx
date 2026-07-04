import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { RotateCw, AlertCircle, Cpu } from 'lucide-react';
import './UsagePanel.css';

export const UsagePanel: React.FC = () => {
  const { data: usage, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['usage'],
    queryFn: () => api.getUsage(),
    refetchInterval: 10000,
  });

  if (isLoading && !usage) {
    return (
      <div className="usage">
        <div className="skeleton" style={{ height: '40px', width: '220px', marginBottom: 'var(--space-24)' }} />
        <div className="usage__metrics">
          <div className="skeleton" style={{ height: '140px' }} />
          <div className="skeleton" style={{ height: '140px' }} />
          <div className="skeleton" style={{ height: '140px' }} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="usage">
        <div className="callout-error">
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>
            <h3 className="callout-error__title">Error loading usage stats</h3>
            <p className="callout-error__body">{(error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!usage) return null;

  const llm = usage.llm;
  const jobs = usage.jobs;

  return (
    <div className="usage">
      <div className="screen-head">
        <div>
          <h1 className="screen-title">Intelligence Accounting</h1>
          <p className="screen-subtitle">Live aggregated audit of LLM token volume and crawler operations.</p>
        </div>
        <Button onClick={() => refetch()} style={{ minHeight: '38px', minWidth: '38px', padding: '0 12px' }}>
          <RotateCw size={14} className={isLoading ? 'pulse' : ''} />
        </Button>
      </div>

      {/* Big counts — DESIGN §3 hero numerals */}
      <div className="usage__metrics">
        <div className="metric">
          <span className="metric__label">Total Tokens Consumed</span>
          <span className="metric__value">{(llm.total_tokens || 0).toLocaleString()}</span>
          <div className="metric__meta mono">
            <span>in: {(llm.total_input_tokens || 0).toLocaleString()}</span>
            <span>out: {(llm.total_output_tokens || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="metric">
          <span className="metric__label">LLM Judge Eval Calls</span>
          <span className="metric__value">{(llm.calls || 0).toLocaleString()}</span>
          <div className="metric__meta" style={{ alignItems: 'center', color: 'var(--accent)' }}>
            <Cpu size={12} />
            <span>active judge loops</span>
          </div>
        </div>

        <div className="metric">
          <span className="metric__label">Jobs Registered</span>
          <span className="metric__value">{Object.values(jobs).reduce((a, b) => a + b, 0)}</span>
          <div className="metric__meta">
            <span>running: {jobs.running || 0}</span>
            <span>succeeded: {jobs.succeeded || 0}</span>
          </div>
        </div>
      </div>

      <div className="panel panel--pad">
        <h2 className="panel__title usage__table-title">Job Registrations by status</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Job State</th>
              <th className="data-table__num">Active Count</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(jobs).map(([status, count]) => (
              <tr key={status}>
                <td className="usage__cell-status">{status}</td>
                <td className="data-table__num mono">{count}</td>
              </tr>
            ))}
            {Object.keys(jobs).length === 0 && (
              <tr>
                <td colSpan={2} style={{ padding: 'var(--space-24) var(--space-12)', textAlign: 'center', color: 'var(--ink-muted)' }}>
                  No jobs registered.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
