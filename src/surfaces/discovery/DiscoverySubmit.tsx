import { SpecBuilder } from '../jobspec/SpecBuilder';
import type { JobSpec, JobSpecSaved } from '../../lib/api';

// New discovery and edit/restart share the complete, validated Job Spec editor.
export function DiscoverySubmit(props: { initialSpec?: JobSpec | JobSpecSaved; sourceRunId?: string }) {
  return <SpecBuilder {...props} />;
}
