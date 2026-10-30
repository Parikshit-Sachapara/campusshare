import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  MapPin,
  Building,
  UserCheck,
  BookmarkPlus,
  Send,
  Layers,
  Printer,
  QrCode,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Button,
  Input,
  Textarea,
  ResourceCard,
  Skeleton,
  EmptyState,
  Badge,
  useToast,
} from '../../components/ui';

const bookingSchema = z.object({
  bookingDate: z.string().min(1, 'Please choose a date'),
  startTime: z.string().min(1, 'Please choose a start time'),
  endTime: z.string().min(1, 'Please choose an end time'),
  attendees: z.number().min(1),
  purpose: z.string().min(5, 'Please provide project or academic purpose (min 5 chars)'),
  projectName: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

export const ResourceDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);

  // 1. Fetch Resource Details
  const { data: resource, isLoading: resLoading, isError } = useQuery({
    queryKey: ['resource', id],
    queryFn: () => api.getResource(id!),
    enabled: Boolean(id),
  });

  // 2. Fetch User Eligibility live evaluation
  const { data: eligibility, isLoading: eligLoading } = useQuery({
    queryKey: ['resource-eligibility', id],
    queryFn: () => api.checkEligibility(id!),
    enabled: Boolean(id),
  });

  // 3. Fetch 30-Day Heat-Tinted Calendar
  const { data: calendarData } = useQuery({
    queryKey: ['resource-calendar', id],
    queryFn: () => api.getCalendar(id!),
    enabled: Boolean(id),
  });

  // 4. Fetch Slots for selected date
  const { data: availabilityData, isLoading: slotsLoading } = useQuery({
    queryKey: ['resource-availability', id, selectedDate],
    queryFn: () => api.getAvailability(id!, selectedDate),
    enabled: Boolean(id && selectedDate),
  });

  // 5. Fetch Similar Resources
  const { data: similarResources } = useQuery({
    queryKey: ['similar-resources', id],
    queryFn: () => (id ? api.getSimilarResources(id, 4) : []),
    enabled: Boolean(id),
  });

  const [showPrintTag, setShowPrintTag] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      bookingDate: selectedDate,
      startTime: '10:00',
      endTime: '12:00',
      attendees: 1,
      purpose: '',
      projectName: '',
    },
  });

  const watchedStartTime = watch('startTime');
  const watchedEndTime = watch('endTime');
  const watchedPurpose = watch('purpose');

  // Live dry-run validation evaluation via /bookings/validate
  const { data: dryRunResult, isFetching: validating } = useQuery({
    queryKey: ['dry-run-validation', id, selectedDate, watchedStartTime, watchedEndTime, watchedPurpose],
    queryFn: () => {
      if (!selectedDate || !watchedStartTime || !watchedEndTime) return null;
      const startIso = `${selectedDate}T${watchedStartTime}:00Z`;
      const endIso = `${selectedDate}T${watchedEndTime}:00Z`;
      return api.validateBooking({
        resource_id: id!,
        start_ts: startIso,
        end_ts: endIso,
        purpose: watchedPurpose || 'Academic project',
      });
    },
    enabled: Boolean(id && selectedDate && watchedStartTime && watchedEndTime && watchedStartTime < watchedEndTime),
  });

  // Create booking mutation
  const bookingMutation = useMutation({
    mutationFn: (data: BookingFormData) => {
      const startIso = `${data.bookingDate}T${data.startTime}:00Z`;
      const endIso = `${data.bookingDate}T${data.endTime}:00Z`;
      const idempotencyKey = `cs_book_${id}_${user.id}_${Date.now()}`;
      return api.createBooking(
        {
          resource_id: id!,
          start_ts: startIso,
          end_ts: endIso,
          attendees: Number(data.attendees) || 1,
          purpose: data.purpose,
          project_name: data.projectName,
        },
        idempotencyKey
      );
    },
    onSuccess: (booking) => {
      addToast({
        title: booking.status === 'APPROVED' ? 'Booking Confirmed!' : 'Request Submitted!',
        message: booking.status === 'APPROVED'
          ? `Your pass code is ${booking.booking_code}. Ready for pickup.`
          : 'Pending staff approval. We have sent your request to the lab owner.',
        variant: 'success',
      });
      navigate('/bookings');
    },
    onError: (err: unknown) => {
      const msg = (err as Error).message || 'Booking reservation could not be completed.';
      addToast({
        title: 'Booking Conflict or Blocked',
        message: msg,
        variant: 'danger',
      });
    },
  });

  // Join waitlist mutation
  const waitlistMutation = useMutation({
    mutationFn: () => {
      const startIso = `${selectedDate}T10:00:00Z`;
      const endIso = `${selectedDate}T14:00:00Z`;
      return api.joinWaitlist({
        resource_id: id!,
        desired_start: startIso,
        desired_end: endIso,
      });
    },
    onSuccess: (entry) => {
      addToast({
        title: 'Joined Waiting List!',
        message: `You are at position #${entry.position || 1}. We will notify you immediately when a slot frees.`,
        variant: 'success',
      });
      navigate('/waitlist');
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Could Not Join Waitlist',
        message: (err as Error).message || 'Error joining queue.',
        variant: 'danger',
      });
    },
  });

  const onSubmit = (data: BookingFormData) => {
    bookingMutation.mutate(data);
  };

  const handleSlotClick = (slot: { start: string; end: string }) => {
    setSelectedSlot(slot);
    setValue('startTime', slot.start);
    setValue('endTime', slot.end);
  };

  if (resLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <Skeleton height={32} width={200} />
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-6)' }}>
          <Skeleton height={400} borderRadius="var(--radius-card)" />
          <Skeleton height={400} borderRadius="var(--radius-card)" />
        </div>
      </div>
    );
  }

  if (isError || !resource) {
    return (
      <EmptyState
        title="Resource Not Found"
        description="The requested campus equipment or facility could not be retrieved."
        actionLabel="Back to Marketplace"
        onAction={() => navigate('/marketplace')}
      />
    );
  }

  const galleryImages = resource.images?.length
    ? resource.images.map((img) => img.image_url)
    : [resource.primary_image_url || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Back button and Print Asset Tag bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link
          to="/marketplace"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--ink-soft)',
            fontSize: 'var(--text-sm)',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} />
          Back to Marketplace
        </Link>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShowPrintTag(true)}
          leftIcon={<Printer size={15} />}
          style={{ borderColor: 'var(--oat-300)' }}
        >
          Print Asset Tag (QR)
        </Button>
      </div>

      {/* Main Two-Column View */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr',
          gap: 'var(--space-8)',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Image Gallery, Specs, Rules & Eligibility Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Main Gallery */}
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: '100%', height: 360, backgroundColor: 'var(--oat-100)', position: 'relative' }}>
              <img
                src={galleryImages[activeImageIndex]}
                alt={resource.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  left: 14,
                  display: 'flex',
                  gap: 8,
                }}
              >
                <Badge variant={resource.resource_type === 'EQUIPMENT' ? 'persimmon' : 'mulberry'}>
                  {resource.resource_type}
                </Badge>
                {resource.approval_required && <Badge variant="apricot">Approval Required</Badge>}
                {resource.training_required && <Badge variant="cherry">Training Required</Badge>}
              </div>
            </div>

            {/* Thumbnails */}
            {galleryImages.length > 1 && (
              <div style={{ display: 'flex', gap: 8, padding: 'var(--space-3)', backgroundColor: 'var(--oat-50)' }}>
                {galleryImages.map((imgUrl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImageIndex(i)}
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      border: activeImageIndex === i ? '2px solid var(--persimmon-500)' : '1px solid var(--ink-border)',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details & Specs */}
          <div>
            <h1 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
              {resource.name}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={16} color="var(--persimmon-500)" />
                {resource.location}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Building size={16} color="var(--fern-500)" />
                {resource.department_code || 'General'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <UserCheck size={16} color="var(--mulberry-500)" />
                Custodian: {resource.owner_name || 'Lab Supervisor'}
              </span>
            </div>

            <p style={{ margin: '0 0 var(--space-4) 0', color: 'var(--ink-soft)', lineHeight: 'var(--leading-relaxed)' }}>
              {resource.description || 'High-performance institutional equipment available for academic projects, thesis research, and authorized workshops.'}
            </p>

            {/* Specs Table */}
            <div
              style={{
                backgroundColor: 'var(--milk)',
                border: '1.5px solid var(--ink-border)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-4)',
              }}
            >
              <h4 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-sm)', color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Operational Specifications & Rules
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
                <div>
                  <span style={{ color: 'var(--ink-mute)', display: 'block' }}>Max Booking Duration</span>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                    {resource.rule ? `${Math.round(resource.rule.max_duration_minutes / 60)} hours` : '4 hours'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--ink-mute)', display: 'block' }}>Advance Booking Window</span>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                    {resource.rule ? `${resource.rule.advance_booking_days} days ahead` : '14 days ahead'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--ink-mute)', display: 'block' }}>Available Units</span>
                  <span style={{ fontWeight: 600, color: 'var(--fern-600)' }}>
                    {resource.available_quantity} of {resource.quantity} active
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--ink-mute)', display: 'block' }}>Security Deposit</span>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                    {resource.deposit_amount ? `\$${resource.deposit_amount}` : 'None Required'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Rules & Eligibility Checklist (Live evaluation of the user) */}
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={20} color="var(--fern-500)" />
                <h3 style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--ink)' }}>
                  Your Live Eligibility Evaluation
                </h3>
              </div>
              <Badge variant={eligibility?.eligible ? 'fern' : 'cherry'}>
                {eligibility?.eligible ? 'ELIGIBLE' : 'ACTION REQUIRED'}
              </Badge>
            </div>

            {eligLoading ? (
              <Skeleton height={80} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {eligibility?.checks?.map((check) => (
                  <div
                    key={check.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: check.passed ? 'var(--fern-100)' : 'var(--cherry-100)',
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {check.passed ? (
                        <CheckCircle2 size={16} color="var(--fern-600)" />
                      ) : (
                        <XCircle size={16} color="var(--cherry-600)" />
                      )}
                      <span style={{ fontWeight: 600, color: check.passed ? 'var(--fern-600)' : 'var(--cherry-600)' }}>
                        {check.name}
                      </span>
                    </div>
                    <span style={{ color: 'var(--ink-soft)' }}>
                      {check.reason || (check.passed ? 'Verified' : 'Incomplete')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 30-Day Heat Calendar, Slot Picker & Booking Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* 30-Day Occupancy Heat Calendar */}
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={18} color="var(--persimmon-500)" />
                <h3 style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--ink)' }}>
                  30-Day Availability Forecast
                </h3>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-mute)' }}>Heat-tinted by occupancy</span>
            </div>

            {/* Heat tint scale legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-mute)', marginBottom: 'var(--space-3)' }}>
              <span>Free</span>
              <span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--sage-300)' }} />
              <span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--fern-500)' }} />
              <span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--apricot-500)' }} />
              <span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--cherry-500)' }} />
              <span>Full</span>
            </div>

            {/* Calendar mini grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {(calendarData?.days || []).slice(0, 28).map((d) => {
                const isSelected = d.date === selectedDate;
                // Heat color based on occupancy_pct
                let bg = 'var(--sage-300)';
                if (d.occupancy_pct > 75) bg = 'var(--cherry-500)';
                else if (d.occupancy_pct > 50) bg = 'var(--apricot-500)';
                else if (d.occupancy_pct > 25) bg = 'var(--fern-500)';

                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => {
                      setSelectedDate(d.date);
                      setValue('bookingDate', d.date);
                    }}
                    style={{
                      height: 48,
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '2px solid var(--persimmon-500)' : '1px solid var(--oat-200)',
                      backgroundColor: isSelected ? 'var(--persimmon-100)' : 'var(--oat-50)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink)' }}>
                      {d.date.slice(8)}
                    </span>
                    <span
                      style={{
                        width: 14,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: bg,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slot Picker for Selected Date */}
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={16} color="var(--persimmon-500)" />
                <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>
                  Available Time Slots ({selectedDate})
                </h4>
              </div>
            </div>

            {slotsLoading ? (
              <Skeleton height={50} />
            ) : availabilityData?.slots && availabilityData.slots.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {availabilityData.slots.map((s, idx) => {
                  const isPicked = selectedSlot?.start === s.start && selectedSlot?.end === s.end;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!s.available}
                      onClick={() => handleSlotClick(s)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: isPicked ? '1.5px solid var(--persimmon-500)' : '1px solid var(--oat-200)',
                        backgroundColor: isPicked ? 'var(--persimmon-100)' : s.available ? 'var(--milk)' : 'var(--oat-100)',
                        color: isPicked ? 'var(--persimmon-600)' : s.available ? 'var(--ink)' : 'var(--ink-mute)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        cursor: s.available ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {s.start} – {s.end}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)' }}>
                No standard slots remaining. You may specify custom hours below or join the waiting list.
              </div>
            )}
          </div>

          {/* Booking Form with Dry-Run Feedback */}
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
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Reserve Resource
            </h3>

            {/* Dry-run validation alert */}
            {validating ? (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-mute)' }}>Evaluating live conflict and safety constraints...</div>
            ) : dryRunResult && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: dryRunResult.eligible ? 'var(--fern-100)' : 'var(--cherry-100)',
                  border: `1px solid ${dryRunResult.eligible ? 'var(--fern-500)' : 'var(--cherry-500)'}`,
                  fontSize: 'var(--text-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {dryRunResult.eligible ? (
                  <>
                    <CheckCircle2 size={16} color="var(--fern-600)" />
                    <span style={{ color: 'var(--fern-600)', fontWeight: 600 }}>
                      Dry-Run Validated: Slot is available and meets institutional safety policy.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} color="var(--cherry-600)" />
                    <span style={{ color: 'var(--cherry-600)', fontWeight: 600 }}>
                      {dryRunResult.first_failing_reason || 'Booking conflict detected.'}
                    </span>
                  </>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <Input
                  label="Start Time"
                  type="time"
                  error={errors.startTime?.message}
                  {...register('startTime')}
                />
                <Input
                  label="End Time"
                  type="time"
                  error={errors.endTime?.message}
                  {...register('endTime')}
                />
              </div>

              {resource.resource_type === 'FACILITY' && (
                <Input
                  label="Expected Headcount / Attendees"
                  type="number"
                  placeholder="e.g. 15"
                  error={errors.attendees?.message}
                  {...register('attendees', { valueAsNumber: true })}
                />
              )}

              <Input
                label="Project or Research Title (Optional)"
                placeholder="Senior Capstone Documentary / Robotics SLAM Lab"
                error={errors.projectName?.message}
                {...register('projectName')}
              />

              <Textarea
                label="Purpose & Intended Use"
                placeholder="Please state how this equipment or space will be used..."
                error={errors.purpose?.message}
                {...register('purpose')}
              />

              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={bookingMutation.isPending}
                  rightIcon={<Send size={16} />}
                  style={{ flex: 1 }}
                >
                  Confirm & Lock Slot
                </Button>

                {resource.available_quantity === 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    loading={waitlistMutation.isPending}
                    onClick={() => waitlistMutation.mutate()}
                    leftIcon={<BookmarkPlus size={16} />}
                  >
                    Join Waitlist
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Similar Resources Section */}
      {similarResources && similarResources.length > 0 && (
        <div style={{ marginTop: 'var(--space-8)', borderTop: '1px solid var(--oat-200)', paddingTop: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-4)' }}>
            <Sparkles size={18} color="var(--persimmon-500)" />
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Similar Resources in this Discipline
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
            {similarResources.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/resources/${item.id}`)}
                style={{
                  backgroundColor: 'var(--milk)',
                  border: '1.5px solid var(--ink-border)',
                  borderRadius: 'var(--radius-card)',
                  padding: 'var(--space-4)',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    style={{ width: 56, height: 56, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--oat-200)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: 'var(--ink-soft)',
                    }}
                  >
                    {item.name.charAt(0)}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', fontWeight: 600 }}>
                    {item.department} • {item.category}
                  </div>
                  <h4 style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--ink)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </h4>
                  <div style={{ fontSize: '11px', color: 'var(--persimmon-600)', marginTop: 2, fontWeight: 600 }}>
                    View Space &rarr;
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Printable Asset Tag Modal */}
      {showPrintTag && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(45, 40, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 'var(--space-4)',
          }}
          onClick={() => setShowPrintTag(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--milk)',
              borderRadius: 'var(--radius-card)',
              border: '2px solid var(--ink)',
              padding: 'var(--space-6)',
              maxWidth: 440,
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Printable Tag Container */}
            <div
              id="printable-asset-tag"
              style={{
                border: '2px dashed var(--ink)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-5)',
                backgroundColor: 'var(--oat-50)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 4 }}>
                CampusShare Institutional Asset
              </div>
              <h3 style={{ margin: '0 0 4px', fontSize: 'var(--text-base)', color: 'var(--ink)', fontWeight: 800 }}>
                {resource.name}
              </h3>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-mono)' }}>
                DEPT: {resource.department_code || 'GEN'} • LOC: {resource.location}
              </div>

              {/* QR Code */}
              <div style={{ display: 'inline-block', padding: 12, backgroundColor: '#FFFFFF', borderRadius: 12, border: '1px solid var(--ink-border)', marginBottom: 'var(--space-3)' }}>
                <QRCodeSVG
                  value={`${window.location.origin}/resources/${resource.id}`}
                  size={140}
                  level="M"
                />
              </div>

              <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink)' }}>
                CS-{resource.department_code || 'CAMPUS'}-{resource.id.slice(0, 8).toUpperCase()}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--ink-soft)', marginTop: 2 }}>
                Scan to verify unit condition or create reservation
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
              <Button
                variant="secondary"
                onClick={() => setShowPrintTag(false)}
                style={{ flex: 1 }}
              >
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => window.print()}
                leftIcon={<Printer size={16} />}
                style={{ flex: 1, backgroundColor: 'var(--fern-500)', borderColor: 'var(--fern-600)' }}
              >
                Print Label
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
