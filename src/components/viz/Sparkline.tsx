import React from 'react';
import './Sparkline.css';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 120,
  height = 30,
}) => {
  if (!data || data.length === 0) {
    return <span className="sparkline-empty text-muted">—</span>;
  }

  const maxX = data.length - 1;

  // Set min/max Y. If all values are the same, display centered.
  const rawMinY = Math.min(...data);
  const rawMaxY = Math.max(...data);
  const minY = Math.min(0, rawMinY); // Baseline at 0
  const maxY = Math.max(1, rawMaxY); // Max value, at least 1

  const coords = data.map((val, idx) => {
    const x = maxX > 0 ? (idx / maxX) * width : 0;
    const yRange = maxY - minY;
    const y = height - (yRange > 0 ? ((val - minY) / yRange) * height : height / 2);
    return { x, y };
  });

  const pathD = coords.reduce(
    (acc, point, idx) => (idx === 0 ? `M ${point.x} ${point.y}` : `${acc} L ${point.x} ${point.y}`),
    ''
  );

  return (
    <div className="sparkline" style={{ width, height }}>
      <svg width={width} height={height} className="sparkline__svg">
        <path d={pathD} className="sparkline__path" />
        {coords.length > 0 && (
          <circle
            cx={coords[coords.length - 1].x}
            cy={coords[coords.length - 1].y}
            r={2.5}
            className="sparkline__dot"
          />
        )}
      </svg>
    </div>
  );
};
