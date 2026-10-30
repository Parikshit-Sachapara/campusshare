import React from 'react';
import styles from './Timeline.module.css';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description?: string;
  actor?: string;
  status?: string;
  variant?: 'fern' | 'persimmon' | 'mulberry' | 'cherry';
}

export interface TimelineProps {
  events?: TimelineEvent[];
  items?: TimelineEvent[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ events, items, className = '' }) => {
  const list = events || items || [];
  return (
    <div className={`${styles.container} ${className}`}>
      {list.map((ev) => {
        let nodeClass = '';
        if (ev.variant === 'persimmon') nodeClass = styles.nodePersimmon;
        if (ev.variant === 'mulberry') nodeClass = styles.nodeMulberry;
        if (ev.variant === 'cherry') nodeClass = styles.nodeCherry;

        return (
          <div key={ev.id} className={styles.item}>
            <div className={`${styles.node} ${nodeClass}`} />
            <span className={styles.time}>{ev.timestamp}</span>
            <div className={styles.title}>{ev.title}</div>
            {ev.description && <div className={styles.description}>{ev.description}</div>}
            {ev.actor && <span className={styles.actorTag}>By: {ev.actor}</span>}
          </div>
        );
      })}
    </div>
  );
};
