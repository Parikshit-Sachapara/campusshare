import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  PlusCircle,
  Edit,
  Trash2,
} from 'lucide-react';
import { api } from '../../api/client';
import { ResourceCategory } from '../../api/types';
import {
  Button,
  Input,
  Modal,
  ConfirmModal,
  Skeleton,
  EmptyState,
  CategoryIcon,
  ResourceCategory as IconCat,
  useToast,
} from '../../components/ui';

export const AdminCategoriesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ResourceCategory | null>(null);
  const [name, setName] = useState('');
  const [iconKey, setIconKey] = useState('Computing');
  const [sortOrder, setSortOrder] = useState(0);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // 1. Fetch categories
  const { data: categories, isLoading, refetch } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.listCategories(),
  });

  // Create / Update mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      if (editingCat) {
        return api.updateCategory(editingCat.id, { name, icon_key: iconKey, sort_order: sortOrder });
      }
      return api.createCategory({ name, icon_key: iconKey, sort_order: sortOrder });
    },
    onSuccess: () => {
      addToast({
        title: editingCat ? 'Category Updated' : 'Category Created',
        variant: 'success',
      });
      setModalOpen(false);
      setName('');
      setEditingCat(null);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => {
      addToast({ title: 'Category Removed', variant: 'neutral' });
      setDeleteTargetId(null);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const handleOpenEdit = (c: ResourceCategory) => {
    setEditingCat(c);
    setName(c.name);
    setIconKey(c.icon_key);
    setSortOrder(c.sort_order);
    setModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingCat(null);
    setName('');
    setIconKey('Computing');
    setSortOrder((categories?.length || 0) + 1);
    setModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
            Resource <span className="squiggle-word">Taxonomy</span> Categories
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Classify and tag equipment, laboratories, computing clusters, and multimedia suites
          </p>
        </div>

        <Button variant="primary" size="md" onClick={handleOpenCreate} leftIcon={<PlusCircle size={16} />} style={{ backgroundColor: 'var(--lilac-500)', borderColor: 'var(--lilac-400)' }}>
          Add Category
        </Button>
      </div>

      {isLoading ? (
        <Skeleton height={140} borderRadius="var(--radius-card)" />
      ) : categories && categories.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
          {categories.map((c) => (
            <div
              key={c.id}
              style={{
                backgroundColor: 'var(--milk)',
                border: '1.5px solid var(--ink-border)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--persimmon-100)',
                    color: 'var(--persimmon-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CategoryIcon category={(c.name as IconCat) || 'Computing'} size={18} />
                </div>
                <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 'var(--text-sm)' }}>
                  {c.name}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 4 }}>
                <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(c)}>
                  <Edit size={14} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteTargetId(c.id)} style={{ color: 'var(--cherry-600)' }}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No Categories Configured"
          description="Create categories to power Marketplace search filters."
          actionLabel="Create Category"
          onAction={handleOpenCreate}
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCat ? 'Edit Category' : 'Create Category'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Category Name" placeholder="e.g. Robotics & Quadrotors" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Sort Order" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              style={{ backgroundColor: 'var(--lilac-500)' }}
            >
              {editingCat ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="Delete Category?"
        message="This action will remove this category classification from marketplace filters."
        confirmLabel="Yes, Delete Category"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTargetId && deleteMutation.mutate(deleteTargetId)}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};

