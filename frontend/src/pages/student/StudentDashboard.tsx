import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Compass,
  Search,
  Sparkles,
  Clock,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Bookmark,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Booking, ResourceItem } from '../../api/types';
import {
  BookingPass,
  StatCard,
  Button,
  ResourceCard,
  Skeleton,
  EmptyState,
  Badge,
} from '../../components/ui';
import { ProjectBuddy } from '../../components/ai/ProjectBuddy';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showBuddy, setShowBuddy] = React.useState<boolean>(false);

  // 1. Fetch current student's bookings
  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['my-bookings', 'dashboard'],
    queryFn: () => api.getMyBookings({ size: 10 }),
  });

  // 2. Fetch AI / Recommended resources (Personalized)
  const { data: recommendedData, isLoading: recLoading } = useQuery({
    queryKey: ['recommended-resources'],
    queryFn: () => api.getRecommendedForYou(4),
  });

  // 3. Fetch student fairness standing
  const { data: fairnessData } = useQuery({
    queryKey: ['fairness-profile'],
    queryFn: () => api.getFairnessProfile(),
  });

  // 4. Fetch waitlist entries
  const { data: waitlistData } = useQuery({
    queryKey: ['my-waitlist'],
    queryFn: () => api.listMyWaitlist(),
  });

  const bookings = bookingsData?.items || [];
  const activeBookings = bookings.filter((b) => b.status === 'APPROVED' || b.status === 'CHECKED_OUT');
  const pendingBookings = bookings.filter((b) => b.status === 'PENDING');
  const soonestBooking = activeBookings[0] || bookings[0];

  // Return reminder check
  const overdueOrEndingSoon = bookings.filter(
    (b) => b.status === 'CHECKED_OUT' || b.status === 'OVERDUE'
  );

  const currentDateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Greeting and Quick Search Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--persimmon-600)',
                backgroundColor: 'var(--persimmon-100)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
              }}
            >
              {currentDateStr}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-mute)' }}>
              ID: {user.student_id || 'STU-2026-ACTIVE'}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
            Welcome back, <span className="squiggle-word">{user.full_name.split(' ')[0]}</span>.
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-base)' }}>
            Department of {user.dept_id || 'Engineering'} • Standing Score: {fairnessData?.standing_score || 94}/100
          </p>
        </div>

        {/* Quick Search */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', minWidth: 280 }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <Search
              size={16}
              style={{ position: 'absolute', left: 12, color: 'var(--ink-mute)' }}
            />
            <input
              type="text"
              placeholder="Search cameras, oscilloscopes, labs..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  navigate(`/marketplace?q=${encodeURIComponent(val)}`);
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--ink-border)',
                backgroundColor: 'var(--milk)',
                color: 'var(--ink)',
                fontSize: 'var(--text-sm)',
                outline: 'none',
              }}
            />
          </div>
          <Link to="/marketplace">
            <Button variant="primary" size="md" rightIcon={<Compass size={16} />}>
              Explore
            </Button>
          </Link>
        </div>
      </div>

      {/* Return Reminders Banner (Alert if items checked out) */}
      {overdueOrEndingSoon.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--apricot-100)',
            border: '1.5px solid var(--apricot-500)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-4) var(--space-5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--apricot-500)',
                color: 'var(--milk)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Clock size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-sm)' }}>
                Equipment Return Reminder
              </div>
              <div style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
                You have {overdueOrEndingSoon.length} item(s) checked out. Please return before the booked end time to preserve your 100% on-time record.
              </div>
            </div>
          </div>
          <Link to={overdueOrEndingSoon[0] ? `/bookings?tab=CHECKED_OUT&bookingId=${overdueOrEndingSoon[0].id}&return=true` : `/bookings?tab=CHECKED_OUT`}>
            <Button variant="primary" size="sm" style={{ backgroundColor: 'var(--apricot-600)', borderColor: 'var(--apricot-600)' }}>
              Return Item
            </Button>
          </Link>
        </div>
      )}

      {/* Stat Cards Grid with Weekly Limit Usage */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <StatCard
          label="Active Passes"
          value={activeBookings.length.toString()}
          delta="Approved"
          trend="up"
          sparklineData={[0, 1, 1, 1, 1, activeBookings.length]}
          note="Ready for collection"
        />
        <StatCard
          label="Pending Approvals"
          value={pendingBookings.length.toString()}
          delta="Under review"
          trend="neutral"
          sparklineData={[1, 2, 1, pendingBookings.length]}
          note="Staff reviewing requests"
        />
        <StatCard
          label="Waitlist Positions"
          value={(waitlistData?.length || 0).toString()}
          delta="Active queues"
          trend="up"
          sparklineData={[0, 1, 1, waitlistData?.length || 0]}
          note="Auto-notification on slot"
        />
        <StatCard
          label="Weekly Limit Usage"
          value={`${fairnessData?.usage_this_month || 4}h / ${fairnessData?.monthly_limit || 20}h`}
          delta={`${Math.round(((fairnessData?.usage_this_month || 4) / (fairnessData?.monthly_limit || 20)) * 100)}%`}
          trend="neutral"
          sparklineData={[2, 3, 4, 4]}
          note="Refreshes every Monday"
        />
      </div>

      {/* Main Content Split: Soonest Booking Pass + Waitlist Position Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: soonestBooking ? 'minmax(320px, 1.2fr) minmax(280px, 0.8fr)' : '1fr',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        {/* Next Up Booking Pass */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-3)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Next Up: Boarding Pass
            </h3>
            <Link
              to="/bookings"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--persimmon-600)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              View all bookings &rarr;
            </Link>
          </div>

          {bookingsLoading ? (
            <Skeleton height={240} borderRadius="var(--radius-card)" />
          ) : soonestBooking ? (
            <BookingPass
              bookingId={soonestBooking.id}
              resourceTitle={soonestBooking.resource_name || 'Equipment Unit'}
              category="Equipment"
              borrowerName={soonestBooking.student_name || user.full_name}
              borrowerRole="STUDENT"
              department={user.dept_id || 'Campus'}
              dateStr={new Date(soonestBooking.start_ts).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
              timeSlot={`${new Date(soonestBooking.start_ts).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })} – ${new Date(soonestBooking.end_ts).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}`}
              location={soonestBooking.location || 'Central Equipment Hub'}
              status={soonestBooking.status}
              verificationCode={soonestBooking.booking_code}
            />
          ) : (
            <EmptyState
              title="No upcoming bookings"
              description="Browse the campus catalog to reserve equipment, labs, or multimedia kits."
              actionLabel="Browse Marketplace"
              onAction={() => navigate('/marketplace')}
            />
          )}
        </div>

        {/* Waitlist Positions & Fairness Standing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Waitlist Queue Standing
            </h3>
            <Link
              to="/waitlist"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--persimmon-600)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Manage &rarr;
            </Link>
          </div>

          {(waitlistData && waitlistData.length > 0) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {waitlistData.slice(0, 3).map((w) => (
                <div
                  key={w.id}
                  style={{
                    backgroundColor: 'var(--milk)',
                    border: '1.5px solid var(--ink-border)',
                    borderRadius: 'var(--radius-card)',
                    padding: 'var(--space-4)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 'var(--text-sm)' }}>
                      {w.resource_name || 'Reserved Resource'}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-mute)', marginTop: 2 }}>
                      Desired: {new Date(w.desired_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Badge variant={w.status === 'OFFERED' ? 'fern' : 'apricot'}>
                      {w.status === 'OFFERED' ? 'OFFER READY' : `POS #${w.position || 1}`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'var(--milk)',
                border: '1.5px solid var(--ink-border)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-4)',
                textAlign: 'center',
                color: 'var(--ink-soft)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <Layers size={24} style={{ color: 'var(--ink-mute)', margin: '0 auto var(--space-2)' }} />
              <div>No active waitlists. You are in direct booking standing.</div>
            </div>
          )}

          {/* Institutional Fairness Card */}
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Campus Fairness Standing
              </span>
              <Badge variant="fern">
                {fairnessData?.standing_score || 94}% Top Tier
              </Badge>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', lineHeight: 'var(--leading-relaxed)' }}>
              Priority formula: P = 40% Non-usage + 30% Need match + 20% Eligibility + 10% Wait time. No-shows: {fairnessData?.no_show_count || 0}.
            </p>
            <Link
              to="/profile"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--persimmon-600)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              View complete priority breakdown &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* AI Recommended for You Row & Project Buddy Drawer */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-4)',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="var(--persimmon-500)" />
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Recommended for Your Research & Projects
            </h3>
            <Badge variant="lilac">
              Smart Matching
            </Badge>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => setShowBuddy(!showBuddy)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-[var(--lilac-300)] bg-[var(--lilac-50)] text-[var(--lilac-800)] hover:bg-[var(--lilac-100)] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles size={13} />
              <span>{showBuddy ? 'Hide Project Buddy' : 'Ask Project Buddy (AI)'}</span>
            </button>
            <Link
              to="/marketplace"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--persimmon-600)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              View full catalog &rarr;
            </Link>
          </div>
        </div>

        {/* Project Buddy Collapsible Assistant */}
        {showBuddy && (
          <div className="mb-6">
            <ProjectBuddy onBookResource={(id) => navigate(`/resources/${id}`)} />
          </div>
        )}

        {recLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            <Skeleton height={260} borderRadius="var(--radius-card)" />
            <Skeleton height={260} borderRadius="var(--radius-card)" />
            <Skeleton height={260} borderRadius="var(--radius-card)" />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            {((recommendedData as unknown as any[]) || []).slice(0, 4).map((r: any) => (
              <ResourceCard
                key={r.id}
                id={r.id}
                title={r.name}
                category={r.category_name || r.category || 'Equipment'}
                department={r.department_code || r.department || 'General'}
                location={r.location}
                availableQty={r.available_quantity ?? 1}
                totalQty={r.quantity ?? 1}
                maxDurationHours={r.rule ? Math.round(r.rule.max_duration_minutes / 60) : 4}
                requiresTraining={r.training_required ?? r.requires_training}
                requiresApproval={r.approval_required}
                description={r.match_reason || r.description}
                imageUrl={r.image_url || r.primary_image_url}
                onSelect={() => navigate(`/resources/${r.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

