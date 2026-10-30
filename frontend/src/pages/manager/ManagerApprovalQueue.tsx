import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Sliders,
  Send,
  Calendar,
  Layers,
} from 'lucide-react';
import { api } from '../../api/client';
import { Booking } from '../../api/types';
import {
  Button,
  Badge,
  Modal,
  Textarea,
  Input,
  PriorityScoreBreakdown,
  Skeleton,
  EmptyState,
  useToast,
} from '../../components/ui';

export const ManagerApprovalQueue: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // Action modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideScore, setOverrideScore] = useState(90);
  const [overrideReason, setOverrideReason] = useState('');

  const [altModalOpen, setAltModalOpen] = useState(false);
  const [altNotes, setAltNotes] = useState('');
  const [altStartTime, setAltStartTime] = useState('14:00');
  const [altEndTime, setAltEndTime] = useState('16:00');

  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);

  // 1. Fetch Manager Queue
  const { data: queueData, isLoading, refetch } = useQuery({
    queryKey: ['manager-approval-queue'],
    queryFn: () => api.getApprovalQueue(),
  });

  const bookings = queueData?.items || [];

  // Approve
  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveBooking(id),
    onSuccess: (b) => {
      addToast({
        title: 'Booking Approved!',
        message: `Reservation confirmed for ${b.student_name}. Pass #${b.booking_code}.`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['manager-approval-queue'] });
    },
  });

  // Reject
  const rejectMutation = useMutation({
    mutationFn: (data: { id: string; reason: string }) => api.rejectBooking(data.id, data.reason),
    onSuccess: () => {
      addToast({ title: 'Request Rejected', message: 'Student notified.', variant: 'neutral' });
      setRejectModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['manager-approval-queue'] });
    },
  });

  // Override Priority
  const overrideMutation = useMutation({
    mutationFn: (data: { id: string; score: number; reason: string }) =>
      api.overridePriority(data.id, data.score, data.reason),
    onSuccess: () => {
      addToast({ title: 'Priority Score Overridden', message: 'Score updated and logged in institutional audit trail.', variant: 'success' });
      setOverrideModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['manager-approval-queue'] });
    },
  });

  // Suggest Alternative
  const suggestAltMutation = useMutation({
    mutationFn: (data: { id: string; slots: { start_ts: string; end_ts: string }[]; notes?: string }) =>
      api.suggestAlternative(data.id, data.slots, data.notes),
    onSuccess: () => {
      addToast({ title: 'Alternative Slots Sent', message: 'Student has been notified and can 1-click accept.', variant: 'success' });
      setAltModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['manager-approval-queue'] });
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Badge variant="mulberry">FACILITY MANAGER WORKFLOW</Badge>
        </div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
          Institutional <span className="squiggle-word">Approval</span> Queue
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
          Priority-sorted decision desk with audited priority breakdown, keyword need scoring, and alternatives
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Skeleton height={220} borderRadius="var(--radius-card)" />
          <Skeleton height={220} borderRadius="var(--radius-card)" />
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          title="Approval Queue Cleared"
          description="There are no reservation requests currently awaiting administrative review."
          actionLabel="Refresh Queue"
          onAction={() => refetch()}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {bookings.map((b) => (
            <div
              key={b.id}
              style={{
                backgroundColor: 'var(--milk)',
                border: '1.5px solid var(--ink-border)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)',
              }}
            >
              {/* Header row: Student & Priority Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
                      {b.student_name || 'Student Applicant'}
                    </h3>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-mute)' }}>
                      ({b.student_email})
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 2 }}>
                    Resource: <strong>{b.resource_name}</strong> • Requested Slot:{' '}
                    {new Date(b.start_ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} –{' '}
                    {new Date(b.end_ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge variant="persimmon">
                    Priority Score: {b.priority_score?.toFixed(1) || '82.0'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActiveBooking(b);
                      setOverrideScore(Math.round(b.priority_score || 80));
                      setOverrideModalOpen(true);
                    }}
                    leftIcon={<Sliders size={14} />}
                  >
                    Override
                  </Button>
                </div>
              </div>

              {/* Purpose and project note */}
              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--oat-50)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--oat-200)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--ink)',
                }}
              >
                <strong>Academic Purpose:</strong> {b.purpose}
                {b.project_name && <span> &bull; Project: {b.project_name}</span>}
              </div>

              {/* Priority Score Breakdown Component */}
              <PriorityScoreBreakdown
                score={b.priority_score || 82}
                breakdown={b.priority_breakdown}
              />

              {/* Action buttons toolbar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  borderTop: '1px solid var(--oat-200)',
                  paddingTop: 'var(--space-3)',
                }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActiveBooking(b);
                    setAltModalOpen(true);
                  }}
                  leftIcon={<Calendar size={14} />}
                >
                  Suggest Alternative
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActiveBooking(b);
                    setRejectModalOpen(true);
                  }}
                  leftIcon={<XCircle size={14} />}
                  style={{ color: 'var(--cherry-600)' }}
                >
                  Reject
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(b.id)}
                  leftIcon={<CheckCircle2 size={16} />}
                  style={{ backgroundColor: 'var(--mulberry-500)', borderColor: 'var(--mulberry-600)' }}
                >
                  Approve Request
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      <Modal isOpen={rejectModalOpen} onClose={() => setRejectModalOpen(false)} title="Reject Request with Reason">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            A formal rejection reason is logged in the permanent audit trail and sent to the student.
          </p>
          <Textarea
            label="Rejection Reason (Mandatory)"
            placeholder="Explain why this request cannot proceed..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <Button variant="ghost" onClick={() => setRejectModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!rejectReason.trim()}
              loading={rejectMutation.isPending}
              onClick={() => activeBooking && rejectMutation.mutate({ id: activeBooking.id, reason: rejectReason })}
              style={{ backgroundColor: 'var(--cherry-500)' }}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Override Priority Modal */}
      <Modal isOpen={overrideModalOpen} onClose={() => setOverrideModalOpen(false)} title="Administrative Priority Override">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Override the deterministic score ($0 - 100$). A mandatory institutional justification is required and recorded in audit logs.
          </p>
          <Input
            label="New Priority Score"
            type="number"
            value={overrideScore}
            onChange={(e) => setOverrideScore(Number(e.target.value))}
          />
          <Textarea
            label="Mandatory Override Justification"
            placeholder="e.g. Dean approved expedited thesis project deadline..."
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <Button variant="ghost" onClick={() => setOverrideModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!overrideReason.trim()}
              loading={overrideMutation.isPending}
              onClick={() => activeBooking && overrideMutation.mutate({ id: activeBooking.id, score: overrideScore, reason: overrideReason })}
              style={{ backgroundColor: 'var(--mulberry-500)' }}
            >
              Confirm Override
            </Button>
          </div>
        </div>
      </Modal>

      {/* Suggest Alternative Modal */}
      <Modal isOpen={altModalOpen} onClose={() => setAltModalOpen(false)} title="Suggest Alternative Window">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Offer an alternate time when the facility or unit is free. The student can 1-click accept to confirm.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Input label="Start Time" type="time" value={altStartTime} onChange={(e) => setAltStartTime(e.target.value)} />
            <Input label="End Time" type="time" value={altEndTime} onChange={(e) => setAltEndTime(e.target.value)} />
          </div>
          <Textarea label="Notes for Student" placeholder="e.g. Morning is reserved for Lab maintenance, but afternoon is open." value={altNotes} onChange={(e) => setAltNotes(e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <Button variant="ghost" onClick={() => setAltModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={suggestAltMutation.isPending}
              onClick={() => {
                if (!activeBooking) return;
                const today = new Date().toISOString().split('T')[0];
                suggestAltMutation.mutate({
                  id: activeBooking.id,
                  slots: [{ start_ts: `${today}T${altStartTime}:00Z`, end_ts: `${today}T${altEndTime}:00Z` }],
                  notes: altNotes,
                });
              }}
              style={{ backgroundColor: 'var(--mulberry-500)' }}
            >
              Send Alternatives
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

