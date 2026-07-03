import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { JobOut, PageOut } from '../../lib/api';
import { StatusPill } from '../../components/ui/StatusPill';
import type { StatusType } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { PageViewer } from './PageViewer';
import {
  AlertCircle,
  RotateCw,
  Ban,
  ArrowDown,
  ArrowUpDown,
  BookOpen,
  ArrowLeft
} from 'lucide-react';

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

  // States
  const [events, setEvents] = useState<EventLog[]>([]);
  const [nextSince, setNextSince] = useState(0);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [selectedPage, setSelectedPage] = useState<PageOut | null>(null);
  
  // Sorting state for pages
  const [sortBy, setSortBy] = useState<'score' | 'tokens' | 'depth'>('score');
  const [sortDesc, setSortDesc] = useState(true);

  // Query Job Details (polls status every 2 seconds if job is active)
  const { data: job, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.getJob(jobId || ''),
    refetchInterval: (query) => {
      const data = query.state.data as JobOut | undefined;
      return data && ['queued', 'running'].includes(data.status) ? 2000 : false;
    },
    enabled: !!jobId,
  });

  // Mutation to Cancel Job
  const cancelMutation = useMutation({
    mutationFn: () => api.cancelJob(jobId || ''),
    onSuccess: () => {
      refetch();
    },
  });

  // Incremental Events Polling
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

    // Initial poll
    pollEvents();

    // Setup interval (poll faster during running state)
    const isRunning = job && ['queued', 'running'].includes(job.status);
    const interval = setInterval(pollEvents, isRunning ? 1000 : 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [jobId, nextSince, job?.status]);

  // Reset state when job ID changes
  useEffect(() => {
    setEvents([]);
    setNextSince(0);
    setSelectedPage(null);
    setIsAutoScroll(true);
    setShowJumpButton(false);
  }, [jobId]);

  // Handle Scroll to Bottom
  useEffect(() => {
    if (isAutoScroll && feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, isAutoScroll]);

  // Monitor user scrolling to toggle Auto-Scroll
  const handleScroll = () => {
    const el = feedContainerRef.current;
    if (!el) return;
    // Check if scrolled within 40px of bottom
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

  // Sort pages
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 8px' }}>
        <div className="skeleton" style={{ height: '80px', width: '100%' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px', height: '500px' }}>
          <div className="skeleton" style={{ height: '100%' }} />
          <div className="skeleton" style={{ height: '100%' }} />
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
            <h3 style={{ fontWeight: 600 }}>Error loading crawl job</h3>
            <p>{(error as Error).message}</p>
          </div>
        </div>
        <Button onClick={() => navigate('/crawl')} style={{ marginTop: '16px' }}>
          Back to list
        </Button>
      </div>
    );
  }

  if (!job) return null;

  const isJobActive = ['queued', 'running'].includes(job.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', padding: '8px 4px' }}>
      
      {/* Detail Header */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-panel)', padding: '16px', backgroundColor: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '70%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link to="/crawl" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--ink-muted)' }}>
              <ArrowLeft size={16} />
            </Link>
            <h1 className="mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{job.job_id}</h1>
            <StatusPill status={job.status} />
          </div>
          <span className="mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', wordBreak: 'break-all' }}>
            {job.url}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {isJobActive && (
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              <Ban size={14} />
              Cancel Crawl
            </Button>
          )}
          <Button onClick={() => refetch()} style={{ minWidth: '38px', padding: '0 12px' }}>
            <RotateCw size={14} className={isJobActive ? 'pulse' : ''} />
          </Button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px', minHeight: '0', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Column: Frontier Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--line)', borderRadius: 'var(--r-panel)', backgroundColor: 'var(--surface)', overflow: 'hidden', position: 'relative' }}>
          <div style={{ borderBottom: '1px solid var(--line)', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Frontier decisions log</h2>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-muted)' }} className="mono">
              events: {events.length} · pages fetched: {job.pages_fetched}
            </span>
          </div>

          {/* Scrolling Container */}
          <div
            ref={feedContainerRef}
            onScroll={handleScroll}
            style={{ flex: 1, overflowY: 'auto', padding: '12px 0', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)' }}
          >
            {events.length === 0 ? (
              <div style={{ padding: '32px 16px', color: 'var(--ink-muted)', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)' }}>
                {isJobActive ? 'Waiting for crawl events…' : 'No crawl events recorded.'}
              </div>
            ) : (
              events.map((event, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '4px 16px',
                    gap: '12px',
                    backgroundColor: getEventBgColor(event.verdict),
                    borderBottom: '1px solid var(--line)',
                    transition: 'opacity var(--dur) var(--ease-out)',
                  }}
                  className="feed-row"
                >
                  {/* Timestamp */}
                  <span style={{ color: 'var(--ink-muted)', flexShrink: 0, width: '70px' }}>
                    {new Date(event.timestamp * 1000).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  
                  {/* Verdict Pill */}
                  <span style={{ flexShrink: 0, width: '85px' }}>
                    <StatusPill status={event.verdict} style={{ border: 'none', padding: '0 4px', fontSize: '10px' }} />
                  </span>

                  {/* URL & Reason */}
                  <div style={{ flex: 1, minWidth: '0', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--ink)', wordBreak: 'break-all', fontWeight: 500 }} title={event.url}>
                      {middleTruncate(event.url)}
                    </span>
                    <span style={{ color: 'var(--ink-muted)', fontSize: '10px', marginTop: '1px' }}>
                      {getVerdictReason(event)}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div ref={feedEndRef} />
          </div>

          {/* Float Jump Button */}
          {showJumpButton && (
            <button
              onClick={jumpToLatest}
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'var(--accent)',
                color: 'oklch(100% 0 0)',
                border: 'none',
                borderRadius: 'var(--r-pill)',
                padding: '6px 16px',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px oklch(0% 0 0 / 20%)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <ArrowDown size={14} />
              Jump to latest
            </button>
          )}
        </div>

        {/* Right Column: Kept Pages List */}
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--line)', borderRadius: 'var(--r-panel)', backgroundColor: 'var(--surface)', overflow: 'hidden' }}>
          <div style={{ borderBottom: '1px solid var(--line)', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Extracted Pages</h2>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-muted)' }} className="mono">
              kept: {job.pages?.length || 0}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sortedPages.length === 0 ? (
              <div style={{ padding: '48px 16px', color: 'var(--ink-muted)', textAlign: 'center', fontSize: 'var(--text-sm)' }}>
                No kept pages found.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--ink-muted)', fontSize: 'var(--text-caption)' }}>
                    <th style={{ padding: '6px 12px', textAlign: 'left' }}>URL Path</th>
                    <th
                      style={{ padding: '6px 12px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('score')}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Score
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th
                      style={{ padding: '6px 12px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('tokens')}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Tokens
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th
                      style={{ padding: '6px 12px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('depth')}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Depth
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPages.map((page, idx) => {
                    const parsedUrl = new URL(page.url);
                    const pathName = parsedUrl.pathname + parsedUrl.search;
                    
                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedPage(page)}
                        style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: '8px 12px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={page.url}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BookOpen size={13} style={{ color: 'var(--ink-muted)', flexShrink: 0 }} />
                            <span className="mono" style={{ fontWeight: 500 }}>{pathName}</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }} className="mono">
                          {(page.relevance_score ?? 1.0).toFixed(2)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ink-muted)' }} className="mono">
                          {(page.token_estimate ?? 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ink-muted)' }} className="mono">
                          {page.depth}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Side Slide-Over Page Viewer */}
      {selectedPage && (
        <PageViewer page={selectedPage} onClose={() => setSelectedPage(null)} />
      )}
    </div>
  );
};
