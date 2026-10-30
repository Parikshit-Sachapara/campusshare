import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, ArrowLeft, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { Button, Input, useToast } from '../../components/ui';

const resetSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type ResetFormData = z.infer<typeof resetSchema>;

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      token: searchParams.get('token') || '',
      new_password: '',
      confirm_password: '',
    },
  });

  const onSubmit = async (data: ResetFormData) => {
    setErrorMsg(null);
    try {
      await api.resetPassword({
        token: data.token,
        new_password: data.new_password,
      });

      addToast({
        title: 'Password Updated!',
        message: 'Your password has been changed. You may now sign in.',
        variant: 'success',
      });

      navigate('/login');
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Invalid or expired password reset token.';
      setErrorMsg(msg);
      addToast({
        title: 'Password Reset Failed',
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
          maxWidth: 440,
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
        <Link
          to="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--ink-soft)',
            fontSize: 'var(--text-sm)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} />
          Back to Login
        </Link>

        <div>
          <h2 style={{ margin: '0 0 var(--space-1) 0', color: 'var(--ink)', fontSize: 'var(--text-xl)' }}>
            Choose New Password
          </h2>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Enter your reset token and new secure password
          </p>
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

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            label="Recovery Token"
            placeholder="Paste token received in email"
            error={errors.token?.message}
            {...register('token')}
          />

          <Input
            label="New Password"
            type="password"
            placeholder="Minimum 8 characters"
            error={errors.new_password?.message}
            {...register('new_password')}
          />

          <Input
            label="Confirm New Password"
            type="password"
            placeholder="Repeat new password"
            error={errors.confirm_password?.message}
            {...register('confirm_password')}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            rightIcon={<KeyRound size={18} />}
            style={{ width: '100%' }}
          >
            Update Password
          </Button>
        </form>
      </div>
    </div>
  );
};

