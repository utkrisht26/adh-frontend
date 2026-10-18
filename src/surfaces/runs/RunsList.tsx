import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, RotateCw, Search, UserCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { ACTIVE_RUN_STATUSES, TERMINAL_RUN_STATUSES, formatDate } from '../../lib/format';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState } from '../../components/ui/QueryState';
import './RunsList.css';

const PAGE_SIZE = 20;
export function RunsList() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') || '';
  const filter = params.get('status') || 'all';
  const [page, setPage] = useState(0);
  const query = useQuery({ queryKey: ['runs'], queryFn: api.listRuns, refetchInterval: 5000 });
  const runs = query.data || [];
  const counts = { active: runs.filter(run => ACTIVE_RUN_STATUSES.includes(run.status)).length, review: runs.filter(run => run.status === 'awaiting_approval').length, succeeded: runs.filter(run => run.status === 'succeeded').length, failed: runs.filter(run => run.status === 'failed').length };
  const restart = useMutation({ mutationFn: (runId: string) => api.restartRun(runId), onSuccess: fresh => { void client.invalidateQueries({ queryKey: ['runs'] }); navigate(`/runs/${fresh.run_id}`); } });
  const filtered = useMemo(() => (query.data || []).filter(run =>
    (filter === 'all' || (filter === 'active' ? ACTIVE_RUN_STATUSES.includes(run.status) : run.status === filter)) &&
    `${run.run_id} ${run.job_id} ${run.exit_reason || ''}`.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => b.created_at.localeCompare(a.created_at)), [query.data, search, filter]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  function updateFilter(key: string, value: string) { const next = new URLSearchParams(params); if (value && value !== 'all') next.set(key, value); else next.delete(key); setParams(next, { replace: true }); setPage(0); }

  return <div className="runs-list"><div className="screen-head"><div><p className="eyebrow">Dataset operations</p><h1 className="screen-title">Discovery & Runs</h1><p className="screen-subtitle">From the first source to a verified dataset. Every decision, in one place.</p></div><div className="screen-actions"><Button onClick={() => void query.refetch()} aria-label="Refresh runs" disabled={query.isFetching}><RotateCw size={16} className={query.isFetching ? 'pulse' : ''} /></Button><Link className="btn btn-primary" to="/discovery/new">Start discovery<ArrowUpRight size={16} /></Link></div></div>
    {query.isPending ? <LoadingState label="Loading runs…" /> : <>
      {query.isError && <ErrorState title="Couldn’t refresh runs" error={query.error} retry={() => void query.refetch()} />}
      {restart.isError && <ErrorState title="Couldn’t restart run" error={restart.error} />}
      {query.data && <><div className="metrics-strip">{[['Active runs', counts.active], ['Awaiting review', counts.review], ['Acquisition complete', counts.succeeded], ['Failed runs', counts.failed]].map(([label, value]) => <div className="metric" key={label}><span className="metric__label">{label}</span><span className="metric__value">{value}</span></div>)}</div>
        {counts.review > 0 && <Link to="/runs?status=awaiting_approval" className="review-banner"><UserCheck size={20} /><div><strong>{counts.review} {counts.review === 1 ? 'plan needs' : 'plans need'} your review</strong><span>Choose the sources to acquire before the run continues.</span></div><ArrowRight size={18} /></Link>}
        {runs.length === 0 ? <div className="empty-state"><p className="eyebrow">Your first dataset starts here</p><h2>Give discovery a goal.</h2><p className="empty-state__text">Define your record shape, discover sources, and review a plan before acquisition.</p><Link to="/discovery/new" className="btn btn-primary">Start first discovery run<ArrowUpRight size={16} /></Link></div> : <>
          <div className="filter-toolbar"><label className="search-field"><Search size={16} /><input type="search" aria-label="Search runs" placeholder="Search job, run ID or exit reason…" value={search} onChange={e => updateFilter('q', e.target.value)} /></label><select className="filter-select" aria-label="Filter runs by status" value={filter} onChange={e => updateFilter('status', e.target.value)}>{['all', 'active', 'awaiting_approval', 'discovering', 'acquiring', 'building', 'succeeded', 'failed', 'cancelled'].map(status => <option key={status} value={status}>{status === 'all' ? 'All statuses' : status.replaceAll('_', ' ')}</option>)}</select></div>
          <section className="panel"><div className="panel__head"><h2 className="panel__title">Run history</h2><span className="panel__meta">{filtered.length} of {runs.length} runs · refreshes every 5s</span></div><div className="table-scroll"><table className="data-table runs-table"><thead><tr><th>Job / run</th><th>Status</th><th>Created</th><th>Updated / outcome</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map(run => <tr key={run.run_id}><td><Link to={`/runs/${run.run_id}`} className="runs-table__name">{run.job_id}</Link><span className="runs-table__id mono">{run.run_id}</span></td><td><StatusPill status={run.status} />{run.status === 'awaiting_approval' && <Link className="runs-table__review" to={`/runs/${run.run_id}`}>Review sources <ArrowRight size={12} /></Link>}</td><td className="text-muted">{formatDate(run.created_at)}</td><td><span>{formatDate(run.updated_at)}</span>{run.exit_reason && <span className="runs-table__outcome" title={run.error || run.exit_reason}>{run.exit_reason.replaceAll('_', ' ')}</span>}</td><td>{TERMINAL_RUN_STATUSES.includes(run.status) ? <Button variant="ghost" disabled={restart.isPending} onClick={() => restart.mutate(run.run_id)}>{restart.isPending && restart.variables === run.run_id ? 'Restarting…' : 'Restart'}</Button> : <Link className="btn btn-ghost" to={`/runs/${run.run_id}`}>Open<ArrowUpRight size={14} /></Link>}</td></tr>)}</tbody></table></div>{!visible.length && <div className="panel--pad"><p className="empty-state__text">No runs match your filters.</p><Button onClick={() => { setParams({}); setPage(0); }}>Clear filters</Button></div>}<div className="runs-pagination"><span>{filtered.length ? currentPage * PAGE_SIZE + 1 : 0}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span><div><Button variant="ghost" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="ghost" disabled={(currentPage + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div></section>
        </>}
      </>}
    </>}
  </div>;
}
