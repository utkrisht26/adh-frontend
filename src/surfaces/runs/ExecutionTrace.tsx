import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Download, Pause, Play, Search } from 'lucide-react';
import { api, type TelemetryEvent } from '../../lib/api';
import { ACTIVE_RUN_STATUSES, downloadFile } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState } from '../../components/ui/QueryState';
import './ExecutionTrace.css';

const MAX_EVENTS = 600;

export function ExecutionTrace({ runId, status }: { runId: string; status: string }) {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState('all');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [follow, setFollow] = useState(true);
  const cursor = useRef(0);
  const feed = useRef<HTMLDivElement>(null);
  const isActive = ACTIVE_RUN_STATUSES.includes(status);

  useEffect(() => {
    if (paused) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const batch = await api.getRunEvents(runId, cursor.current, controller.signal);
        if (controller.signal.aborted) return;
        const fresh = batch.filter(event => event.sequence > cursor.current).sort((a, b) => a.sequence - b.sequence);
        if (fresh.length) {
          cursor.current = fresh[fresh.length - 1].sequence;
          setEvents(previous => [...previous, ...fresh].slice(-MAX_EVENTS));
        }
        setError(null); setLoading(false);
        // Drain the durable backlog, including after the run reaches a terminal state.
        if (batch.length === 200 || isActive) timer = setTimeout(poll, batch.length === 200 ? 100 : 2000);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause); setLoading(false);
        if (isActive) timer = setTimeout(poll, 5000);
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [runId, isActive, paused, revision, status]);

  const phases = useMemo(() => [...new Set(events.map(event => event.phase))], [events]);
  const filtered = useMemo(() => events.filter(event =>
    (phase === 'all' || event.phase === phase) &&
    (!errorsOnly || /fail|error|reject|blocked/i.test(`${event.status} ${event.event}`)) &&
    `${event.sequence} ${event.event} ${event.phase} ${event.status} ${event.operation_id || ''}`.toLowerCase().includes(search.toLowerCase())
  ), [events, phase, errorsOnly, search]);

  useEffect(() => { if (follow && feed.current) feed.current.scrollTop = feed.current.scrollHeight; }, [filtered, follow]);

  return <section className="panel execution-trace" aria-label="Execution trace">
    <div className="panel__head"><div><h2 className="panel__title">Execution trace</h2><span className="panel__meta">Model calls, research, acquisition and verification</span></div>
      <div className="execution-trace__actions"><span className="trace-live" role="status">{paused ? 'Paused' : isActive ? 'Live · every 2s' : 'Recorded events'}</span>
        {isActive && <Button variant="ghost" onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume live trace' : 'Pause live trace'}>{paused ? <Play size={15} /> : <Pause size={15} />}</Button>}
        <Button variant="ghost" disabled={!events.length} onClick={() => downloadFile(`${runId}-loaded-events.jsonl`, events.map(event => JSON.stringify(event)).join('\n') + '\n', 'application/x-ndjson')} title="Export the events currently loaded"><Download size={15} />Export loaded</Button>
      </div></div>
    <div className="execution-trace__filters"><label className="search-field"><Search size={15} /><input type="search" aria-label="Search execution events" placeholder="Search events or operation ID…" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <select className="filter-select" aria-label="Filter event phase" value={phase} onChange={e => setPhase(e.target.value)}><option value="all">All phases</option>{phases.map(value => <option key={value}>{value}</option>)}</select>
      <label className="trace-errors"><input type="checkbox" checked={errorsOnly} onChange={e => setErrorsOnly(e.target.checked)} />Issues only</label>
    </div>
    {error != null && <ErrorState title="Couldn’t refresh events" error={error} retry={() => setRevision(value => value + 1)} />}
    {loading ? <div className="panel--pad"><LoadingState label="Loading execution trace…" /></div> : <div className="execution-trace__feed" ref={feed} onScroll={() => { const el = feed.current; if (el) setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 40); }}>
      {!filtered.length && <p className="execution-trace__empty">{events.length ? 'No events match these filters.' : isActive ? 'Waiting for the first execution event…' : 'No execution events were recorded for this run.'}</p>}
      {filtered.map(event => <TraceEvent key={event.sequence} event={event} />)}
    </div>}
    <div className="execution-trace__footer"><span>{filtered.length} shown · {events.length === MAX_EVENTS ? `latest ${MAX_EVENTS} retained · ` : ''}sequence {cursor.current}</span><Button variant="ghost" aria-pressed={follow} onClick={() => { setFollow(true); if (feed.current) feed.current.scrollTop = feed.current.scrollHeight; }}><ArrowDown size={14} />{follow ? 'Following latest' : 'Jump to latest'}</Button></div>
  </section>;
}

function TraceEvent({ event }: { event: TelemetryEvent }) {
  const [open, setOpen] = useState(false);
  const issue = /fail|error|reject|blocked/i.test(`${event.status} ${event.event}`);
  const time = new Date(event.timestamp);
  return <details className={`trace-event ${issue ? 'trace-event--issue' : ''}`} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary><span className="trace-event__seq mono">{event.sequence}</span><time className="mono" dateTime={event.timestamp}>{Number.isNaN(time.getTime()) ? event.timestamp : time.toLocaleTimeString(undefined, { hour12: false })}</time><span className="trace-event__name">{event.event}</span><span className="trace-event__phase">{event.phase}</span><span className={`trace-event__status ${issue ? 'trace-event__status--issue' : ''}`}>{event.status}</span><span className="trace-event__duration mono">{event.duration_ms == null ? '—' : `${Math.round(event.duration_ms).toLocaleString()} ms`}</span></summary>
    {open && <div className="trace-event__detail"><dl><div><dt>Operation</dt><dd>{event.operation_id || '—'}</dd></div><div><dt>Parent operation</dt><dd>{event.parent_operation_id || '—'}</dd></div><div><dt>Timestamp</dt><dd>{event.timestamp}</dd></div></dl><pre>{JSON.stringify(event.attributes, null, 2)}</pre></div>}
  </details>;
}
