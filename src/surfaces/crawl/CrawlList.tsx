import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { AlertCircle, RotateCw, ExternalLink } from 'lucide-react';

export const CrawlList: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: jobs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['jobs', statusFilter],
    queryFn: () => api.listJobs(statusFilter === 'all' ? undefined : statusFilter),
    refetchInterval: 5000, // poll list every 5 seconds
  });

  const formatDuration = (sec: number) => {
    if (sec <= 0) return '0.0s';
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}m ${Math.floor(s)}s`;
  };

  const formatTime = (ts: number) => {
    return new Date(ts * 1000).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const middleTruncate = (text: string, maxLen = 60) => {
    if (!text || text.length <= maxLen) return text;
    const half = Math.floor(maxLen / 2) - 2;
    return text.substring(0, half) + '…' + text.substring(text.length - half);
  };

  const filterTabs = ['all', 'queued', 'running', 'succeeded', 'failed', 'cancelled'];

  return (
    <div style={{ padding: '8px 4px' }}>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, letterSpacing: '-0.02em' }}>Crawl Jobs</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', marginTop: '2px' }}>
            Data acquisition monitor and steering console.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={() => refetch()} style={{ minHeight: '38px', minWidth: '38px', padding: '0 12px' }} title="Refresh list">
            <RotateCw size={14} className={isLoading ? 'pulse' : ''} />
          </Button>
          <Button variant="primary" onClick={() => navigate('/crawl/new')} style={{ minHeight: '38px' }}>
            Start Crawl
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', gap: '4px', marginBottom: '16px' }}>
        {filterTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: statusFilter === tab ? 'var(--accent)' : 'var(--ink-muted)',
              borderBottom: statusFilter === tab ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              textTransform: 'lowercase',
              marginBottom: '-1px',
              transition: 'all var(--dur-fast) var(--ease-out)',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Loading Skeleton */}
      {isLoading && jobs.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '36px', width: '100%' }} />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div style={{ display: 'flex', gap: '10px', color: 'var(--failed)', border: '1px solid var(--failed)', padding: '16px', borderRadius: 'var(--r-panel)', backgroundColor: 'var(--failed-weak)', marginBottom: '16px' }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>
            <h3 style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>Failed to load jobs</h3>
            <p style={{ fontSize: 'var(--text-sm)' }}>{(error as Error).message}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && jobs.length === 0 && (
        <div style={{ border: '1px dashed var(--line)', borderRadius: 'var(--r-panel)', padding: '48px 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-base)', marginBottom: '16px' }}>
            {statusFilter === 'all' ? 'No crawls yet. Start one.' : `No jobs match status filter "${statusFilter}".`}
          </p>
          {statusFilter === 'all' && (
            <Button variant="primary" onClick={() => navigate('/crawl/new')}>
              Start first crawl
            </Button>
          )}
        </div>
      )}

      {/* Dense Data Table */}
      {!isLoading && !isError && jobs.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--r-panel)', backgroundColor: 'var(--surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--ink-muted)', fontWeight: 500, fontSize: 'var(--text-caption)' }}>
                <th style={{ padding: '8px 16px', width: '160px' }}>Job ID</th>
                <th style={{ padding: '8px 16px', width: '120px' }}>Status</th>
                <th style={{ padding: '8px 16px' }}>Seed URL</th>
                <th style={{ padding: '8px 16px', textAlign: 'right', width: '140px' }}>Pages (Kept/Fetched)</th>
                <th style={{ padding: '8px 16px', textAlign: 'right', width: '100px' }}>Duration</th>
                <th style={{ padding: '8px 16px', textAlign: 'right', width: '180px' }}>Created At</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr
                  key={job.job_id}
                  style={{
                    borderBottom: '1px solid var(--line)',
                    cursor: 'pointer',
                    transition: 'background-color var(--dur-fast) var(--ease-out)',
                  }}
                  className="table-row-hover"
                  onClick={() => navigate(`/crawl/${job.job_id}`)}
                >
                  {/* Job ID */}
                  <td style={{ padding: '8px 16px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="mono" style={{ fontWeight: 500 }}>{job.job_id}</span>
                      <ExternalLink size={12} style={{ color: 'var(--ink-muted)' }} />
                    </div>
                  </td>
                  {/* Status */}
                  <td style={{ padding: '8px 16px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <StatusPill status={job.status} />
                      {job.saturated && (
                        <span
                          style={{
                            fontSize: '10px',
                            backgroundColor: 'var(--saturated-weak)',
                            color: 'var(--saturated)',
                            border: '1px solid var(--saturated)',
                            padding: '1px 4px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            textTransform: 'lowercase',
                          }}
                        >
                          saturated
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Seed URL */}
                  <td style={{ padding: '8px 16px', verticalAlign: 'middle' }} title={job.url}>
                    <span className="mono" style={{ color: 'var(--ink-muted)' }}>
                      {middleTruncate(job.url, 70)}
                    </span>
                  </td>
                  {/* Pages kept/fetched */}
                  <td style={{ padding: '8px 16px', textAlign: 'right', verticalAlign: 'middle' }} className="mono">
                    <span style={{ fontWeight: 500, color: 'var(--kept)' }}>{job.n_pages}</span>
                    <span style={{ color: 'var(--line)', margin: '0 4px' }}>/</span>
                    <span style={{ color: 'var(--ink-muted)' }}>{job.pages_fetched}</span>
                  </td>
                  {/* Duration */}
                  <td style={{ padding: '8px 16px', textAlign: 'right', verticalAlign: 'middle' }} className="mono">
                    {formatDuration(job.duration)}
                  </td>
                  {/* Created At */}
                  <td style={{ padding: '8px 16px', textAlign: 'right', verticalAlign: 'middle', color: 'var(--ink-muted)' }}>
                    {formatTime(job.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Custom Styles for row hover */}
      <style>{`
        .table-row-hover:hover {
          background-color: var(--surface-2);
        }
        .preset-chip:hover {
          background-color: var(--surface-2);
          border-color: var(--ink-muted);
        }
      `}</style>
    </div>
  );
};
