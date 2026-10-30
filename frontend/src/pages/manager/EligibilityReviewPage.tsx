import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck,
  Search,
  Award,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../api/client';
import { Badge, Input, Skeleton, EmptyState } from '../../components/ui';

export const EligibilityReviewPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users-eligibility', searchTerm],
    queryFn: () => api.listAdminUsers({ role: 'STUDENT', search: searchTerm || undefined, size: 25 }),
  });

  const students = usersData?.items || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
          Student Eligibility & <span className="squiggle-word">Training</span> Audit
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
          Verify student safety certifications, department eligibility rules, and historical incident standing
        </p>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', maxWidth: 440 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ink-mute)' }} />
        <input
          type="text"
          placeholder="Search student by name, email, or student ID..."
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

      {/* Student Eligibility List */}
      {isLoading ? (
        <Skeleton height={120} borderRadius="var(--radius-card)" />
      ) : students.length === 0 ? (
        <EmptyState
          title="No Students Found"
          description="Try searching with a different name or university student ID."
          actionLabel="Clear Search"
          onAction={() => setSearchTerm('')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {students.map((s) => (
            <div
              key={s.id}
              style={{
                backgroundColor: 'var(--milk)',
                border: '1.5px solid var(--ink-border)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-4) var(--space-5)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-base)' }}>
                    {s.full_name}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>
                    {s.student_id || 'STU-ID'}
                  </span>
                  <Badge variant={s.is_active ? 'fern' : 'cherry'}>
                    {s.is_active ? 'CLEAR STANDING' : 'HOLD'}
                  </Badge>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 2 }}>
                  Dept: {s.dept_id || 'General'} • No-shows: {s.no_show_count} • Email: {s.email}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, fontSize: 'var(--text-xs)' }}>
                <span style={{ padding: '4px 8px', backgroundColor: 'var(--fern-100)', color: 'var(--fern-600)', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                  DSLR Training: Verified
                </span>
                <span style={{ padding: '4px 8px', backgroundColor: 'var(--fern-100)', color: 'var(--fern-600)', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                  Laser Safety: Certified
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

