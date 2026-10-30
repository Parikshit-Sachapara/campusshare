import React from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius,
  className = '',
}) => {
  return (
    <div
      className={`${styles.skeleton} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius,
      }}
    />
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className={styles.cardSkeleton}>
      <Skeleton width="40%" height={24} />
      <Skeleton width="90%" height={16} />
      <Skeleton width="75%" height={16} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Skeleton width={60} height={24} borderRadius="4px" />
        <Skeleton width={80} height={24} borderRadius="4px" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--oat-200)' }}>
        <Skeleton width={90} height={20} />
        <Skeleton width={70} height={32} borderRadius="8px" />
      </div>
    </div>
  );
};
