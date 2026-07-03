import React, { useState, useEffect } from 'react';
import type { PageOut } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { X, Copy, Download, Code, FileText, Check } from 'lucide-react';

const ReactMarkdown = React.lazy(() => import('react-markdown'));

interface PageViewerProps {
  page: PageOut;
  onClose: () => void;
}

export const PageViewer: React.FC<PageViewerProps> = ({ page, onClose }) => {
  const [viewMode, setViewMode] = useState<'markdown' | 'raw'>('markdown');
  const [copied, setCopied] = useState(false);
  const [sha, setSha] = useState('');

  // Calculate browser-native SHA-256 of the content for provenance display
  useEffect(() => {
    if (!page.markdown) {
      setSha('n/a');
      return;
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(page.markdown);
    
    if (window.crypto && window.crypto.subtle) {
      window.crypto.subtle.digest('SHA-256', data)
        .then(buffer => {
          const arr = Array.from(new Uint8Array(buffer));
          const hex = arr.map(b => b.toString(16).padStart(2, '0')).join('');
          setSha(hex.substring(0, 16)); // 16-char short SHA
        })
        .catch(() => {
          setSha('unknown-sha');
        });
    } else {
      setSha('sha-unavailable');
    }
  }, [page.markdown]);

  const handleCopy = () => {
    navigator.clipboard.writeText(page.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([page.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = page.url.split('/').filter(Boolean).pop() || 'page';
    a.download = `${filename}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFetchedAt = (ts?: number | null) => {
    if (!ts) return 'unknown';
    return new Date(ts * 1000).toLocaleString();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        maxWidth: '560px',
        backgroundColor: 'var(--surface)',
        borderLeft: '1px solid var(--line)',
        boxShadow: '-4px 0 16px oklch(0% 0 0 / 8%)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--line)', backgroundColor: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant={viewMode === 'markdown' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('markdown')}
            style={{ minHeight: '36px', padding: '0 12px' }}
          >
            <FileText size={14} />
            Rendered
          </Button>
          <Button
            variant={viewMode === 'raw' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('raw')}
            style={{ minHeight: '36px', padding: '0 12px' }}
          >
            <Code size={14} />
            Raw Markdown
          </Button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button onClick={handleCopy} style={{ minHeight: '36px', padding: '0 10px' }} title="Copy markdown content">
            {copied ? <Check size={14} color="var(--kept)" /> : <Copy size={14} />}
          </Button>
          <Button onClick={handleDownload} style={{ minHeight: '36px', padding: '0 10px' }} title="Download as .md file">
            <Download size={14} />
          </Button>
          <Button variant="ghost" onClick={onClose} style={{ minHeight: '36px', padding: '0 10px' }}>
            <X size={18} />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', lineBreak: 'anywhere' }}>
        {viewMode === 'markdown' ? (
          <div className="prose-content" style={{ fontSize: 'var(--text-base)', lineHeight: 1.6 }}>
            <React.Suspense fallback={<div className="skeleton" style={{ height: '300px', width: '100%' }} />}>
              <ReactMarkdown>{page.markdown}</ReactMarkdown>
            </React.Suspense>
          </div>
        ) : (
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink)',
              backgroundColor: 'var(--surface-2)',
              padding: '16px',
              borderRadius: 'var(--r-cell)',
              border: '1px solid var(--line)',
            }}
          >
            {page.markdown}
          </pre>
        )}
      </div>

      {/* Provenance Strip footer */}
      <div
        style={{
          borderTop: '1px solid var(--line)',
          backgroundColor: 'var(--surface-2)',
          padding: '12px 16px',
          fontSize: 'var(--text-caption)',
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          color: 'var(--ink-muted)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Actual Source URL:</span>
          <span style={{ color: 'var(--ink)', wordBreak: 'break-all', textAlign: 'right', maxWidth: '70%' }} className="mono">
            {page.url}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>License Hint:</span>
          <span style={{ color: 'var(--ink)' }}>{page.license_hint || 'unknown'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>SHA-256 Hash:</span>
          <span style={{ color: 'var(--ink)' }} className="mono">{sha}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Fetched At:</span>
          <span style={{ color: 'var(--ink)' }}>{formatFetchedAt(page.fetched_at)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Estimated Tokens:</span>
          <span style={{ color: 'var(--ink)' }} className="tabular-nums">{(page.token_estimate ?? 0).toLocaleString()}</span>
        </div>
      </div>

      {/* Simple Markdown Prose Styling */}
      <style>{`
        .prose-content h1 { font-size: 22px; margin-bottom: 12px; margin-top: 16px; border-bottom: 1px solid var(--line); padding-bottom: 4px; }
        .prose-content h2 { font-size: 18px; margin-bottom: 10px; margin-top: 14px; }
        .prose-content h3 { font-size: 16px; margin-bottom: 8px; margin-top: 12px; }
        .prose-content p { margin-bottom: 12px; }
        .prose-content ul, .prose-content ol { margin-left: 20px; margin-bottom: 12px; }
        .prose-content li { margin-bottom: 4px; }
        .prose-content code { background-color: var(--surface-2); padding: 2px 4px; border-radius: 3px; font-size: var(--text-sm); }
        .prose-content pre code { background: none; padding: 0; }
        .prose-content pre { background-color: var(--surface-2); padding: 12px; border-radius: var(--r-cell); border: 1px solid var(--line); overflow-x: auto; margin-bottom: 12px; }
        .prose-content blockquote { border-left: 3px solid var(--line); padding-left: 12px; color: var(--ink-muted); margin-bottom: 12px; }
      `}</style>
    </div>
  );
};
