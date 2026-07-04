import React from 'react';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Inbox,
  EyeOff,
  ShieldAlert,
  Award,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './StatusPill.css';

export type StatusType =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'kept'
  | 'failed'
  | 'cancelled'
  | 'dropped'
  | 'pruned'
  | 'saturated';

interface StatusPillProps {
  status: StatusType;
  className?: string;
  style?: React.CSSProperties;
}

const CONFIG: Record<StatusType, { modifier: string; Icon: LucideIcon; label: string }> = {
  queued: { modifier: 'muted', Icon: Inbox, label: 'queued' },
  running: { modifier: 'running', Icon: Play, label: 'running' },
  succeeded: { modifier: 'kept', Icon: CheckCircle2, label: 'succeeded' },
  kept: { modifier: 'kept', Icon: CheckCircle2, label: 'kept' },
  failed: { modifier: 'failed', Icon: ShieldAlert, label: 'failed' },
  cancelled: { modifier: 'muted', Icon: Ban, label: 'cancelled' },
  dropped: { modifier: 'dropped', Icon: EyeOff, label: 'dropped' },
  pruned: { modifier: 'pruned', Icon: AlertTriangle, label: 'pruned' },
  saturated: { modifier: 'saturated', Icon: Award, label: 'saturated' },
};

export const StatusPill: React.FC<StatusPillProps> = ({ status, className = '', style }) => {
  const { modifier, Icon, label } = CONFIG[status];
  const pulse = status === 'running' ? 'pulse' : '';
  return (
    <div className={`status-pill status-pill--${modifier} ${pulse} ${className}`.trim()} style={style}>
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
};
