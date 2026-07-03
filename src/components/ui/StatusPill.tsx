import React from 'react';
import { Play, CheckCircle2, AlertTriangle, Ban, HelpCircle, Inbox, EyeOff, ShieldAlert, Award } from 'lucide-react';

export type StatusType = 'queued' | 'running' | 'succeeded' | 'kept' | 'failed' | 'cancelled' | 'dropped' | 'pruned' | 'saturated';

interface StatusPillProps {
  status: StatusType;
  className?: string;
  style?: React.CSSProperties;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, className = '', style }) => {
  let label = status;
  let bg = '';
  let text = '';
  let Icon = HelpCircle;

  switch (status) {
    case 'queued':
      label = 'queued';
      bg = 'var(--surface-2)';
      text = 'var(--ink-muted)';
      Icon = Inbox;
      break;
    case 'running':
      label = 'running';
      bg = 'var(--accent-weak)';
      text = 'var(--accent)';
      Icon = Play;
      break;
    case 'succeeded':
    case 'kept':
      label = status === 'succeeded' ? 'succeeded' : 'kept';
      bg = 'var(--kept-weak)';
      text = 'var(--kept)';
      Icon = CheckCircle2;
      break;
    case 'failed':
      label = 'failed';
      bg = 'var(--failed-weak)';
      text = 'var(--failed)';
      Icon = ShieldAlert;
      break;
    case 'cancelled':
      label = 'cancelled';
      bg = 'var(--surface-2)';
      text = 'var(--ink-muted)';
      Icon = Ban;
      break;
    case 'dropped':
      label = 'dropped';
      bg = 'var(--dropped-weak)';
      text = 'var(--dropped)';
      Icon = EyeOff;
      break;
    case 'pruned':
      label = 'pruned';
      bg = 'var(--pruned-weak)';
      text = 'var(--pruned)';
      Icon = AlertTriangle;
      break;
    case 'saturated':
      label = 'saturated';
      bg = 'var(--saturated-weak)';
      text = 'var(--saturated)';
      Icon = Award;
      break;
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: bg,
        color: text,
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        fontSize: 'var(--text-caption)',
        fontWeight: 500,
        fontFamily: 'var(--font-sans)',
        border: '1px solid var(--line)',
        textTransform: 'lowercase',
        ...style,
      }}
      className={`${status === 'running' ? 'pulse' : ''} ${className}`}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
};
