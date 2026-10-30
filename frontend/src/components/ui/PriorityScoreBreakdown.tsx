import React from 'react';
import styles from './PriorityScoreBreakdown.module.css';

export interface PriorityScoreBreakdownProps {
  need?: number;             // Academic Need (N) - Persimmon
  disadvantage?: number;     // Under-resourced factor (D) - Apricot
  efficiency?: number;       // Group size / utilization efficiency (E) - Fern
  accountability?: number;   // Prior return history & reliability (A) - Mulberry
  score?: number;
  breakdown?: {
    N?: { value: number; weighted: number; reason: string };
    D?: { value: number; weighted: number; reason: string };
    E?: { value: number; weighted: number; reason: string };
    A?: { value: number; weighted: number; reason: string };
  };
  maxScore?: number;
  showTitle?: boolean;
}

export const PriorityScoreBreakdown: React.FC<PriorityScoreBreakdownProps> = ({
  need: needProp,
  disadvantage: disProp,
  efficiency: effProp,
  accountability: accProp,
  score,
  breakdown,
  maxScore = 100,
  showTitle = true,
}) => {
  const need = breakdown?.N?.weighted ?? needProp ?? 35;
  const disadvantage = breakdown?.D?.weighted ?? disProp ?? 25;
  const efficiency = breakdown?.E?.weighted ?? effProp ?? 15;
  const accountability = breakdown?.A?.weighted ?? accProp ?? 10;

  const total = score ?? Math.min(maxScore, need + disadvantage + efficiency + accountability);

  const pctNeed = (need / maxScore) * 100;
  const pctDisadvantage = (disadvantage / maxScore) * 100;
  const pctEfficiency = (efficiency / maxScore) * 100;
  const pctAccountability = (accountability / maxScore) * 100;

  return (
    <div className={styles.container}>
      {showTitle && (
        <div className={styles.topRow}>
          <span className={styles.title}>Priority Score (Fair By Design)</span>
          <span className={styles.totalScore}>{total.toFixed(1)} / {maxScore}</span>
        </div>
      )}

      <div className={styles.stackedBar}>
        <div
          className={`${styles.segment} ${styles.segmentNeed}`}
          style={{ width: `${pctNeed}%` }}
          title={`Recent Non-Usage (N): ${need.toFixed(1)}`}
        />
        <div
          className={`${styles.segment} ${styles.segmentDisadvantage}`}
          style={{ width: `${pctDisadvantage}%` }}
          title={`Need / Keyword Match (D): ${disadvantage.toFixed(1)}`}
        />
        <div
          className={`${styles.segment} ${styles.segmentEfficiency}`}
          style={{ width: `${pctEfficiency}%` }}
          title={`Completed Eligibility (E): ${efficiency.toFixed(1)}`}
        />
        <div
          className={`${styles.segment} ${styles.segmentAccountability}`}
          style={{ width: `${pctAccountability}%` }}
          title={`Queue Wait Time (A): ${accountability.toFixed(1)}`}
        />
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.dotNeed}`} />
          <span>Non-Usage: {need.toFixed(0)}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.dotDisadvantage}`} />
          <span>Need Match: {disadvantage.toFixed(0)}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.dotEfficiency}`} />
          <span>Eligibility: {efficiency.toFixed(0)}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.dotAccountability}`} />
          <span>Wait Time: {accountability.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
};
