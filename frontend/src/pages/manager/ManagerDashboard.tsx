import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Building,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../api/client';
import { StatCard, Button, Badge, Skeleton } from '../../components/ui';

export const ManagerDashboard: React.FC = () => {
  const { data: queueData } = useQuery({ queryKey: ['manager-queue'], queryFn: () => api.getApprovalQueue() });
  const { data: incidentsData } = useQuery({ queryKey: ['manager-incidents'], queryFn: () => api.listIncidents() });
  const { data: statsData } = useQuery({ queryKey: ['public-stats'], queryFn: () => api.getPublicStats() });

  const pendingApprovals = queueData?.items || [];
  const incidents = incidentsData?.items || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Badge variant="mulberry">CENTRAL OPERATIONS</Badge>
          </div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
            Facility Operations <span className="squiggle-word">Console</span>
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Institutional governance, conflict resolution, and high-priority escalation review
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Link to="/approvals">
            <Button variant="primary" size="md" leftIcon={<Layers size={16} />} style={{ backgroundColor: 'var(--mulberry-500)', borderColor: 'var(--mulberry-600)' }}>
              Approval Queue ({pendingApprovals.length})
            </Button>
          </Link>
          <Link to="/incidents">
            <Button variant="secondary" size="md" leftIcon={<AlertTriangle size={16} />}>
              Review Incidents ({incidents.length})
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <StatCard
          label="Pending Queue"
          value={pendingApprovals.length.toString()}
          delta="Awaiting Decision"
          trend="neutral"
          sparklineData={[3, 5, 4, pendingApprovals.length]}
          note="Priority score ordered"
        />
        <StatCard
          label="Active Incidents"
          value={incidents.length.toString()}
          delta="Requires Resolution"
          trend="neutral"
          sparklineData={[1, 2, incidents.length]}
          note="Damage & late return cases"
        />
        <StatCard
          label="Campus Utilization"
          value={`${statsData?.utilization_rate || 87.4}%`}
          delta="+12.4% this term"
          trend="up"
          sparklineData={[70, 75, 82, 87.4]}
          note="Across 9 specialized labs"
        />
        <StatCard
          label="Active Borrowers"
          value={(statsData?.active_users || 620).toString()}
          delta="Verified"
          trend="up"
          sparklineData={[500, 540, 590, 620]}
          note="Students and faculty"
        />
      </div>

      {/* Queue Preview Card */}
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
          <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
            High-Priority Requests Pending Resolution
          </h3>
          <Link to="/approvals" style={{ color: 'var(--mulberry-500)', fontSize: 'var(--text-xs)', fontWeight: 600, textDecoration: 'none' }}>
            Open full queue &rarr;
          </Link>
        </div>

        {pendingApprovals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            All requests have been evaluated.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {pendingApprovals.slice(0, 3).map((b) => (
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
                  <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-sm)' }}>
                    {b.student_name} &bull; {b.resource_name}
                  </span>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 2 }}>
                    Purpose: {b.purpose}
                  </div>
                </div>
                <Badge variant="mulberry">Priority {b.priority_score?.toFixed(1) || '85.0'}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

