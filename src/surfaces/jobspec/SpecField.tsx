import { useState } from 'react';
import type { SpecIssue } from '../../lib/api';
import { fieldId, resolveNode } from './schema';
import type { SchemaNode, Draft } from './schema';

const LABELS: Record<string, string> = {
  name: 'Job name', description: 'Dataset goal', motivation: 'Why this dataset?',
  record_schema_ref: 'Record schema file', verifiability_tier: 'Verification tier',
  generator_models: 'Generator models', judge_config: 'Judge panel',
  pii_policy: 'Personal data policy', generation_params: 'Generation parameters (JSON)',
  splits: 'Dataset splits (JSON)', max_cost_usd: 'Maximum cost (USD)',
  max_llm_tokens: 'Maximum LLM tokens', recency_after: 'Published after (YYYY-MM-DD)',
};
const HINTS: Record<string, string> = {
  record_schema_ref: 'Local JSON Schema file on the server. Tier 1 requires an x-verifier hook.',
  verifiability_tier: 'Tier 1 uses executable checks. Tier 2 uses a judge panel. Tier 3 combines them.',
  judge_config: 'Tiers 2 and 3 require models from at least two distinct families.',
  generator_models: 'Use provider:model identifiers. Deployment overrides are shown above.',
  splits: 'Fractions must total 1. Evaluation splits also require decontamination references.',
  decontaminate_against: 'Local evaluation-reference files. Required for validation or test splits.',
  allow_unknown_licenses: 'Include sources whose license is unknown. This does not grant publishing rights.',
  approval_gate: 'Review discovered sources before acquisition begins.',
};

function Chips({ id, label, value, onChange }: { id: string; label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [pending, setPending] = useState('');
  const add = () => {
    const items = pending.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (items.length) onChange([...new Set([...value, ...items])]);
    setPending('');
  };
  return <div className="spec-chips">
    <div className="spec-chips__values">{value.map((item, i) => <span className="spec-chip" key={`${item}-${i}`}>
      <span>{item}</span><button type="button" aria-label={`Remove ${item} from ${label}`} onClick={() => onChange(value.filter((_, n) => n !== i))}>×</button>
    </span>)}</div>
    <input id={id} value={pending} placeholder="Add a value, then press Enter" onChange={(e) => setPending(e.target.value)} onBlur={add}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} />
  </div>;
}

interface Props {
  node: SchemaNode; root: SchemaNode; path: string[]; value: unknown;
  onChange: (path: string[], value: unknown) => void;
  issues: SpecIssue[]; raw: Record<string, string>;
  onJson: (path: string[], text: string) => void;
  required?: boolean;
}

