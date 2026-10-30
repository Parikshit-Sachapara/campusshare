import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  List,
  Clock,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  FileText,
  Camera,
  Trash2,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Booking, BookingStatus, TimelineItem } from '../../api/types';
import {
  Button,
  Tabs,
  Badge,
  Drawer,
  BookingPass,
  Timeline,
  ConfirmModal,
  Modal,
  Input,
  Textarea,
  Skeleton,
  EmptyState,
  useToast,
} from '../../components/ui';

export const MyBookingsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Drawer & Action states
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Cancellation Confirm Dialog
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Return Submission Modal
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnPhotoUrl, setReturnPhotoUrl] = useState('');

  // 1. Fetch Student Bookings
  const { data: bookingsData, isLoading, refetch } = useQuery({
    queryKey: ['my-bookings', activeTab],
    queryFn: () =>
      api.getMyBookings({
        status: activeTab !== 'ALL' ? activeTab : undefined,
        size: 50,
      }),
  });

  // 2. Fetch Timeline for currently open booking in drawer
  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ['booking-timeline', selectedBooking?.id],
    queryFn: () => api.getBookingTimeline(selectedBooking!.id),
    enabled: Boolean(selectedBooking?.id && drawerOpen),
  });

  // Cancel booking mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelBooking(id, cancelReason),
    onSuccess: () => {
      addToast({
        title: 'Booking Cancelled',
        message: 'Slot has been released and waiting list notified.',
        variant: 'neutral',
      });
      setCancelModalOpen(false);
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Cancellation Failed',
        message: (err as Error).message || 'Could not cancel booking.',
        variant: 'danger',
      });
    },
  });

  // Confirm pickup mutation
  const confirmPickupMutation = useMutation({
    mutationFn: (id: string) => api.confirmPickup(id),
    onSuccess: () => {
      addToast({
        title: 'Pickup Confirmed!',
        message: 'Your equipment handover has been digitally verified.',
        variant: 'success',
      });
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Pickup Confirmation Failed',
        message: (err as Error).message,
        variant: 'danger',
      });
    },
  });

  // Submit return mutation
  const returnMutation = useMutation({
    mutationFn: (data: { id: string; notes?: string; photo_urls?: string[] }) =>
      api.submitReturn(data.id, { notes: data.notes, photo_urls: data.photo_urls }),
    onSuccess: () => {
      addToast({
        title: 'Return Submitted for Inspection',
        message: 'Staff will inspect item condition and complete booking.',
        variant: 'success',
      });
      setReturnModalOpen(false);
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Return Submission Failed',
        message: (err as Error).message,
        variant: 'danger',
      });
    },
  });

  // Accept alternative mutation
  const acceptAltMutation = useMutation({
    mutationFn: (id: string) => api.acceptAlternative(id),
    onSuccess: () => {
      addToast({
        title: 'Alternative Slot Accepted!',
        message: 'Booking rescheduled successfully.',
        variant: 'success',
      });
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
  });

  const bookings = bookingsData?.items || [];

  const handleOpenDrawer = (booking: Booking) => {
    setSelectedBooking(booking);
    setDrawerOpen(true);
  };

  const getStatusBadgeVariant = (status: BookingStatus) => {
    switch (status) {
      case 'APPROVED':
      case 'COMPLETED':
        return 'fern';
      case 'CHECKED_OUT':
        return 'persimmon';
      case 'PENDING':
      case 'RETURN_PENDING':
        return 'apricot';
      case 'REJECTED':
      case 'CANCELLED':
      case 'OVERDUE':
      case 'INCIDENT_REPORTED':
        return 'cherry';
      default:
        return 'oat';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header and View Mode Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
            My Passes & <span className="squiggle-word">Bookings</span>
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Track active reservations, digital QR boarding passes, and return physical items
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: viewMode === 'list' ? '1.5px solid var(--persimmon-500)' : '1px solid var(--oat-200)',
              backgroundColor: viewMode === 'list' ? 'var(--persimmon-100)' : 'var(--milk)',
              color: viewMode === 'list' ? 'var(--persimmon-600)' : 'var(--ink-soft)',
              fontWeight: 600,
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
            }}
          >
            <List size={14} />
            List View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: viewMode === 'calendar' ? '1.5px solid var(--persimmon-500)' : '1px solid var(--oat-200)',
              backgroundColor: viewMode === 'calendar' ? 'var(--persimmon-100)' : 'var(--milk)',
              color: viewMode === 'calendar' ? 'var(--persimmon-600)' : 'var(--ink-soft)',
              fontWeight: 600,
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
            }}
          >
            <Calendar size={14} />
            Calendar View
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'ALL', label: 'All Passes' },
          { id: 'APPROVED', label: 'Ready for Pickup' },
          { id: 'CHECKED_OUT', label: 'Active (With Me)' },
          { id: 'PENDING', label: 'Pending Review' },
          { id: 'COMPLETED', label: 'Returned' },
          { id: 'CANCELLED', label: 'Cancelled' },
        ]}
      />

      {/* Main Content Area */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Skeleton height={80} borderRadius="var(--radius-card)" />
          <Skeleton height={80} borderRadius="var(--radius-card)" />
          <Skeleton height={80} borderRadius="var(--radius-card)" />
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings in this tab"
          description="You don't have any reservations matching this status filter."
          actionLabel="Browse Marketplace"
          onAction={() => {}}
        />
      ) : viewMode === 'calendar' ? (
        /* Calendar View of Bookings */
        <div
          style={{
            backgroundColor: 'var(--milk)',
            border: '1.5px solid var(--ink-border)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-6)',
          }}
        >
          <h3 style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--text-base)', color: 'var(--ink)' }}>
            Schedule Timeline View
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {bookings.map((b) => (
              <div
                key={b.id}
                onClick={() => handleOpenDrawer(b)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--oat-50)',
                  border: '1px solid var(--oat-200)',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-sm)' }}>
                    {b.resource_name || 'Campus Resource'}
                  </span>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-mute)', marginTop: 4 }}>
                    {new Date(b.start_ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} •{' '}
                    {new Date(b.start_ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} –{' '}
                    {new Date(b.end_ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <Badge variant={getStatusBadgeVariant(b.status)}>{b.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* List View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {bookings.map((b) => (
            <div
              key={b.id}
              onClick={() => handleOpenDrawer(b)}
              style={{
                backgroundColor: 'var(--milk)',
                border: '1.5px solid var(--ink-border)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-4) var(--space-5)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--oat-100)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: 12,
                    color: 'var(--ink)',
                  }}
                >
                  <QrCode size={20} color="var(--persimmon-500)" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-base)' }}>
                      {b.resource_name || 'Equipment Unit'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-mute)' }}>
                      #{b.booking_code}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 2 }}>
                    {new Date(b.start_ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} •{' '}
                    {new Date(b.start_ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} –{' '}
                    {new Date(b.end_ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} •{' '}
                    {b.location || 'Campus Hub'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <Badge variant={getStatusBadgeVariant(b.status)}>{b.status}</Badge>
                <Button variant="ghost" size="sm">
                  View Pass &rarr;
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detailed Booking Pass & Permitted Actions Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Reservation Details & Boarding Pass"
      >
        {selectedBooking && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-4) 0' }}>
            {/* Full Booking Pass Component */}
            <BookingPass
              bookingId={selectedBooking.id}
              resourceTitle={selectedBooking.resource_name || 'Resource'}
              category={selectedBooking.resource_type || 'Equipment'}
              borrowerName={selectedBooking.student_name || user.full_name}
              borrowerRole="STUDENT"
              department={user.dept_id || 'Engineering'}
              dateStr={new Date(selectedBooking.start_ts).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
              timeSlot={`${new Date(selectedBooking.start_ts).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })} – ${new Date(selectedBooking.end_ts).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}`}
              location={selectedBooking.location || 'Central Equipment Hub'}
              status={selectedBooking.status}
              verificationCode={selectedBooking.booking_code}
            />

            {/* Permitted Action Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {/* Pickup Confirmation */}
              {selectedBooking.status === 'APPROVED' && (
                <Button
                  variant="primary"
                  onClick={() => confirmPickupMutation.mutate(selectedBooking.id)}
                  loading={confirmPickupMutation.isPending}
                  leftIcon={<CheckCircle2 size={16} />}
                >
                  Confirm Physical Pickup
                </Button>
              )}

              {/* Submit Return */}
              {(selectedBooking.status === 'CHECKED_OUT' || selectedBooking.status === 'OVERDUE') && (
                <Button
                  variant="primary"
                  onClick={() => setReturnModalOpen(true)}
                  leftIcon={<Camera size={16} />}
                >
                  Submit Return with Photos
                </Button>
              )}

              {/* Cancel Booking */}
              {['PENDING', 'APPROVED'].includes(selectedBooking.status) && (
                <Button
                  variant="ghost"
                  onClick={() => setCancelModalOpen(true)}
                  leftIcon={<Trash2 size={16} />}
                  style={{ color: 'var(--cherry-600)' }}
                >
                  Cancel Booking
                </Button>
              )}
            </div>

            {/* Narrative Timeline */}
            <div>
              <h4 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>
                Audit Narrative Timeline
              </h4>
              {timelineLoading ? (
                <Skeleton height={120} />
              ) : (
                <Timeline
                  items={(timelineData || []).map((t) => ({
                    id: t.id,
                    title: t.action.replace(/_/g, ' '),
                    description: t.narrative,
                    timestamp: new Date(t.timestamp).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      month: 'short',
                      day: 'numeric',
                    }),
                    actor: `${t.actor_name} (${t.actor_role})`,
                    status: 'completed',
                  }))}
                />
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Cancel Confirmation Dialog */}
      <ConfirmModal
        isOpen={cancelModalOpen}
        title="Cancel This Reservation?"
        message="Cancelling frees this slot immediately and offers it to students in the waiting list."
        confirmLabel="Yes, Cancel Booking"
        cancelLabel="Keep Booking"
        isDestructive={true}
        isLoading={cancelMutation.isPending}
        onConfirm={() => selectedBooking && cancelMutation.mutate(selectedBooking.id)}
        onCancel={() => setCancelModalOpen(false)}
      />

      {/* Return Submission Modal */}
      <Modal
        isOpen={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        title="Submit Resource Return"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Confirm that the equipment is intact and include any relevant handover notes or photos.
          </p>

          <Input
            label="Return Evidence Photo URL (Optional)"
            placeholder="https://... / image upload link"
            value={returnPhotoUrl}
            onChange={(e) => setReturnPhotoUrl(e.target.value)}
          />

          <Textarea
            label="Condition Notes"
            placeholder="e.g. Lens cap, power cable, and SD card returned inside carrying bag..."
            value={returnNotes}
            onChange={(e) => setReturnNotes(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <Button variant="ghost" onClick={() => setReturnModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={returnMutation.isPending}
              onClick={() => {
                if (!selectedBooking) return;
                returnMutation.mutate({
                  id: selectedBooking.id,
                  notes: returnNotes,
                  photo_urls: returnPhotoUrl ? [returnPhotoUrl] : [],
                });
              }}
            >
              Submit for Verification
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
