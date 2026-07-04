import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { JobOut, PageOut } from '../../lib/api';
import { StatusPill } from '../../components/ui/StatusPill';
import type { StatusType } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { PageViewer } from './PageViewer';
import { AlertCircle, RotateCw, Ban, ArrowDown, ArrowUpDown, BookOpen, ArrowLeft } from 'lucide-react';
import './CrawlDetail.css';

interface EventLog {
  timestamp: number;
  url: string;
  verdict: StatusType;
  metadata: {
    depth?: number;
    reason?: string;
    score?: number;
    threshold?: number;
    error?: string;
    final_url?: string;
    license?: string;
    judge?: string;
  };
}

export const CrawlDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const feedEndRef = useRef<HTMLDivElement>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);

  const [events, setEvents] = useState<EventLog[]>([]);
  const [nextSince, setNextSince] = useState(0);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [selectedPage, setSelectedPage] = useState<PageOut | null>(null);

  const [sortBy, setSortBy] = useState<'score' | 'tokens' | 'depth'>('score');
  const [sortDesc, setSortDesc] = useState(true);

  const { data: job, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.getJob(jobId || ''),
    refetchInterval: (query) => {
      const data = query.state.data as JobOut | undefined;
      return data && ['queued', 'running'].includes(data.status) ? 2000 : false;
    },
    enabled: !!jobId,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelJob(jobId || ''),
    onSuccess: () => {
      refetch();
    },
  });

  useEffect(() => {
    if (!jobId) return;

    let active = true;
    const pollEvents = async () => {
      try {
        const data = await api.getJobEvents(jobId, nextSince);
        if (!active) return;
        if (data.events.length > 0) {
          setEvents((prev) => [...prev, ...data.events]);
          setNextSince(data.next_since);
        }
      } catch (err) {
        console.error('Failed to poll events', err);
      }
    };

    pollEvents();

    const isRunning = job && ['queued', 'running'].includes(job.status);
    const interval = setInterval(pollEvents, isRunning ? 1000 : 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [jobId, nextSince, job?.status]);

  useEffect(() => {
    setEvents([]);
    setNextSince(0);
    setSelectedPage(null);
    setIsAutoScroll(true);
    setShowJumpButton(false);
  }, [jobId]);

  useEffect(() => {
    if (isAutoScroll && feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, isAutoScroll]);

  const handleScroll = () => {
    const el = feedContainerRef.current;
    if (!el) return;
    const offset = 40;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= offset;
    setIsAutoScroll(isAtBottom);
    setShowJumpButton(!isAtBottom);
  };

  const jumpToLatest = () => {
    setIsAutoScroll(true);
    setShowJumpButton(false);
    if (feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSort = (field: 'score' | 'tokens' | 'depth') => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(true);
    }
  };

  const sortedPages = [...(job?.pages || [])].sort((a, b) => {
    let valA = 0;
    let valB = 0;
    if (sortBy === 'score') {
      valA = a.relevance_score ?? 0;
      valB = b.relevance_score ?? 0;
    } else if (sortBy === 'tokens') {
      valA = a.token_estimate ?? 0;
      valB = b.token_estimate ?? 0;
    } else if (sortBy === 'depth') {
      valA = a.depth ?? 0;
      valB = b.depth ?? 0;
    }
    if (valA === valB) return 0;
    return sortDesc ? (valA < valB ? 1 : -1) : (valA > valB ? 1 : -1);
  });

  const getVerdictReason = (event: EventLog) => {
    const m = event.metadata;
    switch (event.verdict) {
      case 'running':
        return `starting crawl depth ${m.depth}`;
      case 'kept':
        return `score ${(m.score ?? 1.0).toFixed(2)} · kept (saved)`;
      case 'dropped':
        return `dropped by ${m.judge} judge (${(m.score ?? 0).toFixed(2)} < ${(m.threshold ?? 0).toFixed(2)})`;
      case 'pruned':
        return `pruned: ${m.reason || 'skipped'}`;
      case 'failed':
        return `failed: ${m.error || 'unknown error'}`;
      case 'saturated':
        return `saturation stop: ${m.reason}`;
      default:
        return '';
    }
  };

  const getEventBgColor = (verdict: StatusType) => {
    switch (verdict) {
      case 'kept': return 'var(--kept-weak)';
      case 'dropped': return 'var(--dropped-weak)';
      case 'pruned': return 'var(--pruned-weak)';
      case 'failed': return 'var(--failed-weak)';
      case 'saturated': return 'var(--saturated-weak)';
      case 'running': return 'var(--accent-weak)';
      default: return 'var(--surface)';
    }
  };

  const middleTruncate = (text: string, maxLen = 65) => {
    if (!text || text.length <= maxLen) return text;
    const half = Math.floor(maxLen / 2) - 2;
    return text.substring(0, half) + '…' + text.substring(text.length - half);
  };

  if (isLoading && !job) {
    return (
      <div className="crawl-detail">
        <div className="skeleton" style={{ height: '80px', width: '100%' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 'var(--space-16)', height: '500px' }}>
          <div className="skeleton" style={{ height: '100%' }} />
          <div className="skeleton" style={{ height: '100%' }} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="crawl-detail">
        <div className="callout-error">
          <AlertCircle size={20} />
          <div>
            <h3 className="callout-error__title">Error loading crawl job</h3>
            <p className="callout-error__body">{(error as Error).message}</p>
          </div>
        </div>
        <div>
          <Button onClick={() => navigate('/crawl')}>Back to list</Button>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const isJobActive = ['queued', 'running'].includes(job.status);

  return (
    <div className="crawl-detail">
      <div className="crawl-detail__header">
        <div className="crawl-detail__header-main">
          <div className="crawl-detail__title-row">
            <Link to="/crawl" className="crawl-detail__back">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="crawl-detail__id mono">{job.job_id}</h1>
            <StatusPill status={job.status} />
          </div>
          <span className="crawl-detail__url mono">{job.url}</span>
        </div>

        <div className="crawl-detail__actions">
          {isJobActive && (
            <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              <Ban size={14} />
              Cancel Crawl
            </Button>
          )}
          <Button onClick={() => refetch()} style={{ minWidth: '38px', padding: '0 12px' }}>
            <RotateCw size={14} className={isJobActive ? 'pulse' : ''} />
          </Button>
        </div>
      </div>

      <div className="crawl-detail__grid">
        {/* Frontier feed */}
        <div className="crawl-detail__pane">
          <div className="panel__head">
            <h2 className="panel__title">Frontier decisions log</h2>
            <span className="panel__meta mono">events: {events.length} · pages fetched: {job.pages_fetched}</span>
          </div>

          <div ref={feedContainerRef} onScroll={handleScroll} className="feed">
            {events.length === 0 ? (
              <div className="feed__empty">{isJobActive ? 'Waiting for crawl events…' : 'No crawl events recorded.'}</div>
            ) : (
              events.map((event, idx) => (
                <div key={idx} className="feed-row" style={{ backgroundColor: getEventBgColor(event.verdict) }}>
                  <span className="feed-row__time">
                    {new Date(event.timestamp * 1000).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="feed-row__pill">
                    <StatusPill status={event.verdict} style={{ border: 'none', padding: '0 4px', fontSize: '10px' }} />
                  </span>
                  <div className="feed-row__body">
                    <span className="feed-row__url" title={event.url}>{middleTruncate(event.url)}</span>
                    <span className="feed-row__reason">{getVerdictReason(event)}</span>
                  </div>
                </div>
              ))
            )}
            <div ref={feedEndRef} />
          </div>

          {showJumpButton && (
            <button onClick={jumpToLatest} className="jump-btn">
              <ArrowDown size={14} />
              Jump to latest
            </button>
          )}
        </div>

        {/* Kept pages */}
        <div className="crawl-detail__pane">
          <div className="panel__head">
            <h2 className="panel__title">Extracted Pages</h2>
            <span className="panel__meta mono">kept: {job.pages?.length || 0}</span>
          </div>

          <div className="pages">
            {sortedPages.length === 0 ? (
              <div className="pages__empty">No kept pages found.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>URL Path</th>
                    <th className="data-table__num pages__sort" onClick={() => handleSort('score')}>
                      <span className="pages__sort-inner">Score <ArrowUpDown size={12} /></span>
                    </th>
                    <th className="data-table__num pages__sort" onClick={() => handleSort('tokens')}>
                      <span className="pages__sort-inner">Tokens <ArrowUpDown size={12} /></span>
                    </th>
                    <th className="data-table__num pages__sort" onClick={() => handleSort('depth')}>
                      <span className="pages__sort-inner">Depth <ArrowUpDown size={12} /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPages.map((page, idx) => {
                    const parsedUrl = new URL(page.url);
                    const pathName = parsedUrl.pathname + parsedUrl.search;
                    return (
                      <tr key={idx} className="table-row-hover" onClick={() => setSelectedPage(page)}>
                        <td className="pages__path-cell" title={page.url}>
                          <div className="pages__path">
                            <BookOpen size={13} style={{ color: 'var(--ink-muted)', flexShrink: 0 }} />
                            <span className="mono" style={{ fontWeight: 500 }}>{pathName}</span>
                          </div>
                        </td>
                        <td className="data-table__num mono">{(page.relevance_score ?? 1.0).toFixed(2)}</td>
                        <td className="data-table__num mono text-muted">{(page.token_estimate ?? 0).toLocaleString()}</td>
                        <td className="data-table__num mono text-muted">{page.depth}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {selectedPage && <PageViewer page={selectedPage} onClose={() => setSelectedPage(null)} />}
    </div>
  );
};
