import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  MessageSquare,
  Send,
  Eye,
  Camera,
  FileCheck2,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Incident, IncidentStatus } from '../../api/types';
import {
  Button,
  Badge,
  Modal,
  Select,
  Textarea,
  Input,
  Skeleton,
  EmptyState,
  useToast,
} from '../../components/ui';

export const IncidentReviewPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [commentInput, setCommentInput] = useState('');

  // Resolution modal state
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<IncidentStatus>('RESOLVED');
  const [resolutionText, setResolutionText] = useState('');
  const [applyRestriction, setApplyRestriction] = useState(false);
  const [restrictionReason, setRestrictionReason] = useState('');

  // 1. Fetch Incidents
  const { data: incidentsData, isLoading, refetch } = useQuery({
    queryKey: ['manager-incidents'],
    queryFn: () => api.listIncidents({ size: 50 }),
  });

  const incidents = incidentsData?.items || [];

  // Update Status / Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: (data: { id: string; status: IncidentStatus; resolution?: string }) =>
      api.updateIncidentStatus(data.id, { status: data.status, resolution: data.resolution }),
    onSuccess: () => {
      addToast({
        title: 'Incident Resolved & Closed',
        message: 'Resolution explanation recorded in permanent audit logs.',
        variant: 'success',
      });
      setResolveModalOpen(false);
      setResolutionText('');
      setSelectedIncident(null);
      queryClient.invalidateQueries({ queryKey: ['manager-incidents'] });
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Resolution Failed',
        message: (err as Error).message,
        variant: 'danger',
      });
    },
  });

  // Post comment mutation
  const commentMutation = useMutation({
    mutationFn: (data: { id: string; comment: string }) =>
      api.addIncidentComment(data.id, data.comment),
    onSuccess: () => {
      addToast({ title: 'Comment Posted', variant: 'success' });
      setCommentInput('');
      queryClient.invalidateQueries({ queryKey: ['manager-incidents'] });
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Badge variant="mulberry">INCIDENT REVIEW & DISCIPLINARY RESOLUTION</Badge>
        </div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
          Campus Incident <span className="squiggle-word">Review</span>
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
          Investigate physical damages, missing assets, and late returns with private evidence viewing and audited resolutions
        </p>
      </div>

      {isLoading ? (
        <Skeleton height={140} borderRadius="var(--radius-card)" />
      ) : incidents.length === 0 ? (
        <EmptyState
          title="All Incidents Resolved"
          description="There are no open incident investigations or damage reports requiring managerial review."
          actionLabel="Refresh"
          onAction={() => refetch()}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedIncident ? '1fr 1.3fr' : '1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
          {/* Incident List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {incidents.map((inc) => {
              const isSelected = selectedIncident?.id === inc.id;
              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  style={{
                    backgroundColor: isSelected ? 'var(--mulberry-100)' : 'var(--milk)',
                    border: isSelected ? '2px solid var(--mulberry-500)' : '1.5px solid var(--ink-border)',
                    borderRadius: 'var(--radius-card)',
                    padding: 'var(--space-4) var(--space-5)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: inc.status === 'RESOLVED' ? 'var(--fern-100)' : 'var(--cherry-100)',
                        color: inc.status === 'RESOLVED' ? 'var(--fern-600)' : 'var(--cherry-600)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-sm)', display: 'block' }}>
                        {inc.resource_name || 'Equipment Unit'}
                      </span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)' }}>
                        Type: {inc.type} • Severity: {inc.severity}
                      </span>
                    </div>
                  </div>
                  <Badge variant={inc.status === 'RESOLVED' ? 'fern' : 'cherry'}>
                    {inc.status}
                  </Badge>
                </div>
              );
            })}
          </div>

          {/* Incident Investigation & Resolution Panel */}
          {selectedIncident && (
            <div
              style={{
                backgroundColor: 'var(--milk)',
                border: '1.5px solid var(--ink-border)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-5)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
                  Case #{selectedIncident.id.slice(0, 8)}: {selectedIncident.resource_name}
                </h3>
                <Badge variant={selectedIncident.status === 'RESOLVED' ? 'fern' : 'cherry'}>
                  {selectedIncident.status}
                </Badge>
              </div>

              {/* Case Details */}
              <div
                style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--oat-50)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--oat-200)',
                  fontSize: 'var(--text-xs)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div><strong>Reporter:</strong> {selectedIncident.reporter_name || 'Authorized Staff'}</div>
                <div><strong>Incident Type:</strong> {selectedIncident.type} • <strong>Severity:</strong> {selectedIncident.severity}</div>
                <div><strong>Description:</strong> {selectedIncident.description}</div>
                {selectedIncident.resolution && (
                  <div style={{ marginTop: 4, color: 'var(--fern-600)', fontWeight: 600 }}>
                    Official Resolution: {selectedIncident.resolution}
                  </div>
                )}
              </div>

              {/* Private Evidence Photos Notice */}
              <div>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
                  Secured Evidence Photos (5-Minute HMAC Token Protected)
                </span>
                {selectedIncident.evidence_urls && selectedIncident.evidence_urls.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedIncident.evidence_urls.map((photo, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--oat-100)',
                          fontSize: 'var(--text-xs)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Camera size={14} color="var(--mulberry-500)" />
                        <span>Evidence #{i + 1}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-mute)' }}>
                    No photos attached to this incident.
                  </span>
                )}
              </div>

              {/* Comments & Updates Thread */}
              <div>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
                  Investigation Thread & Notes
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Input
                    placeholder="Add an investigation note or update..."
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={!commentInput.trim()}
                    loading={commentMutation.isPending}
                    onClick={() =>
                      commentMutation.mutate({
                        id: selectedIncident.id,
                        comment: commentInput,
                      })
                    }
                    rightIcon={<Send size={14} />}
                  >
                    Post
                  </Button>
                </div>
              </div>

              {/* Resolution Action */}
              {selectedIncident.status !== 'CLOSED' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--oat-200)', paddingTop: 'var(--space-4)' }}>
                  <Button
                    variant="primary"
                    onClick={() => setResolveModalOpen(true)}
                    leftIcon={<CheckCircle2 size={16} />}
                    style={{ backgroundColor: 'var(--mulberry-500)', borderColor: 'var(--mulberry-600)' }}
                  >
                    Resolve & Close Case
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resolution Dialog */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Formal Incident Resolution"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Only Facility Managers or Administrators can resolve incidents. A detailed resolution explanation is strictly mandatory.
          </p>

          <Select
            label="Final Status"
            value={targetStatus}
            onChange={(e) => setTargetStatus(e.target.value as IncidentStatus)}
            options={[
              { label: 'RESOLVED - Issue inspected and remediated', value: 'RESOLVED' },
              { label: 'CLOSED - Investigation finalized and archived', value: 'CLOSED' },
            ]}
          />

          <Textarea
            label="Mandatory Resolution Explanation"
            placeholder="e.g. Lab staff inspected equipment; damage was covered under manufacturer warranty. Student given refresher guidance..."
            value={resolutionText}
            onChange={(e) => setResolutionText(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <Button variant="ghost" onClick={() => setResolveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!resolutionText.trim()}
              loading={resolveMutation.isPending}
              onClick={() => {
                if (!selectedIncident) return;
                resolveMutation.mutate({
                  id: selectedIncident.id,
                  status: targetStatus,
                  resolution: resolutionText,
                });
              }}
              style={{ backgroundColor: 'var(--mulberry-500)' }}
            >
              Sign & Finalize Resolution
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

