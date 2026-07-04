import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { CrawlJobRequest } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { AlertCircle, Sparkles, Plus, X } from 'lucide-react';
import './CrawlSubmit.css';

interface Preset {
  name: string;
  url: string;
  keywords: string[];
  judge: 'none' | 'bm25' | 'llm';
  llm_model?: string;
  content_threshold: number;
}

const DEFAULT_PRESETS: Preset[] = [
  {
    name: 'Django Views',
    url: 'https://docs.djangoproject.com/en/5.0/topics/http/views/',
    keywords: ['views', 'request', 'response', 'cbv', 'dispatch'],
    judge: 'bm25',
    content_threshold: 0.3,
  },
  {
    name: 'FastAPI Tutorial',
    url: 'https://fastapi.tiangolo.com/tutorial/',
    keywords: ['fastapi', 'async', 'pydantic', 'endpoint', 'router'],
    judge: 'llm',
    llm_model: 'gpt-4o-mini',
    content_threshold: 0.5,
  },
  {
    name: 'Python Standard Library',
    url: 'https://docs.python.org/3/library/',
    keywords: ['modules', 'standard', 'builtin', 'functions'],
    judge: 'none',
    content_threshold: 0.0,
  },
];

const MODEL_RATES: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 },
  'gpt-4o': { input: 0.005 / 1000, output: 0.015 / 1000 },
  'claude-3-5-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 },
  'claude-3-haiku': { input: 0.00025 / 1000, output: 0.00125 / 1000 },
};

const DEFAULT_RATES = { input: 0.00015 / 1000, output: 0.0006 / 1000 };

