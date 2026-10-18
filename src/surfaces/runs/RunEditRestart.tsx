import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { DiscoverySubmit } from '../discovery/DiscoverySubmit';

/**
 * Edit-and-restart: loads a finished run's saved spec into the discovery form
 * pre-filled, so the operator can tweak the config and launch it as a fresh run.
 */
export const RunEditRestart: React.FC = () => {
  const { runId = '' } = useParams();
  const specQuery = useQuery({
    queryKey: ['run-spec', runId],
    queryFn: () => api.getRunSpec(runId),
    retry: false,
  });

  if (specQuery.isLoading) {
    return (
      <div className="empty-state">
        <p className="empty-state__text">Loading saved configuration…</p>
      </div>
    );
  }

  if (specQuery.isError || !specQuery.data) {
    return (
      <div className="callout-error" style={{ margin: 'var(--space-24)' }}>
        <AlertCircle size={20} style={{ flexShrink: 0 }} />
        <div>
          <h3 className="callout-error__title">Failed to load the run's config</h3>
          <p className="callout-error__body">{(specQuery.error as Error)?.message}</p>
        </div>
      </div>
    );
  }

  return <DiscoverySubmit initialSpec={specQuery.data} sourceRunId={runId} />;
};
