import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Package,
  PlusCircle,
  ToggleLeft,
  ToggleRight,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ResourceItem, ResourceStatus } from '../../api/types';
import {
  Button,
  Badge,
  Skeleton,
  EmptyState,
  ConfirmModal,
  useToast,
} from '../../components/ui';

export const OwnerResourcesPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // 1. Fetch Resources
  const { data: resourcesData, isLoading, refetch } = useQuery({
    queryKey: ['my-managed-resources'],
    queryFn: () => api.listResources({ owner_id: user.id, size: 50 }),
  });

  // 2. Toggle Status Mutation (AVAILABLE vs MAINTENANCE)
  const toggleStatusMutation = useMutation({
    mutationFn: (data: { id: string; status: ResourceStatus }) =>
      api.updateResource(data.id, { status: data.status }),
    onSuccess: (updated) => {
      addToast({
        title: `Resource Status: ${updated.status}`,
        message: `${updated.name} is now ${updated.status.toLowerCase()}.`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['my-managed-resources'] });
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Status Update Failed',
        message: (err as Error).message,
        variant: 'danger',
      });
    },
  });

  // 3. Delete / Archive Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteResource(id),
    onSuccess: () => {
      addToast({
        title: 'Resource Archived',
        message: 'The asset has been removed from active student reservation.',
        variant: 'neutral',
      });
      setDeleteTargetId(null);
      queryClient.invalidateQueries({ queryKey: ['my-managed-resources'] });
    },
  });

  const resources = resourcesData?.items || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
            My Managed <span className="squiggle-word">Assets</span>
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Departmental lab equipment, rooms, and live availability controls
          </p>
        </div>

        <Link to="/resources/new">
          <Button variant="primary" size="md" leftIcon={<PlusCircle size={16} />}>
            Add New Resource
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Skeleton height={80} borderRadius="var(--radius-card)" />
          <Skeleton height={80} borderRadius="var(--radius-card)" />
        </div>
      ) : resources.length === 0 ? (
        <EmptyState
          title="No Resources Found"
          description="You haven't registered any departmental equipment or facilities yet."
          actionLabel="Add Your First Resource"
          onAction={() => {}}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {resources.map((r) => {
            const isAvailable = r.status === 'AVAILABLE';
            return (
              <div
                key={r.id}
                style={{
                  backgroundColor: 'var(--milk)',
                  border: '1.5px solid var(--ink-border)',
                  borderRadius: 'var(--radius-card)',
                  padding: 'var(--space-4) var(--space-5)',
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
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--oat-100)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Package size={22} color="var(--fern-600)" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-base)' }}>
                        {r.name}
                      </span>
                      <Badge variant={r.resource_type === 'EQUIPMENT' ? 'persimmon' : 'mulberry'}>
                        {r.resource_type}
                      </Badge>
                      <Badge variant={isAvailable ? 'fern' : 'apricot'}>{r.status}</Badge>
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 2 }}>
                      {r.location} • Available Units: {r.available_quantity} / {r.quantity} • Popularity: {r.popularity_count || 0} borrows
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  {/* Status Toggle Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={toggleStatusMutation.isPending}
                    onClick={() =>
                      toggleStatusMutation.mutate({
                        id: r.id,
                        status: isAvailable ? 'MAINTENANCE' : 'AVAILABLE',
                      })
                    }
                    leftIcon={isAvailable ? <ToggleRight size={18} color="var(--fern-600)" /> : <ToggleLeft size={18} color="var(--ink-mute)" />}
                  >
                    {isAvailable ? 'Active' : 'Maintenance'}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTargetId(r.id)}
                    style={{ color: 'var(--cherry-600)' }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete/Archive Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="Archive This Resource?"
        message="Archiving will remove this equipment from public marketplace discovery while preserving historical audit logs."
        confirmLabel="Yes, Archive Asset"
        cancelLabel="Keep Active"
        isDestructive={true}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTargetId && deleteMutation.mutate(deleteTargetId)}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};

