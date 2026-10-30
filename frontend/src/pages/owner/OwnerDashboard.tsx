import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  PackageCheck,
  Clock,
  AlertTriangle,
  QrCode,
  RotateCcw,
  PlusCircle,
  TrendingUp,
  FileCheck,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Booking, ResourceItem } from '../../api/types';
import {
  StatCard,
  Button,
  Badge,
  Skeleton,
  EmptyState,
} from '../../components/ui';

export const OwnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // 1. Fetch Owner's managed resources
  const { data: resourcesData, isLoading: resLoading } = useQuery({
    queryKey: ['owner-resources'],
    queryFn: () => api.listResources({ owner_id: user.id, size: 50 }),
  });

  // 2. Fetch Owner's approval queue
  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['approval-queue', 'owner'],
    queryFn: () => api.getApprovalQueue(),
  });

  // 3. Fetch Incidents on owner's resources
  const { data: incidentsData } = useQuery({
    queryKey: ['owner-incidents'],
    queryFn: () => api.listIncidents({ size: 10 }),
  });

  const resources = resourcesData?.items || [];
  const pendingRequests = queueData?.items || [];
  const incidents = incidentsData?.items || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header with Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Badge variant="fern">LAB / FACILITY CUSTODIAN</Badge>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-mute)' }}>
              Dept: {user.dept_id || 'Engineering'}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
            Custodian Operations <span className="squiggle-word">Desk</span>
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Physical equipment handovers, condition inspection, and approval queues
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link to="/handover">
            <Button variant="primary" size="md" leftIcon={<QrCode size={16} />}>
              Open Handover Desk
            </Button>
          </Link>
          <Link to="/resources/new">
            <Button variant="secondary" size="md" leftIcon={<PlusCircle size={16} />}>
              Add Resource
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <StatCard
          label="Resources Managed"
          value={resources.length.toString()}
          delta="Catalogued"
          trend="up"
          sparklineData={[4, 5, 7, resources.length]}
          note="Active departmental equipment"
        />
        <StatCard
          label="Pending Requests"
          value={pendingRequests.length.toString()}
          delta={pendingRequests.length > 0 ? 'Requires action' : 'Queue clear'}
          trend={pendingRequests.length > 0 ? 'down' : 'up'}
          sparklineData={[1, 2, pendingRequests.length]}
          note="Sorted by priority score"
        />
        <StatCard
          label="Checked Out Now"
          value="4"
          delta="In field"
          trend="neutral"
          sparklineData={[2, 3, 4, 4]}
          note="Active student custody"
        />
        <StatCard
          label="Overdue / Incidents"
          value={incidents.length.toString()}
          delta="Under inspection"
          trend="neutral"
          sparklineData={[0, 1, incidents.length]}
          note="Logged accountability audits"
        />
      </div>

      {/* Main Two-Column: Pending Approvals Queue + Handover Actions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        {/* Pending Approval Requests */}
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
            <h3 style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--ink)' }}>
              Requests Awaiting Decision
            </h3>
            <Link to="/requests" style={{ fontSize: 'var(--text-xs)', color: 'var(--fern-600)', fontWeight: 600, textDecoration: 'none' }}>
              Full queue ({pendingRequests.length}) &rarr;
            </Link>
          </div>

          {queueLoading ? (
            <Skeleton height={140} />
          ) : pendingRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--ink-mute)', fontSize: 'var(--text-sm)' }}>
              No pending reservation requests right now.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {pendingRequests.slice(0, 4).map((b) => (
                <div
                  key={b.id}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'var(--oat-50)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--oat-200)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-sm)' }}>
                      {b.student_name || 'Student'} &bull; {b.resource_name}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 2 }}>
                      Priority Score: {b.priority_score?.toFixed(1) || '75.0'} • Slot: {new Date(b.start_ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <Link to="/requests">
                    <Button variant="secondary" size="sm">
                      Review &rarr;
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Handover & Inspection Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div
            style={{
              backgroundColor: 'var(--fern-100)',
              border: '1.5px solid var(--fern-500)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <QrCode size={20} color="var(--fern-600)" />
              <span style={{ fontWeight: 700, color: 'var(--fern-600)', fontSize: 'var(--text-md)' }}>
                Physical Handover Desk
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', lineHeight: 'var(--leading-relaxed)' }}>
              Verify student identity via booking code or QR pass, record pickup condition, take up to 6 audit photos, and issue equipment.
            </p>
            <Link to="/handover">
              <Button variant="primary" size="sm" style={{ backgroundColor: 'var(--fern-500)', borderColor: 'var(--fern-600)' }}>
                Launch Scanner & Check-Out
              </Button>
            </Link>
          </div>

          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RotateCcw size={18} color="var(--apricot-600)" />
              <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-sm)' }}>
                Return Verification Queue
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--ink-soft)' }}>
              Compare return photos side-by-side with original pickup condition.
            </p>
            <Link to="/returns">
              <Button variant="ghost" size="sm">
                Verify Returned Items &rarr;
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

