import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export function LoadingState({ label = 'Loading workspace…' }: { label?: string }) {
  return <div className="loading-state" role="status" aria-label={label}>
    <span className="text-muted">{label}</span>
    {[0, 1, 2, 3].map(i => <div className="skeleton loading-state__row" key={i} />)}
  </div>;
}

export function ErrorState({ title, error, retry }: { title: string; error: unknown; retry?: () => void }) {
  return <div className="callout-error" role="alert">
    <AlertCircle size={18} aria-hidden="true" />
    <div className="error-state__content"><h2 className="callout-error__title">{title}</h2>
      <p className="callout-error__body">{error instanceof Error ? error.message : 'Please try again.'}</p>
      {retry && <Button onClick={retry}><RefreshCw size={14} />Try again</Button>}
    </div>
  </div>;
}
