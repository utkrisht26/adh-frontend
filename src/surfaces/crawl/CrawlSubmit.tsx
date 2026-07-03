import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { CrawlJobRequest } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { AlertCircle, Sparkles, Plus, X } from 'lucide-react';

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
  }
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

  // Form state
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

  // List arrays
  const [keywords, setKeywords] = useState<string[]>([]);
  const [includeDomains, setIncludeDomains] = useState<string[]>([]);
  const [excludeDomains, setExcludeDomains] = useState<string[]>([]);
  const [allowedLocales, setAllowedLocales] = useState<string[]>([]);

  // Input text helper states
  const [kwInput, setKwInput] = useState('');
  const [incDomInput, setIncDomInput] = useState('');
  const [excDomInput, setExcDomInput] = useState('');
  const [localeInput, setLocaleInput] = useState('');

  // Load presets
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

  // List helpers
  const addKeyword = () => {
    if (kwInput.trim() && !keywords.includes(kwInput.trim())) {
      setKeywords([...keywords, kwInput.trim()]);
      setKwInput('');
    }
  };
  const removeKeyword = (val: string) => setKeywords(keywords.filter(k => k !== val));

  const addIncDomain = () => {
    if (incDomInput.trim() && !includeDomains.includes(incDomInput.trim())) {
      setIncludeDomains([...includeDomains, incDomInput.trim()]);
      setIncDomInput('');
    }
  };
  const removeIncDomain = (val: string) => setIncludeDomains(includeDomains.filter(d => d !== val));

  const addExcDomain = () => {
    if (excDomInput.trim() && !excludeDomains.includes(excDomInput.trim())) {
      setExcludeDomains([...excludeDomains, excDomInput.trim()]);
      setExcDomInput('');
    }
  };
  const removeExcDomain = (val: string) => setExcludeDomains(excludeDomains.filter(d => d !== val));

  const addLocale = () => {
    if (localeInput.trim() && !allowedLocales.includes(localeInput.trim())) {
      setAllowedLocales([...allowedLocales, localeInput.trim()]);
      setLocaleInput('');
    }
  };
  const removeLocale = (val: string) => setAllowedLocales(allowedLocales.filter(l => l !== val));

  // Mutation
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

  // Cost calculation (Pages * ~1000 input tokens, ~100 output tokens)
  const rates = MODEL_RATES[llmModel] || DEFAULT_RATES;
  const inputTokensPerPage = 1000;
  const outputTokensPerPage = 100;
  const costPerPage = (inputTokensPerPage * rates.input) + (outputTokensPerPage * rates.output);
  const estimatedCost = maxPages * costPerPage;
  const totalEstimatedTokens = maxPages * (inputTokensPerPage + outputTokensPerPage);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>Start Crawl Job</h1>
        <Button onClick={handleAddPreset} disabled={!url} style={{ minHeight: '36px' }}>
          Save Preset
        </Button>
      </div>

      {/* Presets Row */}
      {presets.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-caption)', color: 'var(--ink-muted)', marginBottom: '8px', fontWeight: 500 }}>
            Saved Presets
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {presets.map((preset, index) => (
              <div
                key={index}
                onClick={() => applyPreset(preset)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-pill)',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  transition: 'background-color var(--dur-fast) var(--ease-out)',
                }}
                className="preset-chip"
              >
                <span>{preset.name}</span>
                {presets.length > 1 && (
                  <button
                    onClick={(e) => handleDeletePreset(index, e)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--ink-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0,
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single Column Form */}
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Seed URL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Seed URL</label>
          <input
            type="url"
            required
            placeholder="https://example.com/docs/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-cell)',
              backgroundColor: 'var(--surface)',
              minHeight: '44px',
            }}
          />
        </div>

        {/* Budgets Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Max Pages (Kept)</label>
            <input
              type="number"
              min={1}
              max={500}
              required
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-cell)',
                backgroundColor: 'var(--surface)',
                minHeight: '44px',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Max Fetches (Optional)</label>
            <input
              type="number"
              min={1}
              placeholder="e.g. 32"
              value={maxFetches}
              onChange={(e) => setMaxFetches(e.target.value === '' ? '' : Number(e.target.value))}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-cell)',
                backgroundColor: 'var(--surface)',
                minHeight: '44px',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Max Depth</label>
            <input
              type="number"
              min={0}
              max={10}
              required
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-cell)',
                backgroundColor: 'var(--surface)',
                minHeight: '44px',
              }}
            />
          </div>
        </div>

        {/* Keywords Chips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
            Topic Keywords <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}>(steers crawler)</span>
          </label>
          <div style={{ display: 'flex', gap: '6px', marginBottom: keywords.length > 0 ? '8px' : 0, flexWrap: 'wrap' }}>
            {keywords.map((kw, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'var(--accent-weak)',
                  color: 'var(--accent)',
                  fontSize: 'var(--text-sm)',
                  padding: '2px 8px',
                  borderRadius: 'var(--r-pill)',
                }}
              >
                {kw}
                <button type="button" onClick={() => removeKeyword(kw)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <X size={12} color="var(--accent)" />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Add keyword..."
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-cell)',
                backgroundColor: 'var(--surface)',
                minHeight: '44px',
              }}
            />
            <Button type="button" onClick={addKeyword} style={{ minHeight: '44px' }}>
              <Plus size={16} />
            </Button>
          </div>
        </div>

        {/* Constraints Accordion / Section */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-panel)', padding: '16px', backgroundColor: 'var(--surface)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '12px' }}>Domains & Locales</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Allowed Locales */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: 'var(--text-sm)' }}>Allowed Locales (e.g. "en", "es")</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: allowedLocales.length > 0 ? '6px' : 0 }}>
                {allowedLocales.map((l, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--surface-2)', padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
                    {l}
                    <button type="button" onClick={() => removeLocale(l)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={12} /></button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="en, fr..."
                  value={localeInput}
                  onChange={(e) => setLocaleInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLocale(); } }}
                  style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r-cell)', backgroundColor: 'var(--paper)', minHeight: '36px' }}
                />
                <Button type="button" onClick={addLocale} style={{ minHeight: '36px', padding: '0 12px' }}>Add</Button>
              </div>
            </div>

            {/* Include Domains */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: 'var(--text-sm)' }}>Limit to Domains</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: includeDomains.length > 0 ? '6px' : 0 }}>
                {includeDomains.map((d, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--surface-2)', padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
                    {d}
                    <button type="button" onClick={() => removeIncDomain(d)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={12} /></button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="sub.domain.com"
                  value={incDomInput}
                  onChange={(e) => setIncDomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIncDomain(); } }}
                  style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r-cell)', backgroundColor: 'var(--paper)', minHeight: '36px' }}
                />
                <Button type="button" onClick={addIncDomain} style={{ minHeight: '36px', padding: '0 12px' }}>Add</Button>
              </div>
            </div>

            {/* Exclude Domains */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: 'var(--text-sm)' }}>Exclude Domains</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: excludeDomains.length > 0 ? '6px' : 0 }}>
                {excludeDomains.map((d, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--surface-2)', padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
                    {d}
                    <button type="button" onClick={() => removeExcDomain(d)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={12} /></button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="spam.com"
                  value={excDomInput}
                  onChange={(e) => setExcDomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExcDomain(); } }}
                  style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r-cell)', backgroundColor: 'var(--paper)', minHeight: '36px' }}
                />
                <Button type="button" onClick={addExcDomain} style={{ minHeight: '36px', padding: '0 12px' }}>Add</Button>
              </div>
            </div>
          </div>
        </div>

        {/* Gating & Relevance */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-panel)', padding: '16px', backgroundColor: 'var(--surface)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '12px' }}>Content Quality & Relevance</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Judge Select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Relevance Judge</label>
              <select
                value={judge}
                onChange={(e) => setJudge(e.target.value as any)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-cell)',
                  backgroundColor: 'var(--paper)',
                  minHeight: '44px',
                }}
              >
                <option value="none">none (Keep all fetched pages)</option>
                <option value="bm25">bm25 (Keyword-based token scoring)</option>
                <option value="llm">llm (Smart LLM judge verdict)</option>
              </select>
            </div>

            {/* LLM Model Config */}
            {judge === 'llm' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>LLM Model</label>
                <select
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-cell)',
                    backgroundColor: 'var(--paper)',
                    minHeight: '44px',
                  }}
                >
                  <option value="gpt-4o-mini">gpt-4o-mini (Default - Fast & Economical)</option>
                  <option value="gpt-4o">gpt-4o (High intelligence)</option>
                  <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                  <option value="claude-3-haiku">claude-3-haiku</option>
                </select>
              </div>
            )}

            {/* Threshold Range */}
            {judge !== 'none' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Relevance Threshold</label>
                  <span className="mono" style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{contentThreshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={contentThreshold}
                  onChange={(e) => setContentThreshold(Number(e.target.value))}
                  style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Policy Switches */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-panel)', padding: '16px', backgroundColor: 'var(--surface)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '12px' }}>Crawler Policy Switches</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={saturation} onChange={(e) => setSaturation(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} />
              <div>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, display: 'block' }}>Novelty Saturation Stop</span>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-muted)' }}>Halts crawl if content duplicates overlap</span>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={respectRobotsTxt} onChange={(e) => setRespectRobotsTxt(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} />
              <div>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, display: 'block' }}>Respect Robots.txt</span>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-muted)' }}>Obey robots exclusions (highly recommended)</span>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={collapseVersions} onChange={(e) => setCollapseVersions(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} />
              <div>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, display: 'block' }}>Collapse Documentation Versions</span>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-muted)' }}>Prevents crawling duplicate versioned paths</span>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={pinLocales} onChange={(e) => setPinLocales(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} />
              <div>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, display: 'block' }}>Pin Locales</span>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-muted)' }}>Rejects localized paths not in target locales</span>
              </div>
            </label>
          </div>
        </div>

        {/* LLM Cost Estimate Box */}
        {judge === 'llm' && (
          <div
            style={{
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-panel)',
              padding: '12px 16px',
              backgroundColor: 'var(--accent-weak)',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
            }}
          >
            <Sparkles size={18} color="var(--accent)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--accent)', marginBottom: '2px' }}>
                LLM Evaluation Cost Estimate
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', lineHeight: '1.4' }}>
                Selected model <strong className="mono">{llmModel}</strong> carries an estimated ceiling rate of{' '}
                <strong>${estimatedCost.toFixed(5)}</strong> for evaluating up to {maxPages} pages (~{totalEstimatedTokens.toLocaleString()} tokens).
              </p>
            </div>
          </div>
        )}

        {/* Submit */}
        <div style={{ marginTop: '8px' }}>
          <Button
            type="submit"
            variant="primary"
            disabled={mutation.isPending || !url}
            style={{ width: '100%', minHeight: '44px', fontSize: 'var(--text-base)' }}
          >
            {mutation.isPending ? 'Submitting Crawl…' : 'Start Crawl'}
          </Button>
          {mutation.isError && (
            <div style={{ display: 'flex', gap: '8px', color: 'var(--failed)', marginTop: '8px', fontSize: 'var(--text-sm)' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>Failed to submit crawl: {mutation.error.message}</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
