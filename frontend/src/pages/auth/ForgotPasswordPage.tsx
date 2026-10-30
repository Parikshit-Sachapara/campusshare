import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '../../api/client';
import { Button, Input, useToast } from '../../components/ui';

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid campus email address'),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

export const ForgotPasswordPage: React.FC = () => {
  const { addToast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotFormData) => {
    try {
      await api.forgotPassword(data.email);
      setIsSubmitted(true);
      addToast({
        title: 'Reset Link Sent',
        message: 'If an account exists with this email, instructions have been dispatched.',
        variant: 'success',
      });
    } catch {
      // Always show success state for security
      setIsSubmitted(true);
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
            Reset Password
          </h2>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Enter your institutional email to receive a password recovery token
          </p>
        </div>

        {isSubmitted ? (
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--fern-100)',
              border: '1px solid var(--fern-500)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--fern-600)',
              fontSize: 'var(--text-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <CheckCircle2 size={18} />
              <span>Password Recovery Dispatched</span>
            </div>
            <p style={{ margin: 0, color: 'var(--ink-soft)' }}>
              Check your inbox for a reset token. Once received, enter it on the password update screen.
            </p>
            <Link to="/reset-password" style={{ marginTop: 8 }}>
              <Button variant="primary" size="sm">
                Proceed to Reset Password
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Input
              label="Campus Email"
              type="email"
              placeholder="netid@campus.edu"
              error={errors.email?.message}
              {...register('email')}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              rightIcon={<Mail size={18} />}
              style={{ width: '100%' }}
            >
              Send Reset Instructions
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

