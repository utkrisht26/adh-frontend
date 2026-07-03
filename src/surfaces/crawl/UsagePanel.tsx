import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { RotateCw, AlertCircle, Cpu } from 'lucide-react';

export const UsagePanel: React.FC = () => {
  const { data: usage, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['usage'],
    queryFn: () => api.getUsage(),
    refetchInterval: 10000, // poll usage statistics every 10 seconds
  });

  if (isLoading && !usage) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 8px' }}>
        <div className="skeleton" style={{ height: '40px', width: '200px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', height: '140px' }}>
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: '16px 8px', color: 'var(--failed)' }}>
        <div style={{ display: 'flex', gap: '8px', border: '1px solid var(--failed)', padding: '16px', borderRadius: 'var(--r-panel)', backgroundColor: 'var(--failed-weak)' }}>
          <AlertCircle size={20} />
          <div>
            <h3 style={{ fontWeight: 600 }}>Error loading usage stats</h3>
            <p>{(error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!usage) return null;

  const llm = usage.llm;
  const jobs = usage.jobs;

  return (
    <div style={{ padding: '8px 4px', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, letterSpacing: '-0.02em' }}>Intelligence Accounting</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', marginTop: '2px' }}>
            Live aggregated audit of LLM token volume and crawler operations.
          </p>
        </div>
        <Button onClick={() => refetch()} style={{ minHeight: '38px', minWidth: '38px', padding: '0 12px' }}>
          <RotateCw size={14} className={isLoading ? 'pulse' : ''} />
        </Button>
      </div>

      {/* Metric Cards Row - DESIGN §3: Big counts metric numerals in mono */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        
        {/* Total Tokens */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-panel)', padding: '16px', backgroundColor: 'var(--surface)' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-caption)', color: 'var(--ink-muted)', fontWeight: 500, marginBottom: '8px' }}>
            Total Tokens Consumed
          </span>
          <span style={{ fontSize: 'var(--text-metric)', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }} className="tabular-nums">
            {(llm.total_tokens || 0).toLocaleString()}
          </span>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: 'var(--text-caption)', color: 'var(--ink-muted)' }} className="mono">
            <span>in: {(llm.total_input_tokens || 0).toLocaleString()}</span>
            <span>out: {(llm.total_output_tokens || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* LLM Calls */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-panel)', padding: '16px', backgroundColor: 'var(--surface)' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-caption)', color: 'var(--ink-muted)', fontWeight: 500, marginBottom: '8px' }}>
            LLM Judge Eval Calls
          </span>
          <span style={{ fontSize: 'var(--text-metric)', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }} className="tabular-nums">
            {(llm.calls || 0).toLocaleString()}
          </span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '8px', fontSize: 'var(--text-caption)', color: 'var(--accent)' }}>
            <Cpu size={12} />
            <span>active judge loops</span>
          </div>
        </div>

        {/* Active Jobs */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-panel)', padding: '16px', backgroundColor: 'var(--surface)' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-caption)', color: 'var(--ink-muted)', fontWeight: 500, marginBottom: '8px' }}>
            Jobs Registered
          </span>
          <span style={{ fontSize: 'var(--text-metric)', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }} className="tabular-nums">
            {Object.values(jobs).reduce((a, b) => a + b, 0)}
          </span>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: 'var(--text-caption)', color: 'var(--ink-muted)' }}>
            <span>running: {jobs.running || 0}</span>
            <span>succeeded: {jobs.succeeded || 0}</span>
          </div>
        </div>

      </div>

      {/* Detailed Table Panel */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-panel)', backgroundColor: 'var(--surface)', padding: '16px' }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: '16px' }}>Job Registrations by status</h2>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--ink-muted)', fontSize: 'var(--text-caption)' }}>
              <th style={{ padding: '6px 12px' }}>Job State</th>
              <th style={{ padding: '6px 12px', textAlign: 'right' }}>Active Count</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(jobs).map(([status, count]) => (
              <tr key={status} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '8px 12px', textTransform: 'capitalize', fontWeight: 500 }}>
                  {status}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }} className="mono tabular-nums">
                  {count}
                </td>
              </tr>
            ))}
            {Object.keys(jobs).length === 0 && (
              <tr>
                <td colSpan={2} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--ink-muted)' }}>
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
