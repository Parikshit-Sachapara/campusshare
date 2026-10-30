import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../api/client';
import { Booking } from '../../api/types';
import {
  Button,
  Badge,
  Modal,
  Textarea,
  Skeleton,
  EmptyState,
  useToast,
} from '../../components/ui';

export const OwnerRequestsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // 1. Fetch requests awaiting decision
  const { data: queueData, isLoading, refetch } = useQuery({
    queryKey: ['owner-approval-queue'],
    queryFn: () => api.getApprovalQueue(),
  });

  const requests = queueData?.items || [];

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveBooking(id),
    onSuccess: (booking) => {
      addToast({
        title: 'Booking Approved!',
        message: `Pass code #${booking.booking_code} issued to ${booking.student_name}.`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['owner-approval-queue'] });
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Approval Failed',
        message: (err as Error).message,
        variant: 'danger',
      });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (data: { id: string; reason: string }) => api.rejectBooking(data.id, data.reason),
    onSuccess: () => {
      addToast({
        title: 'Request Rejected',
        message: 'Student has been notified with the provided reason.',
        variant: 'neutral',
      });
      setRejectTargetId(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['owner-approval-queue'] });
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
          Reservation <span className="squiggle-word">Requests</span>
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
          Review booking requests for your lab equipment and rooms, sorted by priority score
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Skeleton height={100} borderRadius="var(--radius-card)" />
          <Skeleton height={100} borderRadius="var(--radius-card)" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          title="Approval Queue Clear"
          description="You don't have any pending reservation requests awaiting decision."
          actionLabel="Refresh"
          onAction={() => refetch()}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {requests.map((b) => (
            <div
              key={b.id}
              style={{
                backgroundColor: 'var(--milk)',
                border: '1.5px solid var(--ink-border)',
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
                    {b.student_name || 'Student'} &bull; {b.resource_name}
                  </span>
                  <Badge variant="persimmon">Priority {b.priority_score?.toFixed(1) || '80.0'}</Badge>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 4 }}>
                  Slot: {new Date(b.start_ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} –{' '}
                  {new Date(b.end_ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} • Purpose: {b.purpose}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Button
                  variant="primary"
                  size="sm"
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(b.id)}
                  leftIcon={<CheckCircle2 size={16} />}
                  style={{ backgroundColor: 'var(--fern-500)', borderColor: 'var(--fern-600)' }}
                >
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRejectTargetId(b.id)}
                  leftIcon={<XCircle size={16} />}
                  style={{ color: 'var(--cherry-600)' }}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      <Modal
        isOpen={Boolean(rejectTargetId)}
        onClose={() => setRejectTargetId(null)}
        title="Reject Reservation Request"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Provide a clear, polite explanation for the student detailing why this reservation cannot be fulfilled.
          </p>

          <Textarea
            label="Rejection Reason (Mandatory)"
            placeholder="e.g. Laser calibration scheduled during this window, please book the 15:00 slot instead..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <Button variant="ghost" onClick={() => setRejectTargetId(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!rejectReason.trim()}
              loading={rejectMutation.isPending}
              onClick={() => rejectTargetId && rejectMutation.mutate({ id: rejectTargetId, reason: rejectReason })}
              style={{ backgroundColor: 'var(--cherry-500)', borderColor: 'var(--cherry-600)' }}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

