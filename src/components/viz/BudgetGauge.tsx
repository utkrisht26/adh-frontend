import React from 'react';
import './BudgetGauge.css';

interface BudgetGaugeProps {
  label: string;
  value: number;
  limit: number;
  formatValue?: (val: number) => string;
}

export const BudgetGauge: React.FC<BudgetGaugeProps> = ({
  label,
  value,
  limit,
  formatValue = (val) => val.toLocaleString(),
}) => {
  const percent = limit > 0 ? Math.min(100, (value / limit) * 100) : 0;
  const isOver = value >= limit;

  return (
    <div className={`budget-gauge ${isOver ? 'budget-gauge--over' : ''}`.trim()}>
      <div className="budget-gauge__head">
        <span className="budget-gauge__label">{label}</span>
        <span className="budget-gauge__values mono">
          {formatValue(value)} <span className="budget-gauge__sep">/</span> {formatValue(limit)}
        </span>
      </div>
      <div className="budget-gauge__track">
        <div
          className="budget-gauge__fill"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