export function SpecField(props: Props) {
  const { node, root, path, value, onChange, issues, raw, onJson, required } = props;
  const resolved = resolveNode(node, root);
  const key = path[path.length - 1];
  const id = fieldId(path);
  const label = LABELS[key] ?? resolved.title ?? key.replaceAll('_', ' ');
  const nullable = node.anyOf?.some((n) => n.type === 'null');
  const errors = issues.filter((e) => (e.path ?? []).join('.') === path.join('.'));
  const described = `${id}-hint ${id}-errors`;
  const shared = { id, 'aria-describedby': described, 'aria-invalid': errors.length > 0 };
  let control;
  if (path.join('.') === 'target_size') {
    const target = (value ?? {}) as Draft;
    const unit = target.tokens != null ? 'tokens' : 'records';
    control = <div className="spec-target">
      <select aria-label="Target unit" value={unit} onChange={(e) => onChange(path, { records: null, tokens: null, [e.target.value]: target[unit] ?? 100 })}>
        <option value="records">Records</option><option value="tokens">Tokens</option>
      </select>
      <input {...shared} type="number" min={1} step={1} value={String(target[unit] ?? '')} onChange={(e) => onChange(path, { records: null, tokens: null, [unit]: e.target.value === '' ? '' : Number(e.target.value) })} />
      {issues.filter((e) => (e.path ?? []).length > path.length && (e.path ?? [])[0] === 'target_size').map((e, i) => <span className="spec-error" key={i}>{e.message}</span>)}
    </div>;
  } else if (resolved.type === 'object' && resolved.properties) {
    const object = (value ?? {}) as Draft;
    return <fieldset id={id} className="spec-group">
      <legend>{label}</legend>
      <p id={`${id}-hint`} className="spec-hint">{HINTS[key] ?? resolved.description}</p>
      {nullable && <label className="spec-toggle"><input type="checkbox" checked={value != null} onChange={(e) => onChange(path, e.target.checked ? {} : null)} /> Enable {label.toLowerCase()}</label>}
      {(!nullable || value != null) && Object.entries(resolved.properties).map(([name, child]) =>
        <SpecField {...props} key={name} node={child} path={[...path, name]} value={object[name] ?? child.default} required={resolved.required?.includes(name)} />)}
      <div id={`${id}-errors`}>{errors.map((e, i) => <p className="spec-error" key={i}>{e.message}</p>)}</div>
    </fieldset>;
  } else if (resolved.type === 'boolean') {
    control = <label className="spec-toggle"><input {...shared} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(path, e.target.checked)} />{label}</label>;
  } else if (resolved.enum || key === 'verifiability_tier') {
    const choices = resolved.enum ?? [1, 2, 3];
    control = <select {...shared} value={value == null ? '' : String(value)} onChange={(e) => onChange(path, e.target.value === '' && nullable ? null : resolved.type === 'integer' ? Number(e.target.value) : e.target.value)}>
      <option value="">{nullable ? 'Use default' : 'Select…'}</option>
      {choices.map((v) => <option key={v} value={v}>{key === 'verifiability_tier' ? ({ 1: '1 — Executable checks', 2: '2 — LLM judge panel', 3: '3 — Checks + judge panel' }[Number(v)]) : v}</option>)}
    </select>;
  } else if (resolved.type === 'array' && resolveNode(resolved.items ?? {}, root).type === 'string') {
    const items = Array.isArray(value) ? value.map(String) : [];
    const choices = resolveNode(resolved.items ?? {}, root).enum;
    control = choices ? <div id={id} className="spec-choices">{choices.map((item) => <label key={item} className="spec-toggle"><input type="checkbox" checked={items.includes(String(item))} onChange={(e) => onChange(path, e.target.checked ? [...items, item] : items.filter((v) => v !== item))} />{item}</label>)}</div>
      : <Chips id={id} label={label} value={items} onChange={(v) => onChange(path, v)} />;
  } else if (resolved.type === 'object' || resolved.type === 'array') {
    control = <textarea {...shared} className="mono" rows={5} spellCheck={false} value={raw[path.join('.')] ?? JSON.stringify(value ?? {}, null, 2)} onChange={(e) => onJson(path, e.target.value)} />;
  } else if (resolved.type === 'number' || resolved.type === 'integer') {
    control = <input {...shared} type="number" step={resolved.type === 'integer' ? 1 : 'any'} min={resolved.minimum} max={resolved.maximum} value={value == null ? '' : String(value)} onChange={(e) => onChange(path, e.target.value === '' ? (nullable ? null : '') : Number(e.target.value))} />;
  } else if (key === 'description' || key === 'motivation') {
    control = <textarea {...shared} rows={key === 'description' ? 4 : 2} value={String(value ?? '')} onChange={(e) => onChange(path, e.target.value)} />;
  } else {
    control = <input {...shared} type="text" value={String(value ?? '')} minLength={resolved.minLength} onChange={(e) => onChange(path, e.target.value === '' && nullable ? null : e.target.value)} />;
  }
  return <div className="spec-field">
    {resolved.type !== 'boolean' && <label htmlFor={id}>{label}{required && <span className="spec-required"> *</span>}</label>}
    {control}
    <p className="spec-hint" id={`${id}-hint`}>{HINTS[key]}</p>
    <div id={`${id}-errors`}>{errors.map((e, i) => <p className="spec-error" key={i}>{e.message}</p>)}</div>
  </div>;
}