export const CrawlSubmit: React.FC = () => {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<Preset[]>([]);

  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(8);
  const [maxFetches, setMaxFetches] = useState<number | ''>('');
  const [maxDepth, setMaxDepth] = useState(2);
  const [judge, setJudge] = useState<'none' | 'bm25' | 'llm'>('bm25');
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');
  const [contentThreshold, setContentThreshold] = useState(0.35);
  const [saturation, setSaturation] = useState(true);
  const [respectRobotsTxt, setRespectRobotsTxt] = useState(true);
  const [collapseVersions, setCollapseVersions] = useState(false);
  const [pinLocales, setPinLocales] = useState(false);

  const [keywords, setKeywords] = useState<string[]>([]);
  const [includeDomains, setIncludeDomains] = useState<string[]>([]);
  const [excludeDomains, setExcludeDomains] = useState<string[]>([]);
  const [allowedLocales, setAllowedLocales] = useState<string[]>([]);

  const [kwInput, setKwInput] = useState('');
  const [incDomInput, setIncDomInput] = useState('');
  const [excDomInput, setExcDomInput] = useState('');
  const [localeInput, setLocaleInput] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('adh_crawl_presets');
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch {
        setPresets(DEFAULT_PRESETS);
      }
    } else {
      setPresets(DEFAULT_PRESETS);
      localStorage.setItem('adh_crawl_presets', JSON.stringify(DEFAULT_PRESETS));
    }
  }, []);

  const applyPreset = (preset: Preset) => {
    setUrl(preset.url);
    setKeywords(preset.keywords);
    setJudge(preset.judge);
    if (preset.llm_model) setLlmModel(preset.llm_model);
    setContentThreshold(preset.content_threshold);
  };

  const handleAddPreset = () => {
    if (!url) return;
    const name = prompt('Enter preset name:', new URL(url).hostname || 'Custom preset');
    if (!name) return;
    const newPreset: Preset = {
      name,
      url,
      keywords,
      judge,
      llm_model: judge === 'llm' ? llmModel : undefined,
      content_threshold: contentThreshold,
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem('adh_crawl_presets', JSON.stringify(updated));
  };

  const handleDeletePreset = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter((_, i) => i !== index);
    setPresets(updated);
    localStorage.setItem('adh_crawl_presets', JSON.stringify(updated));
  };

  const addKeyword = () => {
    if (kwInput.trim() && !keywords.includes(kwInput.trim())) {
      setKeywords([...keywords, kwInput.trim()]);
      setKwInput('');
    }
  };
  const removeKeyword = (val: string) => setKeywords(keywords.filter((k) => k !== val));

  const addIncDomain = () => {
    if (incDomInput.trim() && !includeDomains.includes(incDomInput.trim())) {
      setIncludeDomains([...includeDomains, incDomInput.trim()]);
      setIncDomInput('');
    }
  };
  const removeIncDomain = (val: string) => setIncludeDomains(includeDomains.filter((d) => d !== val));

  const addExcDomain = () => {
    if (excDomInput.trim() && !excludeDomains.includes(excDomInput.trim())) {
      setExcludeDomains([...excludeDomains, excDomInput.trim()]);
      setExcDomInput('');
    }
  };
  const removeExcDomain = (val: string) => setExcludeDomains(excludeDomains.filter((d) => d !== val));

  const addLocale = () => {
    if (localeInput.trim() && !allowedLocales.includes(localeInput.trim())) {
      setAllowedLocales([...allowedLocales, localeInput.trim()]);
      setLocaleInput('');
    }
  };
  const removeLocale = (val: string) => setAllowedLocales(allowedLocales.filter((l) => l !== val));

  const mutation = useMutation({
    mutationFn: (data: CrawlJobRequest) => api.submitJob(data),
    onSuccess: (data) => {
      navigate(`/crawl/${data.job_id}`);
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    const payload: CrawlJobRequest = {
      url,
      max_pages: maxPages,
      max_depth: maxDepth,
      keywords,
      include_domains: includeDomains,
      exclude_domains: excludeDomains,
      allowed_locales: allowedLocales,
      respect_robots_txt: respectRobotsTxt,
      judge,
      content_threshold: contentThreshold,
      saturation,
      collapse_versions: collapseVersions,
      pin_locales: pinLocales,
    };

    if (maxFetches !== '') {
      payload.max_fetches = Number(maxFetches);
    }
    if (judge === 'llm') {
      payload.llm_model = llmModel;
    }

    mutation.mutate(payload);
  };

  const rates = MODEL_RATES[llmModel] || DEFAULT_RATES;
  const inputTokensPerPage = 1000;
  const outputTokensPerPage = 100;
  const costPerPage = inputTokensPerPage * rates.input + outputTokensPerPage * rates.output;
  const estimatedCost = maxPages * costPerPage;
  const totalEstimatedTokens = maxPages * (inputTokensPerPage + outputTokensPerPage);

  return (
    <div className="crawl-submit">
      <div className="screen-head">
        <h1 className="screen-title">Start Crawl Job</h1>
        <Button onClick={handleAddPreset} disabled={!url} style={{ minHeight: '36px' }}>
          Save Preset
        </Button>
      </div>

      {presets.length > 0 && (
        <div className="crawl-submit__presets">
          <span className="field-label-block">Saved Presets</span>
          <div className="preset-chips">
            {presets.map((preset, index) => (
              <div key={index} className="preset-chip" onClick={() => applyPreset(preset)}>
                <span>{preset.name}</span>
                {presets.length > 1 && (
                  <button className="preset-chip__remove" onClick={(e) => handleDeletePreset(index, e)}>
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="form">
        <div className="field">
          <label className="field__label">Seed URL</label>
          <input
            type="url"
            required
            placeholder="https://example.com/docs/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="input"
          />
        </div>

        <div className="grid-3">
          <div className="field">
            <label className="field__label">Max Pages (Kept)</label>
            <input type="number" min={1} max={500} required value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} className="input" />
          </div>
          <div className="field">
            <label className="field__label">Max Fetches (Optional)</label>
            <input type="number" min={1} placeholder="e.g. 32" value={maxFetches} onChange={(e) => setMaxFetches(e.target.value === '' ? '' : Number(e.target.value))} className="input" />
          </div>
          <div className="field">
            <label className="field__label">Max Depth</label>
            <input type="number" min={0} max={10} required value={maxDepth} onChange={(e) => setMaxDepth(Number(e.target.value))} className="input" />
          </div>
        </div>

        <div className="field">
          <label className="field__label">
            Topic Keywords <span className="field__label-hint">(steers crawler)</span>
          </label>
          {keywords.length > 0 && (
            <div className="chip-list" style={{ marginBottom: 'var(--space-8)' }}>
              {keywords.map((kw, i) => (
                <span key={i} className="chip chip--accent">
                  {kw}
                  <button type="button" className="chip__remove" onClick={() => removeKeyword(kw)}>
                    <X size={12} color="var(--accent)" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="chip-input">
            <input
              type="text"
              placeholder="Add keyword..."
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
              className="input"
              style={{ flex: 1 }}
            />
            <Button type="button" onClick={addKeyword} style={{ minHeight: '44px' }}>
              <Plus size={16} />
            </Button>
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section__title">Domains & Locales</h2>
          <div className="form-section__body">
            <div className="field">
              <label className="field__label">Allowed Locales (e.g. "en", "es")</label>
              {allowedLocales.length > 0 && (
                <div className="chip-list" style={{ marginBottom: '6px' }}>
                  {allowedLocales.map((l, i) => (
                    <span key={i} className="chip chip--muted">
                      {l}
                      <button type="button" className="chip__remove" onClick={() => removeLocale(l)}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="chip-input">
                <input type="text" placeholder="en, fr..." value={localeInput} onChange={(e) => setLocaleInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLocale(); } }} className="input input--sm" style={{ flex: 1 }} />
                <Button type="button" onClick={addLocale} style={{ minHeight: '36px', padding: '0 12px' }}>Add</Button>
              </div>
            </div>

            <div className="field">
              <label className="field__label">Limit to Domains</label>
              {includeDomains.length > 0 && (
                <div className="chip-list" style={{ marginBottom: '6px' }}>
                  {includeDomains.map((d, i) => (
                    <span key={i} className="chip chip--muted">
                      {d}
                      <button type="button" className="chip__remove" onClick={() => removeIncDomain(d)}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="chip-input">
                <input type="text" placeholder="sub.domain.com" value={incDomInput} onChange={(e) => setIncDomInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIncDomain(); } }} className="input input--sm" style={{ flex: 1 }} />
                <Button type="button" onClick={addIncDomain} style={{ minHeight: '36px', padding: '0 12px' }}>Add</Button>
              </div>
            </div>

            <div className="field">
              <label className="field__label">Exclude Domains</label>
              {excludeDomains.length > 0 && (
                <div className="chip-list" style={{ marginBottom: '6px' }}>
                  {excludeDomains.map((d, i) => (
                    <span key={i} className="chip chip--muted">
                      {d}
                      <button type="button" className="chip__remove" onClick={() => removeExcDomain(d)}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="chip-input">
                <input type="text" placeholder="spam.com" value={excDomInput} onChange={(e) => setExcDomInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExcDomain(); } }} className="input input--sm" style={{ flex: 1 }} />
                <Button type="button" onClick={addExcDomain} style={{ minHeight: '36px', padding: '0 12px' }}>Add</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section__title">Content Quality & Relevance</h2>
          <div className="form-section__body form-section__body--lg">
            <div className="field">
              <label className="field__label">Relevance Judge</label>
              <select value={judge} onChange={(e) => setJudge(e.target.value as 'none' | 'bm25' | 'llm')} className="input input--paper">
                <option value="none">none (Keep all fetched pages)</option>
                <option value="bm25">bm25 (Keyword-based token scoring)</option>
                <option value="llm">llm (Smart LLM judge verdict)</option>
              </select>
            </div>

            {judge === 'llm' && (
              <div className="field">
                <label className="field__label">LLM Model</label>
                <select value={llmModel} onChange={(e) => setLlmModel(e.target.value)} className="input input--paper">
                  <option value="gpt-4o-mini">gpt-4o-mini (Default - Fast & Economical)</option>
                  <option value="gpt-4o">gpt-4o (High intelligence)</option>
                  <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                  <option value="claude-3-haiku">claude-3-haiku</option>
                </select>
              </div>
            )}

            {judge !== 'none' && (
              <div className="field">
                <div className="range-row__head">
                  <label className="field__label">Relevance Threshold</label>
                  <span className="mono" style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{contentThreshold.toFixed(2)}</span>
                </div>
                <input type="range" min="0.0" max="1.0" step="0.05" value={contentThreshold} onChange={(e) => setContentThreshold(Number(e.target.value))} className="range" />
              </div>
            )}
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section__title">Crawler Policy Switches</h2>
          <div className="form-section__body">
            <label className="switch">
              <input type="checkbox" className="switch__box" checked={saturation} onChange={(e) => setSaturation(e.target.checked)} />
              <div>
                <span className="switch__title">Novelty Saturation Stop</span>
                <span className="switch__desc">Halts crawl if content duplicates overlap</span>
              </div>
            </label>
            <label className="switch">
              <input type="checkbox" className="switch__box" checked={respectRobotsTxt} onChange={(e) => setRespectRobotsTxt(e.target.checked)} />
              <div>
                <span className="switch__title">Respect Robots.txt</span>
                <span className="switch__desc">Obey robots exclusions (highly recommended)</span>
              </div>
            </label>
            <label className="switch">
              <input type="checkbox" className="switch__box" checked={collapseVersions} onChange={(e) => setCollapseVersions(e.target.checked)} />
              <div>
                <span className="switch__title">Collapse Documentation Versions</span>
                <span className="switch__desc">Prevents crawling duplicate versioned paths</span>
              </div>
            </label>
            <label className="switch">
              <input type="checkbox" className="switch__box" checked={pinLocales} onChange={(e) => setPinLocales(e.target.checked)} />
              <div>
                <span className="switch__title">Pin Locales</span>
                <span className="switch__desc">Rejects localized paths not in target locales</span>
              </div>
            </label>
          </div>
        </div>

        {judge === 'llm' && (
          <div className="cost-estimate">
            <Sparkles size={18} color="var(--accent)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <h3 className="cost-estimate__title">LLM Evaluation Cost Estimate</h3>
              <p className="cost-estimate__body">
                Selected model <strong className="mono">{llmModel}</strong> carries an estimated ceiling rate of{' '}
                <strong>${estimatedCost.toFixed(5)}</strong> for evaluating up to {maxPages} pages (~{totalEstimatedTokens.toLocaleString()} tokens).
              </p>
            </div>
          </div>
        )}

        <div className="crawl-submit__submit">
          <Button type="submit" variant="primary" disabled={mutation.isPending || !url} style={{ width: '100%', minHeight: '44px', fontSize: 'var(--text-base)' }}>
            {mutation.isPending ? 'Submitting Crawl…' : 'Start Crawl'}
          </Button>
          {mutation.isError && (
            <div className="crawl-submit__error">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>Failed to submit crawl: {mutation.error.message}</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
