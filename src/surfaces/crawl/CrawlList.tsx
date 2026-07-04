import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { AlertCircle, RotateCw, ExternalLink } from 'lucide-react';
import './CrawlList.css';

export const CrawlList: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: jobs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['jobs', statusFilter],
    queryFn: () => api.listJobs(statusFilter === 'all' ? undefined : statusFilter),
    refetchInterval: 5000,
  });

  const formatDuration = (sec: number) => {
    if (sec <= 0) return '0.0s';
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}m ${Math.floor(s)}s`;
  };

  const formatTime = (ts: number) =>
    new Date(ts * 1000).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const middleTruncate = (text: string, maxLen = 60) => {
    if (!text || text.length <= maxLen) return text;
    const half = Math.floor(maxLen / 2) - 2;
    return text.substring(0, half) + '…' + text.substring(text.length - half);
  };

  const filterTabs = ['all', 'queued', 'running', 'succeeded', 'failed', 'cancelled'];

  return (
    <div className="crawl-list">
      <div className="screen-head">
        <div>
          <h1 className="screen-title">Crawl Jobs</h1>
          <p className="screen-subtitle">Data acquisition monitor and steering console.</p>
        </div>
        <div className="screen-actions">
          <Button onClick={() => refetch()} style={{ minHeight: '38px', minWidth: '38px', padding: '0 12px' }} title="Refresh list">
            <RotateCw size={14} className={isLoading ? 'pulse' : ''} />
          </Button>
          <Button variant="primary" onClick={() => navigate('/crawl/new')} style={{ minHeight: '38px' }}>
            Start Crawl
          </Button>
        </div>
      </div>

      <div className="crawl-list__tabs">
        {filterTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`crawl-list__tab ${statusFilter === tab ? 'crawl-list__tab--active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading && jobs.length === 0 && (
        <div className="crawl-list__skeletons">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '36px', width: '100%' }} />
          ))}
        </div>
      )}

      {isError && (
        <div className="callout-error" style={{ marginBottom: 'var(--space-16)' }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>
            <h3 className="callout-error__title">Failed to load jobs</h3>
            <p className="callout-error__body">{(error as Error).message}</p>
          </div>
        </div>
      )}

      {!isLoading && !isError && jobs.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__text">
            {statusFilter === 'all' ? 'No crawls yet. Start one.' : `No jobs match status filter "${statusFilter}".`}
          </p>
          {statusFilter === 'all' && (
            <Button variant="primary" onClick={() => navigate('/crawl/new')}>
              Start first crawl
            </Button>
          )}
        </div>
      )}

      {!isLoading && !isError && jobs.length > 0 && (
        <div className="panel crawl-list__table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '160px' }}>Job ID</th>
                <th style={{ width: '120px' }}>Status</th>
                <th>Seed URL</th>
                <th className="data-table__num" style={{ width: '140px' }}>Pages (Kept/Fetched)</th>
                <th className="data-table__num" style={{ width: '100px' }}>Duration</th>
                <th className="data-table__num" style={{ width: '180px' }}>Created At</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.job_id} className="table-row-hover" onClick={() => navigate(`/crawl/${job.job_id}`)}>
                  <td>
                    <div className="crawl-list__id mono">
                      <span>{job.job_id}</span>
                      <ExternalLink size={12} style={{ color: 'var(--ink-muted)' }} />
                    </div>
                  </td>
                  <td>
                    <div className="crawl-list__status">
                      <StatusPill status={job.status} />
                      {job.saturated && <span className="badge-saturated">saturated</span>}
                    </div>
                  </td>
                  <td title={job.url}>
                    <span className="mono num-muted">{middleTruncate(job.url, 70)}</span>
                  </td>
                  <td className="data-table__num mono">
                    <span className="num-kept">{job.n_pages}</span>
                    <span className="num-sep">/</span>
                    <span className="num-muted">{job.pages_fetched}</span>
                  </td>
                  <td className="data-table__num mono">{formatDuration(job.duration)}</td>
                  <td className="data-table__num num-muted">{formatTime(job.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
