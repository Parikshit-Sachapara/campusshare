import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import styles from './StatCard.module.css';

export interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  trend?: 'up' | 'down' | 'neutral';
  sparklineData?: number[];
  note?: string;
  icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  delta,
  trend = 'neutral',
  sparklineData = [10, 15, 12, 19, 24, 21, 30],
  note,
  icon,
}) => {
  // Render clean SVG sparkline
  const minVal = Math.min(...sparklineData);
  const maxVal = Math.max(...sparklineData);
  const range = maxVal - minVal || 1;
  const width = 80;
  const height = 30;

  const points = sparklineData
    .map((val, idx) => {
      const x = (idx / (sparklineData.length - 1)) * width;
      const y = height - ((val - minVal) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');

  const strokeColor =
    trend === 'up'
      ? 'var(--fern-500)'
      : trend === 'down'
      ? 'var(--cherry-500)'
      : 'var(--persimmon-500)';

  return (
    <div className={styles.statCard}>
      <div className={styles.headerRow}>
        <span className={styles.label}>{label}</span>
        {icon ? (
          <span style={{ color: 'var(--ink-mute)' }}>{icon}</span>
        ) : delta ? (
          <span
            className={`
              ${styles.badge} 
              ${trend === 'up' ? styles.positive : trend === 'down' ? styles.negative : styles.neutral}
            `}
          >
            {trend === 'up' && <TrendingUp size={11} />}
            {trend === 'down' && <TrendingDown size={11} />}
            {trend === 'neutral' && <Minus size={11} />}
            {delta}
          </span>
        ) : null}
      </div>

      <div className={styles.bodyRow}>
        <div className={styles.numberValue}>{value}</div>

        <div className={styles.sparklineWrap}>
          <svg className={styles.sparklineSvg} viewBox={`0 0 ${width} ${height}`}>
            <polyline
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </svg>
        </div>
      </div>

      {note && <div className={styles.note}>{note}</div>}
    </div>
  );
};
