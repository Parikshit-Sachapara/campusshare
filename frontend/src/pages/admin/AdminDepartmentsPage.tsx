import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  PlusCircle,
  Edit,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../api/client';
import { Department } from '../../api/types';
import {
  Button,
  Input,
  Textarea,
  Modal,
  ConfirmModal,
  Skeleton,
  EmptyState,
  useToast,
} from '../../components/ui';

export const AdminDepartmentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // 1. Fetch departments
  const { data: departments, isLoading, refetch } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.listDepartments(),
  });

  // Create / Update mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      if (editingDept) {
        return api.updateDepartment(editingDept.id, { name, code, description });
      }
      return api.createDepartment({ name, code, description });
    },
    onSuccess: () => {
      addToast({
        title: editingDept ? 'Department Updated' : 'Department Created',
        variant: 'success',
      });
      setModalOpen(false);
      setName('');
      setCode('');
      setDescription('');
      setEditingDept(null);
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDepartment(id),
    onSuccess: () => {
      addToast({ title: 'Department Removed', variant: 'neutral' });
      setDeleteTargetId(null);
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  const handleOpenEdit = (d: Department) => {
    setEditingDept(d);
    setName(d.name);
    setCode(d.code);
    setDescription(d.description || '');
    setModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingDept(null);
    setName('');
    setCode('');
    setDescription('');
    setModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
            Academic <span className="squiggle-word">Departments</span>
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Manage university faculties, discipline codes, and departmental resource ownership
          </p>
        </div>

        <Button variant="primary" size="md" onClick={handleOpenCreate} leftIcon={<PlusCircle size={16} />} style={{ backgroundColor: 'var(--lilac-500)', borderColor: 'var(--lilac-400)' }}>
          Add Department
        </Button>
      </div>

      {isLoading ? (
        <Skeleton height={140} borderRadius="var(--radius-card)" />
      ) : departments && departments.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {departments.map((d) => (
            <div
              key={d.id}
              style={{
                backgroundColor: 'var(--milk)',
                border: '1.5px solid var(--ink-border)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-4) var(--space-5)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-base)' }}>
                    {d.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--ink-mute)', backgroundColor: 'var(--oat-100)', padding: '2px 8px', borderRadius: 4 }}>
                    {d.code}
                  </span>
                </div>
                {d.description && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 2 }}>
                    {d.description}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(d)}>
                  <Edit size={15} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteTargetId(d.id)} style={{ color: 'var(--cherry-600)' }}>
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No Departments Created"
          description="Click Add Department to configure your university faculty divisions."
          actionLabel="Add Department"
          onAction={handleOpenCreate}
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDept ? 'Edit Academic Department' : 'Create Academic Department'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Department Name" placeholder="e.g. Mechanical Engineering" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Code (Unique)" placeholder="e.g. MECH" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <Textarea label="Description" placeholder="Optional discipline overview..." value={description} onChange={(e) => setDescription(e.target.value)} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!name.trim() || !code.trim()}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              style={{ backgroundColor: 'var(--lilac-500)' }}
            >
              {editingDept ? 'Update Department' : 'Create Department'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="Delete Department?"
        message="This action will permanently delete the departmental entry."
        confirmLabel="Yes, Delete Department"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTargetId && deleteMutation.mutate(deleteTargetId)}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};

