import React, { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { RunOut, PlanSourceOut, PlanAspectOut } from '../../lib/api';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { ScoreBar } from '../../components/viz/ScoreBar';
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import './ApprovalGate.css';
import { ErrorState } from '../../components/ui/QueryState';

interface ApprovalGateProps {
  run: RunOut;
  refetch: () => void;
}

export const ApprovalGate: React.FC<ApprovalGateProps> = ({ run, refetch }) => {
  const plan = run.plan;
  const sources: PlanSourceOut[] = plan?.sources || [];
  const aspects: PlanAspectOut[] = plan?.aspects || [];
  const synthesisAspects: PlanAspectOut[] = plan?.synthesis_aspects || [];
  const hasSynthesis = synthesisAspects.length > 0;

  // Selected source IDs (for approval)
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    sources.map(s => s.source_id) // Default all checked
  );

  // Keyboard navigation states
  const [focusedId, setFocusedId] = useState<string | null>(() =>
    sources.length > 0 ? sources[0].source_id : null
  );

  // Expanded rows for reasoning
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  // ApprovalRequest extra inputs
  const [approveSynthesis, setApproveSynthesis] = useState(true);
  const [reason, setReason] = useState('');

  // Refs for scrolling
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const approveMutation = useMutation({
    mutationFn: (data: { approved_source_ids: string[]; approve_synthesis: boolean; reason: string }) =>
      api.approveRun(run.run_id, {
        approved_source_ids: data.approved_source_ids,
        approve_synthesis: data.approve_synthesis,
        reason: data.reason,
      }),
    onSuccess: () => {
      refetch();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelRun(run.run_id),
    onSuccess: () => {
      refetch();
    },
  });

  // Flat list of source IDs in display order for keyboard navigation
  const allAspects = [...new Map([...aspects, ...synthesisAspects].map(aspect => [aspect.aspect_id, aspect])).values()];
  const knownAspects = new Set(allAspects.map(aspect => aspect.aspect_id));
  for (const source of sources) {
    const id = source.aspect_id || 'uncategorized';
    if (!knownAspects.has(id)) {
      allAspects.push({ aspect_id: id, topic: id === 'uncategorized' ? 'Uncategorized sources' : id, rationale: '', keywords: [] });
      knownAspects.add(id);
    }
  }

  const displayOrderedSources = allAspects.flatMap(aspect =>
    sources.filter(s => (s.aspect_id || 'uncategorized') === aspect.aspect_id)
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement)?.isContentEditable || ['input', 'textarea', 'select', 'button', 'a', 'summary'].includes(tag) || ((e.target as HTMLElement)?.closest('main') && !(e.target as HTMLElement)?.closest('.approval-gate'))) {
        return;
      }

      if (displayOrderedSources.length === 0) return;

      const currentIndex = displayOrderedSources.findIndex(s => s.source_id === focusedId);

      if (e.key === 'j') {
        e.preventDefault();
        const nextIndex = currentIndex === -1 || currentIndex === displayOrderedSources.length - 1 ? 0 : currentIndex + 1;
        const nextId = displayOrderedSources[nextIndex].source_id;
        setFocusedId(nextId);
        rowRefs.current[nextId]?.focus();
        rowRefs.current[nextId]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'k') {
        e.preventDefault();
        const prevIndex = currentIndex <= 0 ? displayOrderedSources.length - 1 : currentIndex - 1;
        const nextId = displayOrderedSources[prevIndex].source_id;
        setFocusedId(nextId);
        rowRefs.current[nextId]?.focus();
        rowRefs.current[nextId]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'a') {
        e.preventDefault();
        if (focusedId) {
          setSelectedIds(prev => prev.includes(focusedId) ? prev : [...prev, focusedId]);
        }
      } else if (e.key === 'x') {
        e.preventDefault();
        if (focusedId) {
          setSelectedIds(prev => prev.filter(id => id !== focusedId));
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedId) {
          setExpandedIds(prev =>
            prev.includes(focusedId) ? prev.filter(id => id !== focusedId) : [...prev, focusedId]
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedId, displayOrderedSources]);

  const toggleSource = (sourceId: string) => {
    setSelectedIds(prev =>
      prev.includes(sourceId) ? prev.filter(id => id !== sourceId) : [...prev, sourceId]
    );
  };

  const toggleExpand = (sourceId: string) => {
    setExpandedIds(prev =>
      prev.includes(sourceId) ? prev.filter(id => id !== sourceId) : [...prev, sourceId]
    );
  };

  const middleTruncate = (text: string, maxLen = 40) => {
    if (!text || text.length <= maxLen) return text;
    const half = Math.floor(maxLen / 2) - 2;
    return text.substring(0, half) + '…' + text.substring(text.length - half);
  };

  const handleApprove = () => {
    approveMutation.mutate({
      approved_source_ids: selectedIds,
      approve_synthesis: hasSynthesis ? approveSynthesis : true,
      reason,
    });
  };

  // Recomputed running metrics
  const approvedSources = sources.filter(s => selectedIds.includes(s.source_id));
  const totalApproved = approvedSources.length;
  const estimatedYield = approvedSources.reduce((sum, s) => sum + (s.estimated_yield || 0), 0);

  if (sources.length === 0 && !hasSynthesis) {
    return (
      <div className="approval-gate">
        <div className="screen-head">
          <div>
            <h1 className="screen-title">Approval Gate</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span className="text-muted">run: {run.run_id}</span>
              <StatusPill status={run.status as any} />
            </div>
          </div>
          <div className="screen-actions">
            <Button variant="destructive" onClick={() => cancelMutation.mutate()}>Cancel Discovery</Button>
          </div>
        </div>

        <div className="empty-state">
          {cancelMutation.isError && <ErrorState title="Couldn’t cancel run" error={cancelMutation.error} />}
          <p className="empty-state__text">No sources discovered in this run to approve.</p>
          <Button variant="destructive" onClick={() => cancelMutation.mutate()}>Cancel Run</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="approval-gate">
      <div className="screen-head">
        <div>
          <h1 className="screen-title">Approval Gate</h1>
          <div className="approval-gate__meta">
            <span className="mono text-muted">run: {run.run_id}</span>
            <span className="mono text-muted">·</span>
            <StatusPill status={run.status as any} />
          </div>
        </div>
        <div className="screen-actions">
          <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending || approveMutation.isPending}>
            Cancel Run
          </Button>
        </div>
      </div>

      {approveMutation.isError && <ErrorState title="Couldn’t approve plan" error={approveMutation.error} />}
      {cancelMutation.isError && <ErrorState title="Couldn’t cancel run" error={cancelMutation.error} />}
      <div className="approval-gate__keyboard-hint">
        <kbd>j</kbd>/<kbd>k</kbd> navigate · <kbd>a</kbd> select · <kbd>x</kbd> exclude · <kbd>Enter</kbd> expand
      </div>

      {allAspects.map((aspect) => {
        const aspectSources = sources.filter(s => (s.aspect_id || 'uncategorized') === aspect.aspect_id);
        if (aspectSources.length === 0) return null;

        return (
          <div key={aspect.aspect_id} className="panel approval-gate__aspect-panel">
            <div className="panel__head approval-gate__aspect-head">
              <div>
                <h3 className="panel__title">Aspect: {aspect.topic}</h3>
                {aspect.rationale && <p className="approval-gate__aspect-desc">{aspect.rationale}</p>}
              </div>
              {aspect.keywords && aspect.keywords.length > 0 && (
                <div className="approval-gate__aspect-keywords">
                  {aspect.keywords.map(kw => (
                    <span key={kw} className="chip chip--muted">{kw}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="table-scroll"><table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }} className="align-center">Approve</th>
                  <th>Title & Locator</th>
                  <th style={{ width: '100px' }}>Channel</th>
                  <th style={{ width: '120px' }}>Relevance</th>
                  <th style={{ width: '120px' }}>Shape Match</th>
                  <th style={{ width: '120px' }}>Quality</th>
                  <th style={{ width: '70px' }} className="align-center">License</th>
                  <th style={{ width: '70px' }} className="align-center">Freshness</th>
                  <th style={{ width: '100px' }} className="data-table__num">Est. Yield</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {aspectSources.map((source) => {
                  const isChecked = selectedIds.includes(source.source_id);
                  const isFocused = focusedId === source.source_id;
                  const isExpanded = expandedIds.includes(source.source_id);

                  return (
                    <React.Fragment key={source.source_id}>
                      <tr
                        ref={el => { rowRefs.current[source.source_id] = el; }}
                        tabIndex={0}
                        onFocus={() => setFocusedId(source.source_id)}
                        className={`table-row-hover approval-gate__row ${isChecked ? '' : 'approval-gate__row--excluded'} ${isFocused ? 'approval-gate__row--focused' : ''}`}
                        onClick={() => toggleSource(source.source_id)}
                      >
                        <td className="align-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Approve ${source.title || source.locator}`}
                            checked={isChecked}
                            onChange={() => toggleSource(source.source_id)}
                            className="approval-gate__checkbox"
                          />
                        </td>
                        <td>
                          <div className="approval-gate__source-identity">
                            <span className="approval-gate__source-title">{source.title}</span>
                            <span className="approval-gate__source-locator mono" title={source.locator}>
                              {middleTruncate(source.locator, 50)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`channel-pill channel-pill--${source.channel}`}>
                            {source.channel}
                          </span>
                        </td>
                        <td>
                          <ScoreBar value={source.score} showText={true} />
                        </td>
                        <td>
                          <ScoreBar value={source.shape_match} showText={true} />
                        </td>
                        <td>
                          <ScoreBar value={source.quality} showText={true} />
                        </td>
                        <td className="align-center">
                          {source.license_ok ? (
                            <Check size={14} className="check-ok" aria-label="Passed" role="img" />
                          ) : (
                            <X size={14} className="check-error" aria-label="Failed" role="img" />
                          )}
                        </td>
                        <td className="align-center">
                          {source.freshness_ok ? (
                            <Check size={14} className="check-ok" aria-label="Passed" role="img" />
                          ) : (
                            <X size={14} className="check-error" aria-label="Failed" role="img" />
                          )}
                        </td>
                        <td className="data-table__num mono">
                          {source.estimated_yield.toLocaleString()}
                        </td>
                        <td className="align-center">
                          <button className="approval-gate__expand-btn" aria-label={`Details for ${source.title || source.locator}`} aria-expanded={isExpanded} onClick={e => { e.stopPropagation(); toggleExpand(source.source_id); }}>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="approval-gate__expanded-row">
                          <td colSpan={10}>
                            <div className="approval-gate__details">
                              <div className="approval-gate__detail-grid">
                                <div>
                                  <span className="approval-gate__detail-label">Snippet</span>
                                  <blockquote className="approval-gate__detail-value approval-gate__snippet">
                                    {source.snippet || 'No snippet available.'}
                                  </blockquote>
                                </div>
                                <div className="approval-gate__detail-meta">
                                  <div>
                                    <span className="approval-gate__detail-label">Discovered Via</span>
                                    <span className="approval-gate__detail-value mono">{source.discovered_via || 'n/a'}</span>
                                  </div>
                                  <div>
                                    <span className="approval-gate__detail-label">License</span>
                                    <span className="approval-gate__detail-value mono">{source.license || 'unknown'}</span>
                                  </div>
                                  {source.published && (
                                    <div>
                                      <span className="approval-gate__detail-label">Published</span>
                                      <span className="approval-gate__detail-value mono">{source.published}</span>
                                    </div>
                                  )}
                                  {source.notes && (
                                    <div>
                                      <span className="approval-gate__detail-label">Notes</span>
                                      <span className="approval-gate__detail-value">{source.notes}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        );
      })}

      {/* Synthesis Aspect Banner (if synthesis aspect exists) */}
      {hasSynthesis && (
        <div className="panel approval-gate__synthesis-panel" style={{ marginBottom: 'var(--space-24)' }}>
          <div className="panel__head">
            <span className="panel__title">Synthesis Engine Aspects</span>
          </div>
          <div className="panel--pad">
            <p className="approval-gate__synthesis-desc">
              The discovery run also proposed synthesis aspects. Approving these allows the engine to generate synthetic records matching these topics.
            </p>
            <label className="checkbox-label" style={{ fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={approveSynthesis}
                onChange={(e) => setApproveSynthesis(e.target.checked)}
              />
              <span>Approve synthesis generation of {synthesisAspects.length} aspect(s)</span>
            </label>
            <div className="approval-gate__synthesis-aspects-list" style={{ marginTop: 'var(--space-12)' }}>
              {synthesisAspects.map(aspect => (
                <div key={aspect.aspect_id} className="approval-gate__synthesis-aspect-item">
                  <strong className="mono">{aspect.topic}</strong>
                  {aspect.rationale && <span className="text-muted"> — {aspect.rationale}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Decision Panel */}
      <div className="panel approval-gate__decision-panel">
        <div className="panel__head">
          <span className="panel__title">Operator Review Decision</span>
        </div>
        <div className="panel--pad">
          <div className="field">
            <label htmlFor="approval-reason" className="field__label">Review Rationale / Notes</label>
            <textarea
              id="approval-reason"
              placeholder="Provide comments or rationale for this approval (optional)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input"
              rows={2}
            />
          </div>

          <div className="approval-gate__submit-row">
            <div className="approval-gate__metrics">
              <div className="metric-box">
                <span className="metric-box__label">Approved Sources</span>
                <span className="metric-box__value mono">{totalApproved} / {sources.length}</span>
              </div>
              <div className="metric-box">
                <span className="metric-box__label">Est. Record Yield</span>
                <span className="metric-box__value mono">{estimatedYield.toLocaleString()}</span>
              </div>
              <div className="metric-box">
                <span className="metric-box__label">Est. Discovery Cost</span>
                <span className="metric-box__value mono">unknown</span>
              </div>
            </div>

            <Button
              variant="primary"
              onClick={handleApprove}
              disabled={approveMutation.isPending || cancelMutation.isPending || (totalApproved === 0 && !(hasSynthesis && approveSynthesis))}
              style={{ minHeight: '44px', width: '200px' }}
            >
              {approveMutation.isPending ? 'Approving…' : totalApproved === 0 ? 'Approve synthesis' : 'Approve Selected'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
