import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { JobSpec, JobSpecSaved, SpecBuilderSchema, SpecIssue, SpecValidationResult } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { SpecField } from './SpecField';
import { changeAt, fieldId, schemaValidator } from './schema';
import type { Draft, SchemaNode } from './schema';
import './SpecBuilder.css';

interface Props { initialSpec?: JobSpec | JobSpecSaved; sourceRunId?: string; }
const DRAFT_KEY = 'adh_jobspec_draft_v1';
const SECTIONS = [
  { title: 'Goal & content', fields: ['name', 'description', 'motivation', 'intended_uses', 'out_of_scope_uses', 'task_categories', 'languages', 'modality'] },
  { title: 'Records & verification', fields: ['target_size', 'verifiability_tier', 'record_schema_ref', 'judge_config'] },
  { title: 'Discovery & source policy', fields: ['discovery', 'allowed_licenses', 'pii_policy'] },
  { title: 'Generation & diversity', fields: ['generator_models', 'generation_params', 'diversity_strategy', 'dedup_policy'] },
  { title: 'Delivery & evaluation', fields: ['splits', 'decontaminate_against', 'output_format', 'delivery_layout', 'output_license', 'distribution_target', 'maintainer', 'emit_datasheet'] },
  { title: 'Budgets & identifiers', fields: ['limits', 'job_id'] },
];

export function SpecBuilder(props: Props) {
  const query = useQuery({ queryKey: ['spec-builder-schema'], queryFn: api.getSpecBuilder, staleTime: 60_000 });
  if (query.isPending) return <div className="empty-state" role="status">Loading Job Spec contract…</div>;
  if (query.isError) return <div className="callout-error" role="alert"><div><p>Could not load the Job Spec contract: {query.error.message}</p><Button onClick={() => query.refetch()}>Retry</Button></div></div>;
  return <Editor key={props.sourceRunId ?? 'new'} {...props} contract={query.data} />;
}

