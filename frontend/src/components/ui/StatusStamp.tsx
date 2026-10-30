import React from 'react';
import { AlertCircle } from 'lucide-react';
import styles from './StatusStamp.module.css';

export type BookingStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'WAITLISTED'
  | 'CHECKED_OUT'
  | 'RETURN_PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'OVERDUE'
  | 'INCIDENT_REPORTED';

export interface StatusStampProps {
  status: BookingStatus | string;
  animate?: boolean;
  className?: string;
}

export const StatusStamp: React.FC<StatusStampProps> = ({
  status,
  animate = true,
  className = '',
}) => {
  const norm = (status || '').toUpperCase().trim();

  let styleKey = 'pending';
  let label = norm.replace('_', ' ');

  switch (norm) {
    case 'PENDING':
      styleKey = 'pending';
      label = 'PENDING';
      break;
    case 'APPROVED':
      styleKey = 'approved';
      label = 'APPROVED';
      break;
    case 'REJECTED':
      styleKey = 'rejected';
      label = 'REJECTED';
      break;
    case 'WAITLISTED':
      styleKey = 'waitlisted';
      label = 'WAITLISTED';
      break;
    case 'CHECKED_OUT':
      styleKey = 'checkedOut';
      label = 'CHECKED OUT';
      break;
    case 'RETURN_PENDING':
      styleKey = 'returnPending';
      label = 'RETURN PENDING';
      break;
    case 'COMPLETED':
      styleKey = 'completed';
      label = 'COMPLETED';
      break;
    case 'CANCELLED':
      styleKey = 'cancelled';
      label = 'CANCELLED';
      break;
    case 'OVERDUE':
      styleKey = 'overdue';
      label = 'OVERDUE';
      break;
    case 'INCIDENT_REPORTED':
      styleKey = 'incidentReported';
      label = 'INCIDENT REPORTED';
      break;
    default:
      styleKey = 'pending';
      label = norm || 'STATUS';
  }

  const isIncident = norm === 'INCIDENT_REPORTED';

  return (
    <span
      className={`
        ${styles.stamp} 
        ${styles[styleKey] || styles.pending} 
        ${animate ? styles.animateThud : ''} 
        ${className}
      `}
      title={`Status: ${label}`}
    >
      {isIncident && <AlertCircle size={12} strokeWidth={2.5} />}
      {label}
    </span>
  );
};
