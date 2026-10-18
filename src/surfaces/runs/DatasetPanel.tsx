import React, { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Hammer } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { downloadFile } from '../../lib/format';
import type { DatasetSummary } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { ScoreBar } from '../../components/viz/ScoreBar';
import './DatasetPanel.css';

interface DatasetPanelProps {
  runId: string;
  status: string;
  refetchRun: () => void;
}

const SPLIT_COLORS = ['var(--accent)', 'var(--saturated)', 'var(--kept)', 'var(--dropped)'];

/** Drop-reason labels for the funnel chips (order = display order). */
const DROP_KEYS = [
  'dropped_novelty',
  'dropped_quality',
  'dropped_verifier',
  'dropped_jury',
  'duplicates',
  'dead_lettered',
  'pii_dropped',
  'pii_redacted',
  'contaminated',
] as const;

const pct = (v: number | undefined | null): string =>
  v === undefined || v === null ? '—' : `${(v * 100).toFixed(1)}%`;

const num = (v: number | undefined | null): string =>
  v === undefined || v === null ? '—' : v.toLocaleString();

export const DatasetPanel: React.FC<DatasetPanelProps> = ({ runId, status, refetchRun }) => {
  const client = useQueryClient();
  const isBuilding = status === 'building';
  const datasetQuery = useQuery({
    queryKey: ['run-dataset', runId],
    queryFn: () => api.getDatasetSummary(runId),
    enabled: status !== 'building',
    retry: false,
  });

  const buildMutation = useMutation({
    mutationFn: () => api.buildRun(runId),
    onSuccess: (run) => {
      client.setQueryData(['run', runId], (old: Record<string, unknown> | undefined) => old ? { ...old, ...run } : undefined);
      void client.invalidateQueries({ queryKey: ['runs'] });
      refetchRun();
    },
  });

  useEffect(() => { if (status !== 'building') void client.invalidateQueries({ queryKey: ['run-dataset', runId] }); }, [status, runId, client]);

  const hasDataset = !!datasetQuery.data;
  const is404 =
    !hasDataset && datasetQuery.error instanceof ApiError && datasetQuery.error.status === 404;
  const metaText = hasDataset
    ? `${datasetQuery.data!.output_format ?? 'jsonl'} · exit=${datasetQuery.data!.exit_reason ?? '?'}`
    : 'Engine B output';

  return (
    <div className="panel dataset-panel">
      <div className="panel__head">
        <span className="panel__title">Dataset</span>
        <span className="panel__meta">{metaText}</span>
        {hasDataset && !isBuilding && <Button onClick={() => downloadFile(`${runId}-dataset-summary.json`, JSON.stringify(datasetQuery.data, null, 2))}><Download size={14} />Export summary</Button>}
        {status === 'succeeded' && (
          <Button
            variant={hasDataset ? 'secondary' : 'primary'}
            onClick={() => buildMutation.mutate()}
            disabled={buildMutation.isPending}
          >
            <Hammer size={14} strokeWidth={2.2} aria-hidden="true" />
            {buildMutation.isPending ? 'Building…' : hasDataset ? 'Resume dataset build' : 'Build Dataset'}
          </Button>
        )}
      </div>

      {buildMutation.isError && (
        <div className="callout-error" style={{ margin: '0 var(--space-16)' }}>
          <div>
            <div className="callout-error__title">Build failed to start</div>
            <div className="callout-error__body">{(buildMutation.error as Error).message}</div>
          </div>
        </div>
      )}

      <div className="panel--pad">
        {isBuilding && (
          <div className="dataset-panel__building">
            <Hammer size={16} className="dataset-panel__hammer" aria-hidden="true" />
            Engine B is synthesizing and curating records…
          </div>
        )}

        {!isBuilding && datasetQuery.isPending && (
          <div className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
            Loading dataset summary…
          </div>
        )}

        {!isBuilding && is404 && (
          <div className="dataset-panel__empty">
            {status === 'succeeded' ? 'No dataset yet. Build from this run’s acquired corpus to synthesize, verify and curate records.' : 'No dataset summary was saved for this run.'}
          </div>
        )}

        {!isBuilding && !is404 && datasetQuery.isError && (
          <div className="callout-error">
            <div>
              <div className="callout-error__title">Failed to load dataset</div>
              <div className="callout-error__body">{(datasetQuery.error as Error).message}</div>
            </div>
          </div>
        )}

        {!isBuilding && hasDataset && <DatasetBody summary={datasetQuery.data!} />}
      </div>
    </div>
  );
};

const MetricStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="metric">
    <span className="metric__label">{label}</span>
    <span className="metric__value">{value}</span>
  </div>
);

