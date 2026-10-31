import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { api } from '../../api/client';
import { Booking, BookingStatus } from '../../api/types';
import {
  Button,
  Badge,
  Select,
  Skeleton,
  EmptyState,
  useToast,
} from '../../components/ui';

export const AdminBookingsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // Fetch bookings
  const { data: bookingsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-all-bookings', statusFilter],
    queryFn: () =>
      api.getAllBookings({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        size: 100,
      }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveBooking(id),
    onSuccess: (b) => {
      addToast({
        title: 'Booking Approved',
        message: `Pass code #${b.booking_code} issued for ${b.resource_name}.`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-all-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Approval Error',
        message: (err as Error).message,
        variant: 'danger',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.rejectBooking(id, 'Declined by Administrator during triage'),
    onSuccess: () => {
      addToast({
        title: 'Booking Rejected',
        message: 'Applicant has been notified and slot released.',
        variant: 'neutral',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-all-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Rejection Error',
        message: (err as Error).message,
        variant: 'danger',
      });
    },
  });

  const bookings = (bookingsData?.items || []).filter((b) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      b.booking_code.toLowerCase().includes(s) ||
      (b.student_name && b.student_name.toLowerCase().includes(s)) ||
      (b.resource_name && b.resource_name.toLowerCase().includes(s))
    );
  });

  const handleExportCSV = () => {
    const headers = ['Booking Code', 'Resource', 'Student', 'Start Time', 'End Time', 'Status', 'Priority Score'];
    const rows = bookings.map((b) => [
      b.booking_code,
      `"${b.resource_name || ''}"`,
      `"${b.student_name || ''}"`,
      b.start_ts,
      b.end_ts,
      b.status,
      b.priority_score?.toFixed(1) || '0',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `campusshare_all_bookings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
            Institutional <span className="squiggle-word">Bookings</span> & Passes
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Complete university-wide reservation registry with audit trail and CSV compliance export
          </p>
        </div>

        <Button
          variant="secondary"
          size="md"
          onClick={handleExportCSV}
          leftIcon={<Download size={16} />}
        >
          Export CSV ({bookings.length})
        </Button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ink-mute)' }} />
          <input
            type="text"
            placeholder="Search booking pass code, student name, or resource..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--ink-border)',
              backgroundColor: 'var(--milk)',
              fontSize: 'var(--text-sm)',
              outline: 'none',
            }}
          />
        </div>

        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { label: 'All Booking Statuses', value: 'ALL' },
            { label: 'APPROVED - Boarding Passes Ready', value: 'APPROVED' },
            { label: 'CHECKED_OUT - Active in Field', value: 'CHECKED_OUT' },
            { label: 'COMPLETED - Returned Intact', value: 'COMPLETED' },
            { label: 'PENDING - Awaiting Decision', value: 'PENDING' },
            { label: 'INCIDENT_REPORTED - Flagged', value: 'INCIDENT_REPORTED' },
          ]}
        />
      </div>

      {/* Bookings Table */}
      {isLoading ? (
        <Skeleton height={200} borderRadius="var(--radius-card)" />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No Bookings Match Criteria"
          description="Adjust your search query or status filter to see historical passes."
          actionLabel="Refresh"
          onAction={() => refetch()}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {bookings.map((b) => (
            <div
              key={b.id}
              style={{
                backgroundColor: 'var(--milk)',
                border: '1.5px solid var(--ink-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 'var(--text-xs)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
                    {b.resource_name || 'Resource'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)' }}>
                    #{b.booking_code}
                  </span>
                </div>
                <div style={{ color: 'var(--ink-soft)', marginTop: 2 }}>
                  Student: {b.student_name} • Window: {new Date(b.start_ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} to {new Date(b.end_ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge
                  variant={
                    b.status === 'APPROVED' || b.status === 'COMPLETED'
                      ? 'fern'
                      : b.status === 'CHECKED_OUT'
                      ? 'persimmon'
                      : b.status === 'PENDING'
                      ? 'apricot'
                      : 'cherry'
                  }
                >
                  {b.status}
                </Badge>

                {b.status === 'PENDING' && (
                  <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={approveMutation.isPending && approveMutation.variables === b.id}
                      onClick={() => approveMutation.mutate(b.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={rejectMutation.isPending && rejectMutation.variables === b.id}
                      onClick={() => rejectMutation.mutate(b.id)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

