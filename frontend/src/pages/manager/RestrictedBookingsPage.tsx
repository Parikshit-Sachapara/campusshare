import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { api } from '../../api/client';
import { Badge, Skeleton, EmptyState } from '../../components/ui';

export const RestrictedBookingsPage: React.FC = () => {
  const { data: queueData, isLoading } = useQuery({
    queryKey: ['restricted-bookings'],
    queryFn: () => api.getApprovalQueue(),
  });

  const restricted = (queueData?.items || []).filter((b) => b.priority_score > 80);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
          Restricted Resource <span className="squiggle-word">Bookings</span>
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
          High-value assets and restricted facilities requiring explicit managerial authorization
        </p>
      </div>

      {isLoading ? (
        <Skeleton height={120} borderRadius="var(--radius-card)" />
      ) : restricted.length === 0 ? (
        <EmptyState
          title="No Restricted Bookings Pending"
          description="There are currently no restricted resource reservations requiring managerial clearance."
          actionLabel="View All Queues"
          onAction={() => {}}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {restricted.map((b) => (
            <div
              key={b.id}
              style={{
                backgroundColor: 'var(--milk)',
                border: '1.5px solid var(--ink-border)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-4) var(--space-5)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-base)', display: 'block' }}>
                  {b.resource_name}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)' }}>
                  Student: {b.student_name} • Purpose: {b.purpose}
                </span>
              </div>
              <Badge variant="apricot">RESTRICTED CLEARANCE REQUIRED</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

