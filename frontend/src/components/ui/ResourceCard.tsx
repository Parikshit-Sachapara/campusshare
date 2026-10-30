import React from 'react';
import { MapPin, ShieldCheck, Clock, CheckCircle2 } from 'lucide-react';
import { CategoryIcon, ResourceCategory } from './CategoryIcons';
import { Button } from './Button';
import styles from './ResourceCard.module.css';

export interface ResourceCardProps {
  id: string;
  title: string;
  category: ResourceCategory | string;
  department: string;
  location: string;
  availableQty: number;
  totalQty: number;
  requiresTraining?: boolean;
  requiresApproval?: boolean;
  trainingName?: string;
  maxDurationHours?: number;
  description?: string;
  imageUrl?: string;
  onRequest?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  onSelect?: (id: string) => void;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({
  id,
  title,
  category,
  department,
  location,
  availableQty,
  totalQty,
  requiresTraining = false,
  requiresApproval = false,
  trainingName,
  maxDurationHours,
  description,
  imageUrl,
  onRequest,
  onViewDetails,
  onSelect,
}) => {
  const isAvailable = availableQty > 0;
  const safeCategory = (typeof category === 'string' ? category : 'Computing') as ResourceCategory;
  const tabClass = `tab${safeCategory.replace(/[^a-zA-Z]/g, '')}`;

  const handleCardClick = () => {
    if (onSelect) onSelect(id);
    else if (onViewDetails) onViewDetails(id);
  };

  return (
    <div className={styles.card} onClick={handleCardClick} style={{ cursor: onSelect || onViewDetails ? 'pointer' : 'default' }}>
      {/* Top Left Colored Category Tab */}
      <div className={`${styles.categoryTab} ${styles[tabClass] || styles.tabClassrooms}`}>
        <CategoryIcon category={safeCategory} size={15} />
        <span>{safeCategory}</span>
      </div>

      <div className={styles.topRightStatus}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid',
            backgroundColor: isAvailable ? 'var(--fern-100)' : 'var(--cherry-100)',
            color: isAvailable ? 'var(--fern-600)' : 'var(--cherry-600)',
            borderColor: isAvailable ? 'var(--fern-500)' : 'var(--cherry-500)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: isAvailable ? 'var(--fern-500)' : 'var(--cherry-500)',
            }}
          />
          {isAvailable ? `${availableQty}/${totalQty} AVAILABLE` : 'FULLY BOOKED'}
        </span>
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>

        <div className={styles.metaRow}>
          <span className={styles.metaItem}>
            <MapPin size={13} />
            {location}
          </span>
          <span className={styles.metaDot}>•</span>
          <span className={styles.metaItem}>{department}</span>
        </div>

        {description && <p className={styles.description}>{description}</p>}

        <div className={styles.tagsWrap}>
          {requiresTraining && (
            <span className={styles.trainingTag}>
              <ShieldCheck size={12} />
              {trainingName || 'Training Required'}
            </span>
          )}
          {requiresApproval && (
            <span className={styles.trainingTag} style={{ backgroundColor: 'var(--apricot-100)', color: 'var(--apricot-600)', borderColor: 'var(--apricot-500)' }}>
              Approval Required
            </span>
          )}
          {maxDurationHours && (
            <span className={styles.durationTag}>
              <Clock size={12} />
              Max {maxDurationHours}h
            </span>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.availText}>
          {isAvailable ? 'Instant booking available' : 'Waiting list active'}
        </span>
        <Button
          variant={isAvailable ? 'primary' : 'secondary'}
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            if (onSelect) onSelect(id);
            else if (onRequest) onRequest(id);
            else if (onViewDetails) onViewDetails(id);
          }}
        >
          {isAvailable ? 'Reserve Slot' : 'Join Waitlist'}
        </Button>
      </div>
    </div>
  );
};
