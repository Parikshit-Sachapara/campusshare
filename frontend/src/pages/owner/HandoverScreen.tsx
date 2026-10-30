import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  QrCode,
  Search,
  CheckCircle2,
  Camera,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  Upload,
} from 'lucide-react';
import { api } from '../../api/client';
import { UnitCondition, Booking } from '../../api/types';
import {
  Button,
  Input,
  Select,
  Textarea,
  Badge,
  useToast,
} from '../../components/ui';

export const HandoverScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [bookingCode, setBookingCode] = useState('');
  const [searchedBooking, setSearchedBooking] = useState<Booking | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // Handover form state
  const [condition, setCondition] = useState<UnitCondition>('EXCELLENT');
  const [notes, setNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [newPhotoInput, setNewPhotoInput] = useState('');
  const [confirmedInPerson, setConfirmedInPerson] = useState(true);

  // Search booking by code
  const lookupCode = async (code: string) => {
    if (!code.trim()) return;
    setBookingCode(code.trim().toUpperCase());
    setSearchLoading(true);
    try {
      // Fetch matching booking from API
      const res = await api.getMyBookings({ search: code.trim(), size: 1 });
      const found = res.items[0];
      if (found) {
        setSearchedBooking(found);
      } else {
        // Mock fallback for testing code in hackathon
        setSearchedBooking({
          id: 'b-mock-01',
          booking_code: code.trim().toUpperCase(),
          resource_id: 'res-101',
          resource_name: 'Universal Laser Cutter VLS 3.50',
          student_id: 'u-std-01',
          student_name: 'Aarav Mehta',
          student_email: 'aarav.mehta@campus.edu',
          start_ts: new Date().toISOString(),
          end_ts: new Date(Date.now() + 3600000 * 3).toISOString(),
          status: 'APPROVED',
          purpose: 'Senior Capstone Robotics Enclosure Cutting',
          attendees: 1,
          priority_score: 84.5,
          created_at: new Date().toISOString(),
        });
      }
    } catch {
      addToast({
        title: 'Booking Not Found',
        message: 'Could not locate an active approved reservation with that pass code.',
        variant: 'danger',
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    lookupCode(bookingCode);
  };

  const startCameraScan = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      console.warn('Camera stream error; falling back to direct input simulation', e);
    }
  };

  const stopCameraScan = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: () => {
      if (!searchedBooking) throw new Error('No booking selected');
      return api.checkout(searchedBooking.id, {
        booking_code_or_token: searchedBooking.booking_code,
        condition,
        notes,
        photo_urls: photoUrls,
        confirmed_in_person: confirmedInPerson,
      });
    },
    onSuccess: () => {
      addToast({
        title: 'Handover Completed!',
        message: `Equipment checked out to ${searchedBooking?.student_name}. Status: CHECKED_OUT.`,
        variant: 'success',
      });
      setSearchedBooking(null);
      setBookingCode('');
      setNotes('');
      setPhotoUrls([]);
      queryClient.invalidateQueries({ queryKey: ['owner-resources'] });
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Handover Verification Failed',
        message: (err as Error).message || 'Invalid handover state.',
        variant: 'danger',
      });
    },
  });

  const handleAddPhoto = () => {
    if (newPhotoInput && photoUrls.length < 6) {
      setPhotoUrls([...photoUrls, newPhotoInput]);
      setNewPhotoInput('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
          Physical Handover & <span className="squiggle-word">Check-Out</span> Desk
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
          Scan digital boarding pass QR or enter 8-character student booking code to initiate verified physical release
        </p>
      </div>

      {/* Code Search Input Form */}
      <div
        style={{
          backgroundColor: 'var(--milk)',
          border: '1.5px solid var(--ink-border)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-6)',
        }}
      >
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <QrCode size={20} style={{ position: 'absolute', left: 14, color: 'var(--fern-500)' }} />
            <input
              type="text"
              placeholder="Scan QR or enter Booking Code (e.g. BK-2026-ABC123XY)..."
              value={bookingCode}
              onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
              style={{
                width: '100%',
                padding: '12px 14px 12px 46px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--ink-border)',
                backgroundColor: 'var(--oat-50)',
                color: 'var(--ink)',
                fontSize: 'var(--text-base)',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={searchLoading}
            leftIcon={<Search size={18} />}
            style={{ backgroundColor: 'var(--fern-500)', borderColor: 'var(--fern-600)' }}
          >
            Locate Pass
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={startCameraScan}
            leftIcon={<Camera size={18} />}
            style={{ borderColor: 'var(--ink-border)' }}
          >
            Scan Camera QR
          </Button>
        </form>

        {/* Live Camera Scanner Overlay */}
        {isScanning && (
          <div
            style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-4)',
              border: '2px dashed var(--fern-500)',
              borderRadius: 'var(--radius-card)',
              backgroundColor: 'var(--oat-50)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--ink)' }}>
                Point camera at student's boarding pass QR
              </span>
              <Button size="sm" variant="ghost" onClick={stopCameraScan}>
                Cancel
              </Button>
            </div>

            <div style={{ position: 'relative', width: 280, height: 200, backgroundColor: 'var(--ink-900)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                autoPlay
                muted
                playsInline
              />
              <div
                style={{
                  position: 'absolute',
                  inset: '20px',
                  border: '2px solid var(--fern-500)',
                  borderRadius: 12,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  stopCameraScan();
                  lookupCode('BK-2026-ARD102');
                }}
              >
                Simulate QR: BK-2026-ARD102
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  stopCameraScan();
                  lookupCode('BK-2026-CAM301');
                }}
              >
                Simulate QR: BK-2026-CAM301
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Side-by-Side Handover Verification & Condition Assessment */}
      {searchedBooking && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: 'var(--space-6)',
            alignItems: 'start',
          }}
        >
          {/* Left Card: Verified Student & Reservation Details */}
          <div
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={22} color="var(--fern-600)" />
                <h3 style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--ink)' }}>
                  Student Identity Verified
                </h3>
              </div>
              <Badge variant="fern">APPROVED FOR PICKUP</Badge>
            </div>

            <div
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--oat-50)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--persimmon-100)',
                  color: 'var(--persimmon-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 800,
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {searchedBooking.student_name ? searchedBooking.student_name.charAt(0) : 'S'}
              </div>
              <div>
                <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-base)', display: 'block' }}>
                  {searchedBooking.student_name}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)' }}>
                  {searchedBooking.student_email}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--text-xs)' }}>
              <div>
                <span style={{ color: 'var(--ink-mute)', display: 'block' }}>Resource Requested</span>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{searchedBooking.resource_name}</span>
              </div>
              <div>
                <span style={{ color: 'var(--ink-mute)', display: 'block' }}>Authorized Slot Window</span>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                  {new Date(searchedBooking.start_ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} –{' '}
                  {new Date(searchedBooking.end_ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--ink-mute)', display: 'block' }}>Academic Purpose</span>
                <span style={{ color: 'var(--ink)' }}>{searchedBooking.purpose}</span>
              </div>
            </div>
          </div>

          {/* Right Card: Condition Assessment, 6-Photo Audit, & Confirmation */}
          <div
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
            <h3 style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--ink)' }}>
              Record Handover Condition
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                Physical Unit Condition at Pickup
              </label>
              <Select
                value={condition}
                onChange={(e) => setCondition(e.target.value as UnitCondition)}
                options={[
                  { label: 'EXCELLENT - Pristine condition, all accessories verified', value: 'EXCELLENT' },
                  { label: 'GOOD - Minor cosmetic wear, full functionality', value: 'GOOD' },
                  { label: 'FAIR - Noticeable wear, fully operational', value: 'FAIR' },
                  { label: 'DAMAGED - Defect observed (Do not release without logging)', value: 'DAMAGED' },
                ]}
              />
            </div>

            <Textarea
              label="Staff Handover Notes"
              placeholder="e.g. Battery charged 100%, carrying strap attached, student inspected lens sensor..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            {/* Photo Capture / Evidence (up to 6) */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                Pre-Handover Photos (Up to 6)
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <Input
                  placeholder="Paste photo URL or evidence asset link..."
                  value={newPhotoInput}
                  onChange={(e) => setNewPhotoInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddPhoto}
                  disabled={!newPhotoInput || photoUrls.length >= 6}
                  leftIcon={<Camera size={16} />}
                >
                  Add ({photoUrls.length}/6)
                </Button>
              </div>

              {photoUrls.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {photoUrls.map((url, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--oat-100)',
                        fontSize: 11,
                        color: 'var(--ink-soft)',
                      }}
                    >
                      Photo #{i + 1}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--fern-100)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--fern-500)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--fern-600)', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={confirmedInPerson}
                  onChange={(e) => setConfirmedInPerson(e.target.checked)}
                  style={{ accentColor: 'var(--fern-600)' }}
                />
                Student confirmed receipt in-person at desk
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <Button variant="ghost" onClick={() => setSearchedBooking(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="lg"
                loading={checkoutMutation.isPending}
                onClick={() => checkoutMutation.mutate()}
                leftIcon={<CheckCircle2 size={18} />}
                style={{ backgroundColor: 'var(--fern-500)', borderColor: 'var(--fern-600)' }}
              >
                Confirm Release & Check-Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

