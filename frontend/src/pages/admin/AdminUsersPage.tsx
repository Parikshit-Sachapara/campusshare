import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  ShieldCheck,
  CheckCircle2,
  Ban,
  RotateCcw,
  Sliders,
  UserCheck,
} from 'lucide-react';
import { api } from '../../api/client';
import { UserProfile, UserRole } from '../../api/types';
import {
  Button,
  Badge,
  Modal,
  Select,
  Input,
  Textarea,
  Skeleton,
  EmptyState,
  useToast,
} from '../../components/ui';

export const AdminUsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Change Role Modal
  const [roleModalUser, setRoleModalUser] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('STUDENT');

  // Suspend/Reactivate Modal
  const [statusModalUser, setStatusModalUser] = useState<UserProfile | null>(null);
  const [statusReason, setStatusReason] = useState('');

  // 1. Fetch Users from Admin endpoint
  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ['admin-users-list', searchTerm, roleFilter],
    queryFn: () =>
      api.listAdminUsers({
        search: searchTerm || undefined,
        role: roleFilter !== 'ALL' ? (roleFilter as UserRole) : undefined,
        size: 50,
      }),
  });

  const users = usersData?.items || [];

  // Update Role mutation
  const roleMutation = useMutation({
    mutationFn: (data: { userId: string; role: UserRole }) =>
      api.updateUserRole(data.userId, data.role),
    onSuccess: (res) => {
      addToast({
        title: 'User Role Updated',
        message: `Account role updated to ${res.role}. Audited.`,
        variant: 'success',
      });
      setRoleModalUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
    },
  });

  // Verify Owner mutation
  const verifyMutation = useMutation({
    mutationFn: (userId: string) => api.verifyUser(userId),
    onSuccess: () => {
      addToast({
        title: 'Account Verified!',
        message: 'Owner credentials confirmed and active.',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
    },
  });

  // Suspend/Reactivate mutation
  const statusMutation = useMutation({
    mutationFn: (data: { userId: string; is_active: boolean; reason: string }) =>
      api.updateUserStatus(data.userId, data.is_active, data.reason),
    onSuccess: (res) => {
      addToast({
        title: res.is_active ? 'Account Reactivated' : 'Account Suspended',
        message: 'Audited in compliance log.',
        variant: res.is_active ? 'success' : 'warning',
      });
      setStatusModalUser(null);
      setStatusReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
          User Identity & <span className="squiggle-word">RBAC</span> Management
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
          Verified institutional accounts, role promotions, and auditable suspensions
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ink-mute)' }} />
          <input
            type="text"
            placeholder="Search users by name, campus email, or ID..."
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

        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          options={[
            { label: 'All Roles', value: 'ALL' },
            { label: 'Students', value: 'STUDENT' },
            { label: 'Lab Owners', value: 'OWNER' },
            { label: 'Facility Managers', value: 'MANAGER' },
            { label: 'Administrators', value: 'ADMIN' },
          ]}
        />
      </div>

      {/* User Table / Cards */}
      {isLoading ? (
        <Skeleton height={200} borderRadius="var(--radius-card)" />
      ) : users.length === 0 ? (
        <EmptyState
          title="No Users Found"
          description="Try adjusting your role filter or search term."
          actionLabel="Refresh List"
          onAction={() => refetch()}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {users.map((u) => (
            <div
              key={u.id}
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
                    {u.full_name}
                  </span>
                  <Badge
                    variant={
                      u.role === 'STUDENT'
                        ? 'persimmon'
                        : u.role === 'OWNER'
                        ? 'fern'
                        : u.role === 'MANAGER'
                        ? 'mulberry'
                        : 'lilac'
                    }
                  >
                    {u.role}
                  </Badge>
                  {u.is_verified ? (
                    <span style={{ fontSize: 11, color: 'var(--fern-600)', fontWeight: 600 }}>Verified</span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--apricot-600)', fontWeight: 600 }}>Pending Verification</span>
                  )}
                  {!u.is_active && <Badge variant="cherry">SUSPENDED</Badge>}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginTop: 2 }}>
                  {u.email} • Dept: {u.dept_id || 'General'} • No-shows: {u.no_show_count}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {/* Verify Owner Button */}
                {!u.is_verified && u.role === 'OWNER' && (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={verifyMutation.isPending}
                    onClick={() => verifyMutation.mutate(u.id)}
                    leftIcon={<UserCheck size={14} />}
                    style={{ backgroundColor: 'var(--fern-500)', borderColor: 'var(--fern-600)' }}
                  >
                    Verify Owner
                  </Button>
                )}

                {/* Change Role Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRoleModalUser(u);
                    setNewRole(u.role);
                  }}
                  leftIcon={<Sliders size={14} />}
                >
                  Change Role
                </Button>

                {/* Suspend / Reactivate Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusModalUser(u);
                    setStatusReason('');
                  }}
                  leftIcon={u.is_active ? <Ban size={14} /> : <RotateCcw size={14} />}
                  style={{ color: u.is_active ? 'var(--cherry-600)' : 'var(--fern-600)' }}
                >
                  {u.is_active ? 'Suspend' : 'Reactivate'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role Promotion Modal */}
      <Modal
        isOpen={Boolean(roleModalUser)}
        onClose={() => setRoleModalUser(null)}
        title="Promote or Reassign User Role"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Changing role alters permissions across catalog creation, reservation approvals, and disciplinary tools.
          </p>

          <Select
            label="Assigned Role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as UserRole)}
            options={[
              { label: 'STUDENT - Standard borrower', value: 'STUDENT' },
              { label: 'OWNER - Lab & equipment custodian', value: 'OWNER' },
              { label: 'MANAGER - Departmental operations & approvals', value: 'MANAGER' },
              { label: 'ADMIN - Full platform governance', value: 'ADMIN' },
            ]}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <Button variant="ghost" onClick={() => setRoleModalUser(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={roleMutation.isPending}
              onClick={() => roleModalUser && roleMutation.mutate({ userId: roleModalUser.id, role: newRole })}
              style={{ backgroundColor: 'var(--lilac-500)', borderColor: 'var(--lilac-400)' }}
            >
              Update Role
            </Button>
          </div>
        </div>
      </Modal>

      {/* Suspend / Reactivate Modal */}
      <Modal
        isOpen={Boolean(statusModalUser)}
        onClose={() => setStatusModalUser(null)}
        title={statusModalUser?.is_active ? 'Suspend User Standing' : 'Reactivate User Account'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            {statusModalUser?.is_active
              ? 'Suspending this user blocks all platform logins and active reservations. A mandatory reason is recorded in audit logs.'
              : 'Reactivating restores reservation standing and access.'}
          </p>

          <Textarea
            label="Mandatory Reason"
            placeholder="e.g. Unresolved missing oscilloscope case / Completed compliance meeting..."
            value={statusReason}
            onChange={(e) => setStatusReason(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <Button variant="ghost" onClick={() => setStatusModalUser(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!statusReason.trim()}
              loading={statusMutation.isPending}
              onClick={() =>
                statusModalUser &&
                statusMutation.mutate({
                  userId: statusModalUser.id,
                  is_active: !statusModalUser.is_active,
                  reason: statusReason,
                })
              }
              style={{
                backgroundColor: statusModalUser?.is_active ? 'var(--cherry-500)' : 'var(--fern-500)',
              }}
            >
              Confirm {statusModalUser?.is_active ? 'Suspension' : 'Reactivation'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

