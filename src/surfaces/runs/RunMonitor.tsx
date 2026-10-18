import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, PencilLine, RotateCcw, Check } from 'lucide-react';
import { api, type RunOut } from '../../lib/api';
import { formatCost, formatDate, TERMINAL_RUN_STATUSES, downloadFile } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { StatusPill } from '../../components/ui/StatusPill';
import { ErrorState } from '../../components/ui/QueryState';
import { BudgetGauge } from '../../components/viz/BudgetGauge';
import { DatasetPanel } from './DatasetPanel';
import { ExecutionTrace } from './ExecutionTrace';
import './RunMonitor.css';

export function RunMonitor({ run, refetch }: { run: RunOut; refetch: () => void }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tabs = ['overview', 'events', 'dataset', 'spec'];
  const selected = params.get('view') || 'overview';
  const view = tabs.includes(selected) ? selected : 'overview';
  const spec = useQuery({ queryKey: ['run-spec', run.run_id], queryFn: () => api.getRunSpec(run.run_id), staleTime: Infinity });
  const limits = spec.data?.limits;
  const metrics = run.metrics;
  const canCancel = ['discovering', 'acquiring'].includes(run.status);
  const restartable = TERMINAL_RUN_STATUSES.includes(run.status);
  const cancel = useMutation({ mutationFn: () => api.cancelRun(run.run_id), onSuccess: () => { refetch(); void client.invalidateQueries({ queryKey: ['runs'] }); } });
  const restart = useMutation({ mutationFn: () => api.restartRun(run.run_id), onSuccess: fresh => { void client.invalidateQueries({ queryKey: ['runs'] }); navigate(`/runs/${fresh.run_id}`); } });
  const aspects = [...new Map([...(run.plan?.aspects || []), ...(run.plan?.synthesis_aspects || [])].map(aspect => [aspect.aspect_id, aspect])).values()];
  const stage = run.status === 'discovering' ? 0 : run.status === 'awaiting_approval' ? 1 : run.status === 'acquiring' ? 2 : ['succeeded', 'building'].includes(run.status) ? 3 : -1;
  const tabLabels: Record<string, string> = { overview: 'Overview', events: 'Execution trace', dataset: 'Dataset', spec: 'Saved spec' };

  return <div className="run-monitor">
    <Link to="/runs" className="run-back"><ArrowLeft size={14} />All runs</Link>
    <div className="screen-head"><div><p className="eyebrow">Run workspace</p><h1 className="screen-title">{spec.data?.name || run.job_id}</h1><div className="run-monitor__header-meta"><StatusPill status={run.status} /><span className="mono text-muted">{run.run_id}</span><span className="text-muted">Updated {formatDate(run.updated_at)}</span></div></div>
      <div className="screen-actions">{restartable && <><Button onClick={() => navigate(`/runs/${run.run_id}/edit`)}><PencilLine size={15} />Restart &amp; edit config</Button><Button onClick={() => restart.mutate()} disabled={restart.isPending}><RotateCcw size={15} />{restart.isPending ? 'Restarting…' : 'Restart with same config'}</Button></>}{canCancel && <Button variant="destructive" disabled={cancel.isPending} onClick={() => cancel.mutate()}>{cancel.isPending ? 'Cancelling…' : 'Cancel run'}</Button>}</div>
    </div>
    {run.error && <ErrorState title="Run failed" error={new Error(run.error)} />}
    {run.exit_reason && <p className="run-exit">Exit reason <span className="mono">{run.exit_reason}</span></p>}
    {cancel.isError && <ErrorState title="Couldn’t cancel run" error={cancel.error} />}{restart.isError && <ErrorState title="Couldn’t restart run" error={restart.error} />}
    <ol className="run-stages" aria-label="Run workflow">{['Discover sources', 'Review plan', 'Acquire corpus', 'Build dataset'].map((label, i) => <li key={label} className={i < stage ? 'run-stages__done' : i === stage ? 'run-stages__current' : ''}><span>{i < stage ? <Check size={13} /> : `0${i + 1}`}</span>{label}{i === stage && <small>{run.status === 'succeeded' ? 'available' : 'in progress'}</small>}</li>)}</ol>
    <div className="metrics-strip"><div className="metric"><span className="metric__label">Pages scraped</span><span className="metric__value">{metrics?.pages_scraped?.toLocaleString() ?? '—'}</span></div><div className="metric"><span className="metric__label">LLM tokens</span><span className="metric__value">{metrics?.llm_tokens?.toLocaleString() ?? '—'}</span></div><div className="metric"><span className="metric__label">Reported cost</span><span className="metric__value">{formatCost(metrics?.cost_usd)}</span></div><div className="metric"><span className="metric__label">Discovered sources</span><span className="metric__value">{run.plan ? run.plan.sources?.length ?? 0 : '—'}</span></div></div>
    <nav className="run-tabs" aria-label="Run views">{tabs.map(tab => <button key={tab} className={view === tab ? 'run-tabs__active' : ''} aria-current={view === tab ? 'page' : undefined} onClick={() => setParams({ view: tab }, { replace: true })}>{tabLabels[tab]}</button>)}</nav>
    {(view === 'overview' || view === 'events') && <ExecutionTrace key={run.run_id} runId={run.run_id} status={run.status} />}
    {view === 'overview' && <div className="run-monitor__layout">
      <section className="panel"><div className="panel__head"><h2 className="panel__title">Budget & limits</h2><span className="panel__meta">Saved run configuration</span></div><div className="panel--pad run-monitor__budgets-list">
        {spec.isPending && <p className="text-muted">Loading saved limits…</p>}{spec.isError && <ErrorState title="Couldn’t load saved limits" error={spec.error} retry={() => void spec.refetch()} />}
        {limits && <>{limits.max_pages_scraped != null && metrics?.pages_scraped != null && <BudgetGauge label="Pages scraped" value={metrics.pages_scraped} limit={limits.max_pages_scraped} />}{limits.max_llm_tokens != null && metrics?.llm_tokens != null && <BudgetGauge label="LLM tokens" value={metrics.llm_tokens} limit={limits.max_llm_tokens} />}{limits.max_cost_usd != null && (metrics?.cost_usd != null ? <BudgetGauge label="Reported cost" value={metrics.cost_usd} limit={limits.max_cost_usd} formatValue={formatCost} /> : <div className="limit-row"><span>Reported cost <strong>unknown</strong></span><span className="mono">Limit {formatCost(limits.max_cost_usd)}</span></div>)}<div className="limit-row"><span>Storage ceiling</span><span className="mono">{limits.max_storage_mb?.toLocaleString() ?? '—'} MB</span></div><div className="limit-row"><span>Runtime ceiling</span><span className="mono">{limits.max_runtime_seconds?.toLocaleString() ?? '—'} seconds</span></div></>}
      </div></section>
      <section className="panel"><div className="panel__head"><h2 className="panel__title">Coverage plan</h2><span className="panel__meta">{aspects.length} aspects</span></div><div className="panel--pad run-monitor__aspects-list">{aspects.length ? aspects.map(aspect => <div className="run-monitor__aspect-item" key={aspect.aspect_id}><strong>{aspect.topic}</strong><p className="text-muted">{aspect.rationale}</p></div>) : <p className="text-muted">Coverage aspects appear when discovery completes.</p>}<p className="spec-hint">Saturation history is not reported by this gateway. Dataset coverage appears after a build.</p></div></section>
      <section className="panel run-monitor__wide"><div className="panel__head"><h2 className="panel__title">Discovered source plan</h2><span className="panel__meta">{run.plan?.sources?.length ?? 0} ranked sources</span></div><div className="table-scroll">{run.plan?.sources?.length ? <table className="data-table"><thead><tr><th>Source</th><th>Channel</th><th>License</th><th className="data-table__num">Est. yield</th></tr></thead><tbody>{run.plan.sources.map(source => <tr key={source.source_id}><td><div className="run-monitor__source-cell"><strong>{source.title || source.locator}</strong><span className="mono text-muted">{source.locator}</span></div></td><td><span className="channel-pill">{source.channel}</span></td><td>{source.license || 'unknown'}</td><td className="data-table__num mono">{source.estimated_yield?.toLocaleString() ?? '—'}</td></tr>)}</tbody></table> : <p className="panel--pad text-muted">No external sources in the saved plan.</p>}</div></section>
      <section className="panel run-monitor__wide"><div className="panel__head"><h2 className="panel__title">Run notes</h2><span className="panel__meta">Lineage & outcomes</span></div><div className="panel--pad run-monitor__notes-list">{run.notes?.length ? run.notes.map((note, i) => <p key={i} className="mono">{note}</p>) : <p className="text-muted">No run notes recorded.</p>}</div></section>
    </div>}
    {view === 'dataset' && (['succeeded', 'building', 'failed', 'cancelled'].includes(run.status) ? <DatasetPanel runId={run.run_id} status={run.status} refetchRun={refetch} /> : <div className="empty-state"><h2>Build follows acquisition</h2><p className="empty-state__text">Finish discovery and source acquisition to build your dataset.</p></div>)}
    {view === 'overview' && ['succeeded', 'building'].includes(run.status) && <DatasetPanel runId={run.run_id} status={run.status} refetchRun={refetch} />}
    {view === 'spec' && <section className="panel"><div className="panel__head"><h2 className="panel__title">Saved job specification</h2><Button disabled={!spec.data} onClick={() => downloadFile(`${run.run_id}-spec.json`, JSON.stringify(spec.data, null, 2))}><Download size={15} />Export JSON</Button></div>{spec.isError ? <ErrorState title="Couldn’t load saved spec" error={spec.error} retry={() => void spec.refetch()} /> : <pre className="run-spec-json">{spec.data ? JSON.stringify(spec.data, null, 2) : 'Loading saved spec…'}</pre>}</section>}
  </div>;
}
