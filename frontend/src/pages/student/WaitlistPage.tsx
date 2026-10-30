import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../api/client';
import { WaitlistEntry } from '../../api/types';
import {
  Button,
  Badge,
  Skeleton,
  EmptyState,
  ConfirmModal,
  useToast,
} from '../../components/ui';

export const WaitlistPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [cancelTargetId, setCancelTargetId] = React.useState<string | null>(null);

  // 1. Fetch Student Waitlists
  const { data: waitlists, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-waitlist'],
    queryFn: () => api.listMyWaitlist(),
  });

  // 2. Accept offer mutation
  const acceptOfferMutation = useMutation({
    mutationFn: (id: string) => api.acceptWaitlistOffer(id),
    onSuccess: (booking) => {
      addToast({
        title: 'Offer Accepted! Booking Created',
        message: `Your reservation pass #${booking.booking_code} is confirmed.`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['my-waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Failed to Accept Offer',
        message: (err as Error).message || 'Offer may have expired.',
        variant: 'danger',
      });
    },
  });

  // 3. Cancel waitlist mutation
  const cancelWaitlistMutation = useMutation({
    mutationFn: (id: string) => api.cancelWaitlist(id),
    onSuccess: () => {
      addToast({
        title: 'Left Waiting List',
        message: 'Your queue spot has been released.',
        variant: 'neutral',
      });
      setCancelTargetId(null);
      queryClient.invalidateQueries({ queryKey: ['my-waitlist'] });
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
          Waiting List <span className="squiggle-word">Queues</span>
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
          Automated slot redistribution. When another student cancels, slots are automatically offered by priority score.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Skeleton height={100} borderRadius="var(--radius-card)" />
          <Skeleton height={100} borderRadius="var(--radius-card)" />
        </div>
      ) : isError ? (
        <EmptyState
          title="Could Not Load Queues"
          description="Failed to communicate with campus scheduling engine."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : (waitlists && waitlists.length > 0) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {waitlists.map((entry) => {
            const isOffered = entry.status === 'OFFERED';
            return (
              <div
                key={entry.id}
                style={{
                  backgroundColor: 'var(--milk)',
                  border: isOffered ? '2px solid var(--fern-500)' : '1.5px solid var(--ink-border)',
                  borderRadius: 'var(--radius-card)',
                  padding: 'var(--space-5)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--space-4)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--ink)' }}>
                      {entry.resource_name || 'Requested Resource'}
                    </span>
                    <Badge variant={isOffered ? 'fern' : 'apricot'}>
                      {isOffered ? 'OFFER AVAILABLE' : `POSITION #${entry.position || 1}`}
                    </Badge>
                  </div>

                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 4 }}>
                    Desired Window: {new Date(entry.desired_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} –{' '}
                    {new Date(entry.desired_end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} • Priority Score: {entry.priority_score.toFixed(1)}
                  </div>

                  {isOffered && entry.offer_expires_at && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fern-600)', marginTop: 4, fontWeight: 600 }}>
                      Offer expires: {new Date(entry.offer_expires_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {isOffered && (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={acceptOfferMutation.isPending}
                      onClick={() => acceptOfferMutation.mutate(entry.id)}
                      leftIcon={<CheckCircle2 size={16} />}
                    >
                      Accept Offer & Book Slot
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCancelTargetId(entry.id)}
                    style={{ color: 'var(--cherry-600)' }}
                  >
                    Leave Queue
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No Active Waitlists"
          description="You are not waiting for any booked resources. Browse the marketplace to reserve available slots directly."
          actionLabel="Browse Marketplace"
          onAction={() => {}}
        />
      )}

      {/* Cancel Waitlist Confirmation */}
      <ConfirmModal
        isOpen={Boolean(cancelTargetId)}
        title="Leave Waiting List Queue?"
        message="If you leave this queue, your position will be given to the next eligible student."
        confirmLabel="Leave Queue"
        cancelLabel="Stay in Queue"
        isDestructive={true}
        isLoading={cancelWaitlistMutation.isPending}
        onConfirm={() => cancelTargetId && cancelWaitlistMutation.mutate(cancelTargetId)}
        onCancel={() => setCancelTargetId(null)}
      />
    </div>
  );
};

