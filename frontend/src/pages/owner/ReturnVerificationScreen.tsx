import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../api/client';
import { Booking, UnitCondition } from '../../api/types';
import {
  Button,
  Select,
  Textarea,
  Badge,
  Modal,
  Input,
  Skeleton,
  EmptyState,
  useToast,
} from '../../components/ui';

export const ReturnVerificationScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [finalCondition, setFinalCondition] = useState<UnitCondition>('EXCELLENT');
  const [staffNotes, setStaffNotes] = useState('');

  // Damage / Incident flagging modal state
  const [flagDamageOpen, setFlagDamageOpen] = useState(false);
  const [damageObserved, setDamageObserved] = useState(false);
  const [itemMissing, setItemMissing] = useState(false);
  const [incidentDescription, setIncidentDescription] = useState('');

  // 1. Fetch bookings in RETURN_PENDING status
  const { data: bookingsData, isLoading, refetch } = useQuery({
    queryKey: ['return-pending-bookings'],
    queryFn: () => api.getMyBookings({ status: 'RETURN_PENDING', size: 50 }),
  });

  const pendingReturns = bookingsData?.items || [];

  // Verification mutation
  const verifyMutation = useMutation({
    mutationFn: (data: {
      id: string;
      final_condition: UnitCondition;
      notes?: string;
      damage_observed: boolean;
      item_missing?: boolean;
      incident_description?: string;
    }) =>
      api.verifyReturn(data.id, {
        final_condition: data.final_condition,
        notes: data.notes,
        damage_observed: data.damage_observed,
        item_missing: data.item_missing,
        incident_description: data.incident_description,
      }),
    onSuccess: (res) => {
      if (res.status === 'INCIDENT_REPORTED') {
        addToast({
          title: 'Damage Incident Logged & Unit Flagged',
          message: 'The physical unit has been taken offline until repaired.',
          variant: 'warning',
        });
      } else {
        addToast({
          title: 'Return Verified & Booking Completed!',
          message: 'Item has been restocked and student record updated.',
          variant: 'success',
        });
      }
      setSelectedBooking(null);
      setFlagDamageOpen(false);
      setStaffNotes('');
      setIncidentDescription('');
      queryClient.invalidateQueries({ queryKey: ['return-pending-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['owner-resources'] });
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Return Verification Failed',
        message: (err as Error).message,
        variant: 'danger',
      });
    },
  });

  const handleCleanVerify = () => {
    if (!selectedBooking) return;
    verifyMutation.mutate({
      id: selectedBooking.id,
      final_condition: finalCondition,
      notes: staffNotes,
      damage_observed: false,
      item_missing: false,
    });
  };

  const handleFlagIncidentSubmit = () => {
    if (!selectedBooking) return;
    verifyMutation.mutate({
      id: selectedBooking.id,
      final_condition: finalCondition,
      notes: staffNotes,
      damage_observed: damageObserved,
      item_missing: itemMissing,
      incident_description: incidentDescription,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
          Physical Return <span className="squiggle-word">Verification</span>
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
          Side-by-side inspection comparing condition at pickup against returned assets
        </p>
      </div>

      {isLoading ? (
        <Skeleton height={140} borderRadius="var(--radius-card)" />
      ) : pendingReturns.length === 0 ? (
        <EmptyState
          title="Return Queue Clear"
          description="There are currently no items awaiting physical return verification."
          actionLabel="Refresh Queue"
          onAction={() => refetch()}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedBooking ? '1fr 1.3fr' : '1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
          {/* List of Pending Returns */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--ink)' }}>
              Awaiting Inspection ({pendingReturns.length})
            </h3>
            {pendingReturns.map((b) => {
              const isSelected = selectedBooking?.id === b.id;
              return (
                <div
                  key={b.id}
                  onClick={() => {
                    setSelectedBooking(b);
                    setFinalCondition('EXCELLENT');
                  }}
                  style={{
                    backgroundColor: isSelected ? 'var(--fern-100)' : 'var(--milk)',
                    border: isSelected ? '2px solid var(--fern-500)' : '1.5px solid var(--ink-border)',
                    borderRadius: 'var(--radius-card)',
                    padding: 'var(--space-4) var(--space-5)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-base)', display: 'block' }}>
                      {b.resource_name || 'Equipment'}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)' }}>
                      Student: {b.student_name} • Pass #{b.booking_code}
                    </span>
                  </div>
                  <Badge variant="apricot">RETURN PENDING</Badge>
                </div>
              );
            })}
          </div>

          {/* Side-by-Side Verification Panel */}
          {selectedBooking && (
            <div
              style={{
                backgroundColor: 'var(--milk)',
                border: '1.5px solid var(--ink-border)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-5)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
                Compare Physical Condition: {selectedBooking.resource_name}
              </h3>

              {/* Side-by-side comparison boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                {/* Pickup Condition */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--oat-50)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--oat-200)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-mute)', textTransform: 'uppercase' }}>
                    1. At Pickup
                  </div>
                  <div style={{ marginTop: 4, fontWeight: 700, color: 'var(--fern-600)', fontSize: 'var(--text-sm)' }}>
                    Condition: EXCELLENT
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--ink-soft)' }}>
                    Pristine condition recorded by custodian during initial release.
                  </p>
                </div>

                {/* Returned Condition */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--oat-50)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--oat-200)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-mute)', textTransform: 'uppercase' }}>
                    2. Final Verified Condition
                  </div>
                  <Select
                    value={finalCondition}
                    onChange={(e) => setFinalCondition(e.target.value as UnitCondition)}
                    options={[
                      { label: 'EXCELLENT - Intact and fully functional', value: 'EXCELLENT' },
                      { label: 'GOOD - Clean with minor expected wear', value: 'GOOD' },
                      { label: 'FAIR - Noticeable wear', value: 'FAIR' },
                      { label: 'DAMAGED - Defect or physical damage observed', value: 'DAMAGED' },
                    ]}
                  />
                </div>
              </div>

              <Textarea
                label="Custodian Final Inspection Notes"
                placeholder="e.g. Verified lens optics clean, SD card present, power cable functional..."
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
              />

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setDamageObserved(true);
                    setFlagDamageOpen(true);
                  }}
                  leftIcon={<ShieldAlert size={16} />}
                  style={{ color: 'var(--cherry-600)' }}
                >
                  Flag Damage / Missing Item
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  loading={verifyMutation.isPending}
                  onClick={handleCleanVerify}
                  leftIcon={<CheckCircle2 size={16} />}
                  style={{ backgroundColor: 'var(--fern-500)', borderColor: 'var(--fern-600)' }}
                >
                  Verify Clean & Complete Booking
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Flag Damage & Incident Creation Modal */}
      <Modal
        isOpen={flagDamageOpen}
        onClose={() => setFlagDamageOpen(false)}
        title="Flag Condition Issue or Missing Item"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Flagging damage will transition this booking to INCIDENT_REPORTED, deactivate the physical unit from future reservation, and open an investigation.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--ink)' }}>
              <input
                type="checkbox"
                checked={damageObserved}
                onChange={(e) => setDamageObserved(e.target.checked)}
                style={{ accentColor: 'var(--cherry-500)' }}
              />
              <span>Physical damage or defect observed on return</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--ink)' }}>
              <input
                type="checkbox"
                checked={itemMissing}
                onChange={(e) => setItemMissing(e.target.checked)}
                style={{ accentColor: 'var(--cherry-500)' }}
              />
              <span>Accessory, component, or item missing</span>
            </label>
          </div>

          <Textarea
            label="Incident Description (Mandatory)"
            placeholder="Describe the defect in detail (e.g. cracked LCD screen, stripped tripod screw, missing lens cap)..."
            value={incidentDescription}
            onChange={(e) => setIncidentDescription(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <Button variant="ghost" onClick={() => setFlagDamageOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={verifyMutation.isPending}
              disabled={!incidentDescription.trim()}
              onClick={handleFlagIncidentSubmit}
              style={{ backgroundColor: 'var(--cherry-500)', borderColor: 'var(--cherry-600)' }}
            >
              Confirm Incident & Take Offline
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

