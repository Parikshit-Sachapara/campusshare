import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ShieldAlert,
  MessageSquare,
  Eye,
  Send,
  Clock,
} from 'lucide-react';
import { api } from '../../api/client';
import { Incident } from '../../api/types';
import {
  Button,
  Badge,
  Textarea,
  Modal,
  Skeleton,
  EmptyState,
  useToast,
} from '../../components/ui';

export const OwnerIncidentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [commentText, setCommentText] = useState('');

  // 1. Fetch Incidents
  const { data: incidentsData, isLoading, refetch } = useQuery({
    queryKey: ['owner-incidents'],
    queryFn: () => api.listIncidents({ size: 50 }),
  });

  const incidents = incidentsData?.items || [];

  // Add Comment mutation
  const commentMutation = useMutation({
    mutationFn: (data: { id: string; comment: string }) =>
      api.addIncidentComment(data.id, data.comment),
    onSuccess: () => {
      addToast({
        title: 'Comment Posted',
        variant: 'success',
      });
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['owner-incidents'] });
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
          Asset Incidents & <span className="squiggle-word">Accountability</span>
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
          Track damage flags, missing items, and condition reports filed during physical check-out or return
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Skeleton height={90} borderRadius="var(--radius-card)" />
          <Skeleton height={90} borderRadius="var(--radius-card)" />
        </div>
      ) : incidents.length === 0 ? (
        <EmptyState
          title="No Active Incidents"
          description="All equipment units are in good standing with zero unresolved damage flags."
          actionLabel="Refresh"
          onAction={() => refetch()}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {incidents.map((inc) => (
            <div
              key={inc.id}
              onClick={() => setSelectedIncident(inc)}
              style={{
                backgroundColor: 'var(--milk)',
                border: '1.5px solid var(--ink-border)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-5)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--cherry-100)',
                    color: 'var(--cherry-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-base)' }}>
                      {inc.resource_name || 'Equipment Unit'}
                    </span>
                    <Badge variant={inc.status === 'RESOLVED' ? 'fern' : 'cherry'}>
                      {inc.status}
                    </Badge>
                  </div>
                  <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
                    Type: {inc.type} • Severity: {inc.severity} • {inc.description}
                  </p>
                </div>
              </div>

              <Button variant="ghost" size="sm">
                View Thread &rarr;
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Incident Discussion & Evidence Modal */}
      <Modal
        isOpen={Boolean(selectedIncident)}
        onClose={() => setSelectedIncident(null)}
        title="Incident Report & Investigation"
      >
        {selectedIncident && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--oat-50)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{selectedIncident.resource_name}</div>
              <div style={{ color: 'var(--ink-soft)', marginTop: 2 }}>{selectedIncident.description}</div>
              {selectedIncident.resolution && (
                <div style={{ marginTop: 6, color: 'var(--fern-600)', fontWeight: 600 }}>
                  Resolution: {selectedIncident.resolution}
                </div>
              )}
            </div>

            {/* Evidence photos note */}
            {selectedIncident.evidence_urls && selectedIncident.evidence_urls.length > 0 && (
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>
                  Secured Evidence Photos (5-Minute Authorized Tokens)
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {selectedIncident.evidence_urls.map((file, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'var(--oat-100)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 11,
                        color: 'var(--ink)',
                      }}
                    >
                      Photo #{i + 1}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Add Comment */}
            <div>
              <Textarea
                placeholder="Add an update to this incident thread..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!commentText.trim()}
                  loading={commentMutation.isPending}
                  onClick={() =>
                    commentMutation.mutate({
                      id: selectedIncident.id,
                      comment: commentText,
                    })
                  }
                  rightIcon={<Send size={14} />}
                >
                  Post Comment
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

