import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { StatusPill } from '../../components/ui/StatusPill';
import { LoadingState, ErrorState } from '../../components/ui/QueryState';
import { DatasetPanel } from '../runs/DatasetPanel';
import './Datasets.css';

export function Datasets() {
  const query = useQuery({ queryKey: ['runs'], queryFn: api.listRuns, refetchInterval: 5000 });
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const eligible = useMemo(() => (query.data || []).filter(run => ['succeeded', 'building'].includes(run.status)).sort((a, b) => b.updated_at.localeCompare(a.updated_at)), [query.data]);
  const visible = eligible.filter(run => `${run.job_id} ${run.run_id}`.toLowerCase().includes(search.toLowerCase()));
  const selected = eligible.find(run => run.run_id === params.get('run'));
  return <div className="datasets"><div className="screen-head"><div><p className="eyebrow">Synthesis & curation</p><h1 className="screen-title">Datasets</h1><p className="screen-subtitle">Build from an acquired corpus, inspect quality, and review coverage.</p></div><Link className="btn btn-secondary" to="/runs">View all runs<ArrowUpRight size={16} /></Link></div>
    {query.isPending && <LoadingState label="Loading dataset runs…" />}{query.isError && <ErrorState title="Couldn’t load dataset runs" error={query.error} retry={() => void query.refetch()} />}
    {query.data && <>{eligible.length === 0 ? <div className="empty-state"><h2>A dataset begins with good sources.</h2><p className="empty-state__text">Complete a discovery and acquisition run to make its corpus available here.</p><Link className="btn btn-primary" to="/discovery/new">Start discovery<ArrowUpRight size={16} /></Link></div> : <>
      <div className="filter-toolbar"><label className="search-field"><Search size={16} /><input aria-label="Search dataset runs" type="search" placeholder="Search acquired runs…" value={search} onChange={e => setSearch(e.target.value)} /></label><span className="text-muted">{eligible.length} acquired or building runs</span></div>
      <section className="panel datasets__table"><div className="panel__head"><h2 className="panel__title">Available corpora & builds</h2><span className="panel__meta">Select a run to inspect its dataset</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Job / run</th><th>Run status</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map(run => <tr key={run.run_id} className={selected?.run_id === run.run_id ? 'datasets__selected' : ''}><td><button className="datasets__select" onClick={() => setParams({ run: run.run_id })} aria-pressed={selected?.run_id === run.run_id}>{run.job_id}</button><span className="mono datasets__run-id">{run.run_id}</span></td><td><StatusPill status={run.status} /></td><td className="text-muted">{formatDate(run.updated_at)}</td><td><Link className="btn btn-ghost" to={`/runs/${run.run_id}?view=dataset`}>Open run<ArrowUpRight size={14} /></Link></td></tr>)}</tbody></table></div>{!visible.length && <p className="panel--pad text-muted">No runs match your search.</p>}</section>
      {selected ? <div className="datasets__detail"><h2 className="datasets__detail-title">{selected.job_id}</h2><DatasetPanel key={selected.run_id} runId={selected.run_id} status={selected.status} refetchRun={() => void query.refetch()} /></div> : <div className="datasets__hint">Select a run above to build a dataset or view its saved quality report.</div>}
    </>}</>}
  </div>;
}
