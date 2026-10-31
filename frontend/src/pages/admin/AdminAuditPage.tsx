import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileCheck2,
  Download,
  Search,
  Filter,
  ShieldCheck,
  Lock,
  RefreshCw,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Button,
  Badge,
  Skeleton,
  EmptyState,
} from '../../components/ui';

interface AuditLogItem {
  id: string | number;
  action: string;
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  entity_type: string;
  entity_id?: string;
  resource_id?: string;
  booking_id?: string;
  created_at?: string;
  timestamp?: string;
  narrative?: string;
  ip?: string;
  audit_metadata?: Record<string, unknown>;
}

export const AdminAuditPage: React.FC = () => {
  const { role, setRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const { data: auditData, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-audit-logs', actionFilter],
    queryFn: () => api.listAuditLogs({ action: actionFilter || undefined, size: 50 }),
    retry: 1,
    staleTime: 10000,
  });

  const rawLogs = (auditData?.items as AuditLogItem[]) || [];
  const logs = rawLogs.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const action = (log.action || '').toLowerCase();
    const entity = (log.entity_type || '').toLowerCase();
    const narrative = (log.narrative || '').toLowerCase();
    const actor = (log.actor_name || log.actor_role || '').toLowerCase();
    return action.includes(term) || entity.includes(term) || narrative.includes(term) || actor.includes(term);
  });

  const handleDownloadCSV = () => {
    const apiBase = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
    window.open(`${apiBase}/audit?format=csv`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Role Notice if not Admin */}
      {role !== 'ADMIN' && (
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
            <AlertTriangle size={20} color="var(--apricot-600)" />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-sm)' }}>
                Administrator Audit Vault
              </div>
              <div style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
                You are currently previewing as <strong>{role}</strong>. For live append-only trigger access, switch to the Admin persona.
              </div>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setRole('ADMIN')}
            leftIcon={<UserCheck size={14} />}
          >
            Switch to Admin Persona
          </Button>
        </div>
      )}

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
            Cryptographically chained events for every slot reservation, physical handover scan, return inspection, and priority override.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button
            variant="secondary"
            size="md"
            onClick={() => refetch()}
            leftIcon={<RefreshCw size={15} />}
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={handleDownloadCSV}
            leftIcon={<Download size={15} />}
          >
            Download CSV
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
          backgroundColor: 'var(--milk)',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-card)',
          border: '1.5px solid var(--ink-border)',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 240px', display: 'flex', alignItems: 'center' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--ink-mute)' }} />
          <input
            type="text"
            placeholder="Search action, actor, or entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--ink-border)',
              backgroundColor: 'var(--oat-50)',
              color: 'var(--ink)',
              fontSize: 'var(--text-sm)',
              outline: 'none',
            }}
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1.5px solid var(--ink-border)',
            backgroundColor: 'var(--oat-50)',
            color: 'var(--ink)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">All Actions</option>
          <option value="BOOKING_">Bookings & Reservations</option>
          <option value="HANDOVER_">Physical Handover</option>
          <option value="RETURN_">Return Verification</option>
          <option value="INCIDENT_">Incidents & Violations</option>
          <option value="USER_">User Authentication</option>
        </select>
      </div>

      {/* Audit Log Stream */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Skeleton height={64} borderRadius="var(--radius-md)" />
          <Skeleton height={64} borderRadius="var(--radius-md)" />
          <Skeleton height={64} borderRadius="var(--radius-md)" />
        </div>
      ) : isError ? (
        <EmptyState
          title="Could Not Load Audit Stream"
          description="The institutional database requires Administrator authorization to stream audit logs."
          actionLabel="Retry Stream"
          onAction={() => refetch()}
        />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No Audit Records Found"
          description="No append-only audit events matched your search criteria."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchTerm('');
            setActionFilter('');
          }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {logs.map((log) => {
            const logIdStr = String(log.id ?? '');
            const actionStr = (log.action || 'EVENT').replace(/_/g, ' ');
            const timestampRaw = log.created_at || log.timestamp;
            const formattedDate = timestampRaw
              ? new Date(timestampRaw).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : 'Recently Recorded';

            return (
              <div
                key={logIdStr || Math.random().toString()}
                style={{
                  backgroundColor: 'var(--milk)',
                  border: '1.5px solid var(--ink-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 'var(--text-xs)',
                  gap: 'var(--space-3)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
                      {actionStr}
                    </span>
                    <Badge variant="oat">{log.actor_role || 'SYSTEM'}</Badge>
                    <span style={{ color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>
                      Entity: {log.entity_type} {log.entity_id ? `(#${String(log.entity_id).slice(0, 8)})` : ''}
                    </span>
                  </div>
                  {log.narrative && (
                    <div style={{ color: 'var(--ink)', marginTop: 4, fontSize: 'var(--text-sm)' }}>
                      {log.narrative}
                    </div>
                  )}
                  <div style={{ color: 'var(--ink-soft)', marginTop: 2, fontSize: 11 }}>
                    Timestamp: {formattedDate} {log.ip ? `• IP: ${log.ip}` : ''}
                  </div>
                </div>

                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--ink-mute)',
                    fontSize: 11,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  LOG #{logIdStr.slice(0, 8)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