const DatasetBody: React.FC<{ summary: DatasetSummary }> = ({ summary }) => {
  const counts = summary.counts ?? {};
  const quality = summary.quality ?? undefined;
  const drops = DROP_KEYS.map((k) => ({ key: k, n: counts[k] ?? 0 })).filter((d) => d.n > 0);

  return (
    <div className="dataset-panel__body">
      {/* Headline numbers */}
      <div className="dataset-panel__metrics">
        <MetricStat label="Records" value={num(counts.total_records)} />
        <MetricStat label="Accept Rate" value={pct(counts.accept_rate)} />
        <MetricStat label="Generated" value={num(counts.generated)} />
        <MetricStat label="Output" value={summary.output_format ?? '—'} />
      </div>

      {/* Curation funnel losses */}
      {drops.length > 0 && (
        <div className="dataset-panel__drops">
          <span className="dataset-panel__section-label text-muted">
            Curated out · {num(counts.accepted)} of {num(counts.generated)} accepted
          </span>
          <div className="dataset-panel__drop-chips">
            {drops.map(({ key, n }) => (
              <span key={key} className="drop-chip" title={`records ${key.replace(/_/g, ' ')}`}>
                <span className="drop-chip__label">
                  {key.replace(/^dropped_/, '').replace(/_/g, ' ')}
                </span>
                <span className="drop-chip__count mono">{n.toLocaleString()}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <SplitBar countsBySplit={summary.counts_by_split ?? {}} />

      {(summary.coverage?.per_aspect || summary.coverage?.thin_aspects) && (
        <CoverageBlock coverage={summary.coverage!} thinFromCounts={counts.thin_aspects ?? []} />
      )}

      {/* Efficiency */}
      {(counts.tokens_per_accepted_record !== undefined ||
        counts.cost_per_accepted_record != null) && (
        <div className="dataset-panel__metrics dataset-panel__metrics--compact">
          <MetricStat
            label="Tokens / accepted record"
            value={num(counts.tokens_per_accepted_record)}
          />
          <MetricStat
            label="Cost / accepted record"
            value={
              counts.cost_per_accepted_record == null
                ? 'unknown'
                : `$${counts.cost_per_accepted_record.toFixed(4)}`
            }
          />
        </div>
      )}

      {quality && <QualityGate quality={quality} />}

      {(summary.notes?.length ?? 0) > 0 && (
        <div className="dataset-panel__notes mono">
          {summary.notes!.map((note, i) => (
            <div key={i} className="run-monitor__note-line">
              <span className="run-monitor__note-bullet">·</span>
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SplitBar: React.FC<{ countsBySplit: Record<string, number> }> = ({ countsBySplit }) => {
  const entries = Object.entries(countsBySplit);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (entries.length === 0 || total === 0) return null;

  return (
    <div className="dataset-panel__splits">
      <span className="dataset-panel__section-label text-muted">Splits</span>
      <div className="split-bar" role="img" aria-label="record distribution across splits">
        {entries.map(([split, n], i) => (
          <div
            key={split}
            className="split-bar__segment"
            style={{
              width: `${(n / total) * 100}%`,
              background: SPLIT_COLORS[i % SPLIT_COLORS.length],
            }}
            title={`${split}: ${n.toLocaleString()} (${((n / total) * 100).toFixed(1)}%)`}
          />
        ))}
      </div>
      <div className="split-bar__legend">
        {entries.map(([split, n], i) => (
          <span key={split} className="split-bar__legend-item">
            <span
              className="split-bar__swatch"
              style={{ background: SPLIT_COLORS[i % SPLIT_COLORS.length] }}
            />
            <span>{split}</span>
            <span className="mono text-muted">{n.toLocaleString()}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

const CoverageBlock: React.FC<{
  coverage: NonNullable<DatasetSummary['coverage']>;
  thinFromCounts: string[];
}> = ({ coverage, thinFromCounts }) => {
  const perAspect = Object.entries(coverage.per_aspect ?? {});
  if (perAspect.length === 0) return null;

  const target = coverage.target_per_aspect;
  const thin = new Set([...(coverage.thin_aspects ?? []), ...thinFromCounts]);

  return (
    <div className="dataset-panel__coverage">
      <span className="dataset-panel__section-label text-muted">
        Aspect coverage{target ? ` · target ${Math.round(target).toLocaleString()} / aspect` : ''}
      </span>
      {perAspect.map(([aspectId, count]) => {
        const fraction = target ? Math.min(1, count / target) : 1;
        return (
          <div key={aspectId} className="coverage-row">
            <span className="coverage-row__id mono">{aspectId}</span>
            <ScoreBar value={fraction} showText={false} />
            <span className="mono coverage-row__count">{count.toLocaleString()}</span>
            {thin.has(aspectId) && <span className="thin-pill">thin</span>}
          </div>
        );
      })}
    </div>
  );
};

type QualityBlock = NonNullable<DatasetSummary['quality']>;

const QUALITY_ROWS: Array<{
  key: keyof QualityBlock;
  label: string;
  format: (v: number) => string;
  fails?: (v: number) => boolean;
}> = [
  {
    key: 'schema_validation_pass_rate',
    label: 'Schema validation',
    format: pct,
    fails: (v) => v < 1,
  },
  {
    key: 'contamination_residual_count',
    label: 'Contamination residuals',
    format: num,
    fails: (v) => v > 0,
  },
  { key: 'pii_residual_count', label: 'PII residuals', format: num, fails: (v) => v > 0 },
  { key: 'duplicate_rate', label: 'Duplicate rate', format: pct },
  { key: 'license_coverage', label: 'License coverage', format: pct },
];

const QualityGate: React.FC<{ quality: QualityBlock }> = ({ quality }) => (
  <div className="quality-gate">
    <span className="dataset-panel__section-label text-muted">Quality gate</span>
    <div className="quality-gate__grid">
      {QUALITY_ROWS.map(({ key, label, format, fails }) => {
        const raw = quality[key];
        const value = typeof raw === 'number' ? raw : null;
        const failed = value !== null && !!fails?.(value);
        return (
          <div
            key={String(key)}
            className={`quality-gate__cell${failed ? ' quality-gate__cell--fail' : ''}`}
          >
            <span className="quality-gate__label">{label}</span>
            <span className="mono">{value === null ? '—' : format(value)}</span>
          </div>
        );
      })}
    </div>
    {(quality.warnings?.length ?? 0) > 0 && (
      <ul className="quality-gate__warnings">
        {quality.warnings!.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    )}
  </div>
);
