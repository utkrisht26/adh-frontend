import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ApprovalGate } from './ApprovalGate';
import { RunMonitor } from './RunMonitor';
import { AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ExecutionTrace } from './ExecutionTrace';
import { ErrorState, LoadingState } from '../../components/ui/QueryState';

export const RunDetail: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();

  const { data: run, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => api.getRun(runId!),
    enabled: !!runId,
    // Poll GET /api/runs/{id} at 2s while in-flight, stop when terminal
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const activeStates = ['discovering', 'awaiting_approval', 'acquiring', 'building'];
      return activeStates.includes(data.status) ? 2000 : false;
    },
  });

  if (isLoading) {
    return <LoadingState label="Loading run detail…" />;
  }

  if (!run) {
    return (
      <div style={{ padding: '0 var(--space-16)' }}>
        <div className="callout-error">
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>
            <h3 className="callout-error__title">Failed to load run</h3>
            <p className="callout-error__body">{(error as Error)?.message || 'Run not found'}</p>
            <div style={{ marginTop: 'var(--space-12)' }}>
              <Link to="/runs">
                <Button>Back to Runs</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Branch on status: awaiting_approval renders approval gate, others render monitor
  if (run.status === 'awaiting_approval') {
    return <>{isError && <ErrorState title="Couldn’t refresh run" error={error} retry={() => void refetch()} />}<ApprovalGate key={run.run_id} run={run} refetch={refetch} /><ExecutionTrace key={run.run_id} runId={run.run_id} status={run.status} /></>;
  }

  return <>{isError && <ErrorState title="Couldn’t refresh run" error={error} retry={() => void refetch()} />}<RunMonitor key={run.run_id} run={run} refetch={refetch} /></>;
};
