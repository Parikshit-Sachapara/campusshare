import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Tag, MapPin, Calendar, Clock, User } from 'lucide-react';
import { StatusStamp, BookingStatus } from './StatusStamp';
import styles from './BookingPass.module.css';

export interface BookingPassProps {
  bookingId: string;
  resourceTitle: string;
  category: string;
  borrowerName: string;
  borrowerRole?: string;
  department?: string;
  dateStr: string;
  timeSlot: string;
  location: string;
  status: BookingStatus | string;
  verificationCode?: string;
  onSelect?: () => void;
  className?: string;
}

export const BookingPass: React.FC<BookingPassProps> = ({
  bookingId,
  resourceTitle,
  category,
  borrowerName,
  borrowerRole = 'Student',
  department = 'Engineering',
  dateStr,
  timeSlot,
  location,
  status,
  verificationCode,
  onSelect,
  className = '',
}) => {
  const qrData = JSON.stringify({
    bid: bookingId,
    code: verificationCode || bookingId,
    res: resourceTitle,
    usr: borrowerName,
  });

  return (
    <div
      className={`${styles.passContainer} ${className}`}
      onClick={onSelect}
      style={onSelect ? { cursor: 'pointer' } : undefined}
    >
      {/* Main Boarding Pass Section */}
      <div className={styles.mainSection}>
        <div>
          <div className={styles.topRow}>
            <div>
              <span className={styles.categoryTag}>{category}</span>
              <h4 className={styles.resourceTitle}>{resourceTitle}</h4>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={styles.bookingCode}>
                <Tag size={12} />
                {bookingId}
              </span>
              <StatusStamp status={status} />
            </div>
          </div>
        </div>

        <div className={styles.detailsGrid}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>
              <User size={10} style={{ display: 'inline', marginRight: 3 }} />
              Borrower
            </span>
            <span className={styles.detailValue}>
              {borrowerName} <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>({borrowerRole})</span>
            </span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>
              <Calendar size={10} style={{ display: 'inline', marginRight: 3 }} />
              Reservation Date
            </span>
            <span className={styles.detailValue}>{dateStr}</span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>
              <Clock size={10} style={{ display: 'inline', marginRight: 3 }} />
              Window
            </span>
            <span className={styles.detailValue}>{timeSlot}</span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>
              <MapPin size={10} style={{ display: 'inline', marginRight: 3 }} />
              Desk / Station
            </span>
            <span className={styles.detailValue}>{location}</span>
          </div>
        </div>
      </div>

      {/* Perforated Divider with Circular Notches */}
      <div className={styles.dividerWrapper}>
        <div className={styles.notchTop} />
        <div className={styles.perforationLine} />
        <div className={styles.notchBottom} />
      </div>

      {/* Stub Section with QR Code */}
      <div className={styles.stubSection}>
        <span className={styles.stubLabel}>Handover Pass</span>
        <div className={styles.qrBox}>
          <QRCodeSVG
            value={qrData}
            size={74}
            bgColor="#FFFDF8"
            fgColor="#1D2B25"
            level="M"
          />
        </div>
        <span className={styles.stubToken}>{verificationCode || bookingId}</span>
        <span className={styles.stubLabel} style={{ fontSize: '9px' }}>
          Scan to verify
        </span>
      </div>
    </div>
  );
};
