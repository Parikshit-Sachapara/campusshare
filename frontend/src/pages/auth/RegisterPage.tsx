import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { UserCheck, Building2, UserPlus, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { Button, Input, Select, useToast } from '../../components/ui';

const registerSchema = z.object({
  role: z.enum(['STUDENT', 'OWNER']),
  email: z.string().email('Please enter a valid campus email address'),
  password: z.string().min(8, 'Password must be at least 8 characters with a number/symbol'),
  full_name: z.string().min(2, 'Full name is required'),
  dept_id: z.string().min(1, 'Please select your academic department'),
  student_id: z.string().optional(),
  phone: z.string().optional(),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [selectedRole, setSelectedRole] = useState<'STUDENT' | 'OWNER'>('STUDENT');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.listDepartments(),
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'STUDENT',
      dept_id: '',
      student_id: '',
      phone: '',
    },
  });

  const handleRoleToggle = (r: 'STUDENT' | 'OWNER') => {
    setSelectedRole(r);
    setValue('role', r);
  };

  const onSubmit = async (data: RegisterFormData) => {
    setErrorMsg(null);
    try {
      await api.register({
        ...data,
        role: selectedRole,
      });

      addToast({
        title: 'Registration Successful!',
        message: selectedRole === 'OWNER'
          ? 'Owner account created. An administrator will verify your faculty/lab credentials shortly.'
          : 'Student account created. You can now log in immediately.',
        variant: 'success',
      });

      navigate('/login');
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Registration failed. Check details.';
      setErrorMsg(msg);
      addToast({
        title: 'Registration Failed',
        message: msg,
        variant: 'danger',
      });
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--oat-50)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 'var(--space-6)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 500,
          backgroundColor: 'var(--milk)',
          border: '1.5px solid var(--ink-border)',
          borderRadius: 'var(--radius-card)',
          boxShadow: '0 8px 30px rgba(29, 43, 37, 0.06)',
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              textDecoration: 'none',
              marginBottom: 'var(--space-2)',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--persimmon-500)',
                color: 'var(--milk)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                fontSize: 16,
              }}
            >
              CS
            </div>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                fontSize: 22,
                color: 'var(--ink)',
              }}
            >
              CampusShare
            </span>
          </Link>
          <h2 style={{ margin: 'var(--space-1) 0', fontSize: 'var(--text-xl)', color: 'var(--ink)' }}>
            Join Campus Commons
          </h2>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Self-register with your university credentials
          </p>
        </div>

        {/* Role Toggle */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-2)',
            backgroundColor: 'var(--oat-100)',
            padding: 4,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--oat-200)',
          }}
        >
          <button
            type="button"
            onClick={() => handleRoleToggle('STUDENT')}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: selectedRole === 'STUDENT' ? '1.5px solid var(--persimmon-500)' : 'none',
              backgroundColor: selectedRole === 'STUDENT' ? 'var(--milk)' : 'transparent',
              color: selectedRole === 'STUDENT' ? 'var(--persimmon-600)' : 'var(--ink-soft)',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <UserCheck size={16} />
            Student
          </button>
          <button
            type="button"
            onClick={() => handleRoleToggle('OWNER')}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: selectedRole === 'OWNER' ? '1.5px solid var(--fern-500)' : 'none',
              backgroundColor: selectedRole === 'OWNER' ? 'var(--milk)' : 'transparent',
              color: selectedRole === 'OWNER' ? 'var(--fern-600)' : 'var(--ink-soft)',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Building2 size={16} />
            Lab / Faculty Owner
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--cherry-100)',
              border: '1px solid var(--cherry-500)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--cherry-600)',
              fontSize: 'var(--text-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Input
            label="Full Name"
            placeholder="Aarav Mehta"
            error={errors.full_name?.message}
            {...register('full_name')}
          />

          <Input
            label="Campus Email"
            type="email"
            placeholder="aarav.mehta@campus.edu"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Password"
            type="password"
            placeholder="Minimum 8 characters"
            error={errors.password?.message}
            {...register('password')}
          />

          <Select
            label="Academic Department"
            options={(departments || [
              { code: 'CS', name: 'Computer Science & Engineering' },
              { code: 'MECH', name: 'Mechanical Engineering' },
              { code: 'ECE', name: 'Electronics & Communication' },
              { code: 'DESIGN', name: 'Design & Architecture' },
              { code: 'PHYSICS', name: 'Physics & Optics' },
            ]).map((d) => ({
              label: `${d.name} (${d.code})`,
              value: d.code,
            }))}
            error={errors.dept_id?.message}
            {...register('dept_id')}
          />

          {selectedRole === 'STUDENT' && (
            <Input
              label="Student Identification Number"
              placeholder="e.g. STU-2026-081"
              error={errors.student_id?.message}
              {...register('student_id')}
            />
          )}

          <Input
            label="Phone Number (Optional)"
            placeholder="+91 98765 43210"
            error={errors.phone?.message}
            {...register('phone')}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            rightIcon={<UserPlus size={18} />}
            style={{
              width: '100%',
              marginTop: 'var(--space-2)',
              backgroundColor: selectedRole === 'OWNER' ? 'var(--fern-500)' : 'var(--persimmon-500)',
              borderColor: selectedRole === 'OWNER' ? 'var(--fern-600)' : 'var(--persimmon-600)',
            }}
          >
            Create {selectedRole === 'OWNER' ? 'Owner Account' : 'Student Account'}
          </Button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--ink-soft)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--persimmon-600)', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

