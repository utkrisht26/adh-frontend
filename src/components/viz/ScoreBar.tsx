import React from 'react';
import './ScoreBar.css';

interface ScoreBarProps {
  value: number; // 0 to 1
  threshold?: number;
  showText?: boolean;
}

export const ScoreBar: React.FC<ScoreBarProps> = ({
  value,
  threshold,
  showText = true,
}) => {
  const percent = Math.min(100, Math.max(0, value * 100));

  // If threshold is provided, compare. If not, default to pass (accent/kept color).
  const isPass = threshold !== undefined ? value >= threshold : true;
  const statusClass = isPass ? 'score-bar--pass' : 'score-bar--fail';

  return (
    <div className={`score-bar ${statusClass}`.trim()}>
      <div className="score-bar__track">
        <div className="score-bar__fill" style={{ width: `${percent}%` }} />
        {threshold !== undefined && (
          <div
            className="score-bar__threshold"
            style={{ left: `${threshold * 100}%` }}
            title={`Threshold: ${threshold}`}
          />
        )}
      </div>
      {showText && (
        <span className="score-bar__value mono">{value.toFixed(2)}</span>
      )}
    </div>
  );
};
