import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  Users,
  Building,
  Package,
  FileCheck2,
  Sliders,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../api/client';
import { StatCard, Badge, Skeleton } from '../../components/ui';

export const AdminDashboard: React.FC = () => {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.getPublicStats(),
  });

  const chartData = [
    { name: 'Mon', bookings: 42, handovers: 38 },
    { name: 'Tue', bookings: 56, handovers: 52 },
    { name: 'Wed', bookings: 78, handovers: 71 },
    { name: 'Thu', bookings: 65, handovers: 60 },
    { name: 'Fri', bookings: 88, handovers: 84 },
    { name: 'Sat', bookings: 34, handovers: 30 },
    { name: 'Sun', bookings: 22, handovers: 20 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Badge variant="lilac">CAMPUS ADMINISTRATOR</Badge>
          </div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
            Institutional Governance & <span className="squiggle-word">Platform</span> Admin
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            System telemetry, user verification, immutable audit records, and algorithmic fairness configuration
          </p>
        </div>

        <a
          href="/stats"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            backgroundColor: 'var(--milk)',
            border: '1.5px solid var(--fern-500)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--fern-700)',
            textDecoration: 'none',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--fern-500)' }} />
          Campus Pulse & Spatial Analytics &rarr;
        </a>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <StatCard
          label="Registered Users"
          value={(statsData?.active_users || 620).toString()}
          delta="+28 this week"
          trend="up"
          sparklineData={[480, 520, 580, 620]}
          note="Students, staff & faculty"
        />
        <StatCard
          label="Campus Catalog"
          value={(statsData?.total_resources || 48).toString()}
          delta="100% Active"
          trend="up"
          sparklineData={[30, 36, 42, 48]}
          note="Across 9 departments"
        />
        <StatCard
          label="Total Borrows"
          value={(statsData?.total_bookings || 1842).toString()}
          delta="+24.5%"
          trend="up"
          sparklineData={[900, 1200, 1500, 1842]}
          note="Audited bookings"
        />
        <StatCard
          label="Utilization Rate"
          value={`${statsData?.utilization_rate || 87.4}%`}
          delta="Campus High"
          trend="up"
          sparklineData={[65, 72, 80, 87.4]}
          note="Peak slot engagement"
        />
      </div>

      {/* Circulation Chart (Using Persimmon and Fern colors - strictly NO blue, NO black, NO gold) */}
      <div
        style={{
          backgroundColor: 'var(--milk)',
          border: '1.5px solid var(--ink-border)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
            Weekly Booking Reservations & Physical Handover Volume
          </h3>
          <div style={{ display: 'flex', gap: 16, fontSize: 'var(--text-xs)', color: 'var(--ink-soft)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--persimmon-500)' }} />
              Bookings Created
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--fern-500)' }} />
              Handovers Completed
            </span>
          </div>
        </div>

        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" stroke="var(--ink-soft)" fontSize={12} tickLine={false} />
              <YAxis stroke="var(--ink-soft)" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--milk)',
                  border: '1.5px solid var(--ink-border)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--ink)',
                }}
              />
              <Bar dataKey="bookings" fill="var(--persimmon-500)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="handovers" fill="var(--fern-500)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

