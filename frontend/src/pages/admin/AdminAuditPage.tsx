import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileCheck2,
  Download,
  Search,
  Filter,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { api } from '../../api/client';
import {
  Button,
  Badge,
  Skeleton,
  EmptyState,
} from '../../components/ui';

export const AdminAuditPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const { data: auditData, isLoading, refetch } = useQuery({
    queryKey: ['admin-audit-logs', actionFilter],
    queryFn: () => api.listAuditLogs({ action: actionFilter || undefined, size: 50 }),
  });

  const logs = (auditData?.items as {
    id: string;
    action: string;
    actor_id: string;
    actor_role: string;
    entity_type: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }[]) || [];

  const handleDownloadCSV = () => {
    window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/audit?export=csv`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Lock size={14} color="var(--fern-600)" />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--fern-600)', letterSpacing: '0.05em' }}>
              POSTGRESQL APPEND-ONLY TRIGGER PROTECTED
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
            Institutional <span className="squiggle-word">Audit</span> Trail
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Immutable event logs for every reservation, physical handover, return inspection, and priority override
          </p>
        </div>

        <Button
          variant="secondary"
          size="md"
          onClick={handleDownloadCSV}
          leftIcon={<Download size={16} />}
        >
          Download Compliance CSV
        </Button>
      </div>

      {/* Audit Log Stream */}
      {isLoading ? (
        <Skeleton height={200} borderRadius="var(--radius-card)" />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No Audit Logs Recorded"
          description="Actions performed on the platform will append cryptographic events here."
          actionLabel="Refresh Audit"
          onAction={() => refetch()}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {logs.map((log) => (
            <div
              key={log.id}
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
                    {log.action.replace(/_/g, ' ')}
                  </span>
                  <Badge variant="oat">{log.actor_role}</Badge>
                  <span style={{ color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>
                    Entity: {log.entity_type}
                  </span>
                </div>
                <div style={{ color: 'var(--ink-soft)', marginTop: 2 }}>
                  Timestamp: {new Date(log.timestamp).toLocaleString('en-US')}
                </div>
              </div>

              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)', fontSize: 11 }}>
                Log ID: {log.id.slice(0, 8)}...
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
