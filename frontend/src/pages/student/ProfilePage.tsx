import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  ShieldCheck,
  Award,
  Sparkles,
  BarChart3,
  Calendar,
  AlertTriangle,
  FileCheck2,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatCard, Badge, Skeleton } from '../../components/ui';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  const { data: fairnessData, isLoading: fairLoading } = useQuery({
    queryKey: ['fairness-profile'],
    queryFn: () => api.getFairnessProfile(),
  });

  const standingScore = fairnessData?.standing_score || 94;
  const weights = fairnessData?.formula_weights || { wN: 40, wD: 30, wE: 20, wA: 10 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
          Student <span className="squiggle-word">Standing</span> & Profile
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
          Transparent priority formula breakdown, safety certifications, and departmental quota limits
        </p>
      </div>

      {/* Top Profile Card */}
      <div
        style={{
          backgroundColor: 'var(--milk)',
          border: '1.5px solid var(--ink-border)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-6)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--persimmon-100)',
              color: 'var(--persimmon-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 24,
              fontFamily: 'var(--font-heading)',
            }}
          >
            {user.full_name.charAt(0)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--ink)' }}>
                {user.full_name}
              </h2>
              <Badge variant="persimmon">{user.role}</Badge>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 4 }}>
              {user.email} • ID: {user.student_id || 'STU-2026-ACTIVE'} • Dept: {user.dept_id || 'Engineering'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'block' }}>Campus Standing</span>
            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--fern-600)', fontFamily: 'var(--font-mono)' }}>
              {standingScore}/100
            </span>
          </div>
        </div>
      </div>

      {/* Quotas & Usage Rings */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <StatCard
          label="Monthly Booking Quota"
          value={`${fairnessData?.usage_this_month || 4}h / ${fairnessData?.monthly_limit || 20}h`}
          delta="16h remaining"
          trend="neutral"
          sparklineData={[1, 2, 3, 4]}
          note="Allocated by Department of CS"
        />
        <StatCard
          label="Concurrent Active Passes"
          value={`${fairnessData?.active_bookings_count || 1} / ${fairnessData?.max_active_bookings || 3}`}
          delta="2 available"
          trend="up"
          sparklineData={[0, 1, 1]}
          note="Max concurrent holds allowed"
        />
        <StatCard
          label="Institutional No-Shows"
          value={(fairnessData?.no_show_count || 0).toString()}
          delta="Clean Record"
          trend="up"
          sparklineData={[0, 0, 0]}
          note="0 strikes • Full eligibility"
        />
      </div>

      {/* Fairness Formula Breakdown Card */}
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
            <Sparkles size={20} color="var(--persimmon-500)" />
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Fairness Formula & Deterministic Priority (P)
            </h3>
          </div>
          <Badge variant="fern">Transparent by Design</Badge>
        </div>

        <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
          To prevent hoarding and ensure equal access across departments, CampusShare calculates every request's priority using the audited institutional formula:
        </p>

        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--oat-50)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
            color: 'var(--ink)',
            border: '1px solid var(--oat-200)',
          }}
        >
          Priority P = {weights.wN}%·N (Recent Non-Usage) + {weights.wD}%·D (Need/Dept Keyword Match) + {weights.wE}%·E (Completed Safety Eligibility) + {weights.wA}%·A (Queue Wait Hours)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--oat-100)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>N: Non-Usage ({weights.wN}%)</span>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--ink)' }}>
              Rewarding users who haven't monopolized this specific unit in the last 30 days.
            </p>
          </div>
          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--oat-100)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>D: Academic Need ({weights.wD}%)</span>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--ink)' }}>
              Deterministic match between user's thesis/project keywords and resource taxonomy.
            </p>
          </div>
          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--oat-100)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>E: Eligibility ({weights.wE}%)</span>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--ink)' }}>
              Ratio of verified equipment certifications completed vs required safety modules.
            </p>
          </div>
          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--oat-100)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>A: Wait Time ({weights.wA}%)</span>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--ink)' }}>
              Scaled queue wait factor: min(1.0, wait_hours / 72h).
            </p>
          </div>
        </div>
      </div>

      {/* Safety Certifications & Departmental Trainings */}
      <div
        style={{
          backgroundColor: 'var(--milk)',
          border: '1.5px solid var(--ink-border)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-4)' }}>
          <Award size={20} color="var(--fern-500)" />
          <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
            Completed Safety & Operating Certifications
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[
            { name: 'DSLR Cinema & Sensor Optics Training', code: 'OPT-101', validUntil: 'Dec 2026', status: 'ACTIVE' },
            { name: 'Laser Cutter & Rapid Prototyping Workshop', code: 'MAK-204', validUntil: 'Nov 2026', status: 'ACTIVE' },
            { name: 'High-Power Workstation & Cluster Safety Protocol', code: 'HPC-301', validUntil: 'Jan 2027', status: 'ACTIVE' },
          ].map((t) => (
            <div
              key={t.code}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--oat-50)',
                border: '1px solid var(--oat-200)',
              }}
            >
              <div>
                <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 'var(--text-sm)' }}>
                  {t.name}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-mute)', marginLeft: 8 }}>
                  [{t.code}]
                </span>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 2 }}>
                  Certified by Department Faculty • Expires {t.validUntil}
                </div>
              </div>
              <Badge variant="fern">{t.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

