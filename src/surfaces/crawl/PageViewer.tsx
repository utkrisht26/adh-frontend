import React, { useState, useEffect } from 'react';
import type { PageOut } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { X, Copy, Download, Code, FileText, Check } from 'lucide-react';
import './PageViewer.css';

const ReactMarkdown = React.lazy(() => import('react-markdown'));

interface PageViewerProps {
  page: PageOut;
  onClose: () => void;
}

export const PageViewer: React.FC<PageViewerProps> = ({ page, onClose }) => {
  const [viewMode, setViewMode] = useState<'markdown' | 'raw'>('markdown');
  const [copied, setCopied] = useState(false);
  const [sha, setSha] = useState('');

  useEffect(() => {
    if (!page.markdown) {
      setSha('n/a');
      return;
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(page.markdown);

    if (window.crypto && window.crypto.subtle) {
      window.crypto.subtle
        .digest('SHA-256', data)
        .then((buffer) => {
          const arr = Array.from(new Uint8Array(buffer));
          const hex = arr.map((b) => b.toString(16).padStart(2, '0')).join('');
          setSha(hex.substring(0, 16));
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
    <div className="page-viewer">
      <div className="page-viewer__header">
        <div className="page-viewer__tabs">
          <Button variant={viewMode === 'markdown' ? 'primary' : 'secondary'} onClick={() => setViewMode('markdown')} style={{ minHeight: '36px', padding: '0 12px' }}>
            <FileText size={14} />
            Rendered
          </Button>
          <Button variant={viewMode === 'raw' ? 'primary' : 'secondary'} onClick={() => setViewMode('raw')} style={{ minHeight: '36px', padding: '0 12px' }}>
            <Code size={14} />
            Raw Markdown
          </Button>
        </div>
        <div className="page-viewer__tools">
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

      <div className="page-viewer__body">
        {viewMode === 'markdown' ? (
          <div className="page-viewer__md prose-content">
            <React.Suspense fallback={<div className="skeleton" style={{ height: '300px', width: '100%' }} />}>
              <ReactMarkdown>{page.markdown}</ReactMarkdown>
            </React.Suspense>
          </div>
        ) : (
          <pre className="page-viewer__raw">{page.markdown}</pre>
        )}
      </div>

      <div className="provenance">
        <div className="provenance__row">
          <span>Actual Source URL:</span>
          <span className="provenance__val provenance__val--url mono">{page.url}</span>
        </div>
        <div className="provenance__row">
          <span>License Hint:</span>
          <span className="provenance__val">{page.license_hint || 'unknown'}</span>
        </div>
        <div className="provenance__row">
          <span>SHA-256 Hash:</span>
          <span className="provenance__val mono">{sha}</span>
        </div>
        <div className="provenance__row">
          <span>Fetched At:</span>
          <span className="provenance__val">{formatFetchedAt(page.fetched_at)}</span>
        </div>
        <div className="provenance__row">
          <span>Estimated Tokens:</span>
          <span className="provenance__val tabular-nums">{(page.token_estimate ?? 0).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