function Editor({ initialSpec, sourceRunId, contract }: Props & { contract: SpecBuilderSchema }) {
  const [draft, setDraft] = useState<Draft>(() => structuredClone(initialSpec ?? contract.defaults) as Draft);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SpecValidationResult | null>(null);
  const [issues, setIssues] = useState<SpecIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const [yaml, setYaml] = useState('');
  const [mode, setMode] = useState<'form' | 'yaml'>('form');
  const [epoch, setEpoch] = useState(0);
  const generation = useRef(0);
  const navigate = useNavigate();
  const queries = useQueryClient();
  const validateClient = useMemo(() => schemaValidator(contract.json_schema), [contract.json_schema]);
  const root = contract.json_schema as SchemaNode;
  const limits = (draft.limits ?? {}) as Draft;

  function resetValidation() {
    generation.current += 1;
    setResult(null); setIssues([]); setFailure(''); setNotice('');
  }
  function update(path: string[], value: unknown) {
    resetValidation(); setDraft((d) => changeAt(d, path, value));
  }
  function replaceDraft(next: Draft) {
    resetValidation(); setDraft(structuredClone(next)); setRaw({}); setJsonErrors({}); setEpoch((v) => v + 1);
  }
  function editJson(path: string[], text: string) {
    const key = path.join('.');
    setRaw((v) => ({ ...v, [key]: text }));
    resetValidation();
    try {
      const value = JSON.parse(text);
      setDraft((d) => changeAt(d, path, value));
      setJsonErrors((v) => { const next = { ...v }; delete next[key]; return next; });
    } catch { setJsonErrors((v) => ({ ...v, [key]: 'Enter valid JSON.' })); }
  }
  function focusIssue(issue: SpecIssue) {
    setMode('form');
    requestAnimationFrame(() => {
      const node = document.getElementById(fieldId(issue.path ?? []));
      if (!node) return;
      let parent = node.parentElement;
      while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
      node.scrollIntoView({ behavior: 'auto', block: 'center' });
      const control = node.matches('input,textarea,select') ? node : node.querySelector('input,textarea,select');
      if (control instanceof HTMLElement) control.focus();
    });
  }
  async function check(action: 'validate' | 'export' | 'start') {
    const local = [...validateClient(draft), ...Object.entries(jsonErrors).map(([key, message]) => ({ path: key.split('.'), message }))];
    if (local.length) { setIssues(local); setResult(null); focusIssue(local[0]); return; }
    const revision = generation.current;
    setBusy(true); setFailure(''); setNotice('');
    try {
      const report = await api.validateSpec(draft);
      if (revision !== generation.current) return;
      setResult(report); setIssues(report.errors ?? []);
      if (!report.valid || !report.spec) { if (report.errors?.[0]) focusIssue(report.errors[0]); return; }
      setYaml(report.yaml_text ?? '');
      if (action === 'export') {
        const url = URL.createObjectURL(new Blob([report.yaml_text ?? ''], { type: 'application/yaml' }));
        const a = document.createElement('a'); a.href = url; a.download = `${String(draft.name || 'job-spec').replace(/[^a-z0-9_-]+/gi, '-')}.yaml`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Validated YAML exported.');
      }
      if (action === 'start') {
        const validated = report.spec as JobSpec;
        const run = sourceRunId ? await api.restartRun(sourceRunId, { spec: validated }) : await api.createRun(validated);
        try { localStorage.setItem(`adh_run_limits_${run.run_id}`, JSON.stringify(validated.limits)); } catch { /* Run monitor also reads the saved spec. */ }
        await queries.invalidateQueries({ queryKey: ['runs'] });
        navigate(`/runs/${run.run_id}`);
      }
    } catch (e) { setFailure((e as Error).message); }
    finally { setBusy(false); }
  }
  async function importYaml() {
    const revision = generation.current;
    setBusy(true); setFailure('');
    try {
      const report = await api.importSpec(yaml);
      if (revision !== generation.current) return;
      if (report.draft) { replaceDraft(report.draft); setMode('form'); }
      setResult(report); setIssues(report.errors ?? []);
      setNotice(report.valid ? 'YAML imported and validated.' : 'YAML needs correction. Review the errors below.');
    } catch (e) { setFailure((e as Error).message); }
    finally { setBusy(false); }
  }
  function saveDraft() {
    if (Object.keys(jsonErrors).length) { setFailure('Correct invalid JSON before saving the draft.'); return; }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); setNotice('Draft saved in this browser.'); }
    catch { setFailure('Browser storage is unavailable. Export YAML to keep a copy.'); }
  }
  function restoreDraft() {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) { setNotice('No saved draft in this browser.'); return; }
      const value = JSON.parse(saved);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      replaceDraft(value); setNotice('Saved draft restored. Validate it before starting.');
    } catch { setFailure('The saved draft could not be restored. Import a YAML file instead.'); }
  }

  return <div className="spec-builder">
    <div className="screen-head"><div><h1 className="screen-title">{sourceRunId ? 'Edit & restart job' : 'Job Spec Builder'}</h1>
      {sourceRunId && <p className="screen-subtitle">Creates a new run from <span className="mono">{sourceRunId}</span>.</p>}</div></div>
    <div className="spec-toolbar">
      <Button disabled={busy} onClick={() => setMode('form')} aria-pressed={mode === 'form'}>Guided form</Button>
      <Button disabled={busy} onClick={() => setMode('yaml')} aria-pressed={mode === 'yaml'}>Import / preview YAML</Button>
      <Button disabled={busy} onClick={saveDraft}>Save draft</Button>
      <Button disabled={busy} onClick={restoreDraft}>Restore draft</Button>
    </div>
    {failure && <div className="callout-error" role="alert">{failure}</div>}
    {notice && <p role="status" className="spec-notice">{notice}</p>}
    {Object.values(contract.model_overrides).some((v) => v.length) && <details className="spec-overrides"><summary>Deployment model overrides are active</summary>
      {Object.entries(contract.model_overrides).filter(([, v]) => v.length).map(([key, values]) => <p key={key}><strong>{key.replaceAll('_', ' ')}:</strong> <span className="mono">{values.join(', ')}</span></p>)}
      <p>These server settings take precedence over the model fields below.</p>
    </details>}
    {issues.length > 0 && <div className="spec-validation spec-validation--error" role="alert"><h2>Resolve {issues.length} validation {issues.length === 1 ? 'issue' : 'issues'}</h2><ul>{issues.map((e, i) => <li key={i}><button type="button" onClick={() => focusIssue(e)}>{(e.path ?? []).length ? `${(e.path ?? []).join('.')} — ` : ''}{e.message}</button></li>)}</ul></div>}
    {result?.valid && <p className="spec-validation spec-validation--valid" role="status">Spec valid — schema and verification checks passed.</p>}
    {result?.warnings?.length ? <div className="spec-warnings"><h2>Review before starting</h2><ul>{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div> : null}
    <form noValidate onSubmit={(e) => { e.preventDefault(); void check(result?.valid ? 'start' : 'validate'); }}>
      <fieldset disabled={busy} className="spec-editor">
        {mode === 'yaml' ? <div className="spec-yaml">
          <label htmlFor="spec-yaml-file">Import YAML or JSON file</label>
          <input id="spec-yaml-file" type="file" accept=".yaml,.yml,.json" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 200_000) { setFailure('Choose a spec file smaller than 200 KB.'); return; }
            try { setYaml(await file.text()); } catch { setFailure('Could not read the file.'); }
            e.target.value = '';
          }} />
          <label htmlFor="spec-yaml">YAML document</label>
          <textarea id="spec-yaml" rows={22} className="mono" spellCheck={false} value={yaml} onChange={(e) => setYaml(e.target.value)} />
          <p className="spec-hint">Apply YAML to replace the form. Validate the form to refresh this preview.</p>
          <Button type="button" disabled={!yaml.trim()} onClick={importYaml}>Apply YAML</Button>
        </div> : <>
          <div className="spec-profile"><label htmlFor="spec-profile">Use record settings for</label><select id="spec-profile" defaultValue="" onChange={(e) => {
            const profile = contract.profiles.find((p) => p.modality === e.target.value);
            if (!profile) return;
            const media = ['image', 'video'].includes(profile.modality);
            const discovery = (draft.discovery ?? {}) as Draft;
            replaceDraft({ ...draft, modality: profile.modality, record_schema_ref: profile.record_schema_ref,
              verifiability_tier: profile.verifiability_tier,
              judge_config: profile.verifiability_tier >= 2 ? draft.judge_config ?? contract.defaults.judge_config : null,
              discovery: { ...discovery, channels: media ? ['media'] : ['datasets', 'web', 'synthesis'] },
            });
            e.target.value = '';
          }}><option value="">Choose a starting point…</option>{contract.profiles.map((p) => <option key={p.modality} value={p.modality}>{p.label}</option>)}</select>
          <p className="spec-hint">Updates modality, schema, verification tier and discovery channels. Other fields are preserved.</p></div>
          {SECTIONS.map((section, index) => <details className="spec-section" key={section.title} open={index < 2 || issues.some((e) => section.fields.includes(String((e.path ?? [])[0])))}>
            <summary><span className="spec-section__number mono">{String(index + 1).padStart(2, '0')}</span>{section.title}</summary>
            <div className="spec-section__body">{section.fields.map((name) => root.properties?.[name] && <SpecField key={`${epoch}-${name}`} root={root} node={root.properties[name]} path={[name]} value={draft[name]} onChange={update} onJson={editJson} raw={raw} issues={issues} required={root.required?.includes(name)} />)}</div>
          </details>)}
        </>}
      </fieldset>
      <div className="spec-actions">
        <div className="spec-budget"><span>Ceilings</span><strong className="mono">{Number(limits.max_llm_tokens ?? 0).toLocaleString()} tokens · ${Number(limits.max_cost_usd ?? 0).toLocaleString()}</strong><small>Actual cost depends on provider reporting.</small></div>
        <div className="spec-actions__buttons">
          <Button type="button" disabled={busy} onClick={() => check('validate')}>Validate spec</Button>
          <Button type="button" disabled={busy} onClick={() => check('export')}>Export YAML</Button>
          <Button type="submit" variant="primary" disabled={busy || mode === 'yaml'}>{busy ? 'Working…' : !result?.valid ? 'Validate & review' : sourceRunId ? 'Restart with changes' : 'Start discovery'}</Button>
        </div>
      </div>
    </form>
  </div>;
}
