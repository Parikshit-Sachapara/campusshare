import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck, LogIn, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth, DEMO_CREDENTIALS } from '../../context/AuthContext';
import { UserRole } from '../../api/types';
import { Button, Input, useToast } from '../../components/ui';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid campus email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: DEMO_CREDENTIALS.STUDENT.email,
      password: DEMO_CREDENTIALS.STUDENT.pass,
    },
  });

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const onSubmit = async (data: LoginFormData) => {
    setAuthError(null);
    try {
      const user = await login(data.email, data.password);
      addToast({
        title: `Welcome back, ${user.full_name}!`,
        message: `Signed in as ${user.role}.`,
        variant: 'success',
      });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const message = (err as Error).message || 'Invalid credentials or connection error.';
      setAuthError(message);
      addToast({
        title: 'Authentication Failed',
        message,
        variant: 'danger',
      });
    }
  };

  const handleSelectDemoRole = (r: UserRole) => {
    const cred = DEMO_CREDENTIALS[r];
    setValue('email', cred.email, { shouldValidate: true });
    setValue('password', cred.pass, { shouldValidate: true });
    setAuthError(null);
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
          maxWidth: 460,
          backgroundColor: 'var(--milk)',
          border: '1.5px solid var(--ink-border)',
          borderRadius: 'var(--radius-card)',
          boxShadow: '0 8px 30px rgba(29, 43, 37, 0.06)',
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              textDecoration: 'none',
              marginBottom: 'var(--space-3)',
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
            Sign in to Platform
          </h2>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Institutional resource access, locking, and accountability
          </p>
        </div>

        {/* Demo Account Quick Switcher Chips */}
        <div
          style={{
            backgroundColor: 'var(--oat-100)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            border: '1px solid var(--oat-200)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--ink-soft)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <Sparkles size={13} color="var(--persimmon-500)" />
            <span>Try a demo account (auto-fill credentials):</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={() => handleSelectDemoRole('STUDENT')}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--persimmon-500)',
                backgroundColor: 'var(--persimmon-100)',
                color: 'var(--persimmon-600)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--persimmon-500)' }} />
              Student
            </button>

            <button
              type="button"
              onClick={() => handleSelectDemoRole('OWNER')}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--fern-500)',
                backgroundColor: 'var(--fern-100)',
                color: 'var(--fern-600)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--fern-500)' }} />
              Lab Owner
            </button>

            <button
              type="button"
              onClick={() => handleSelectDemoRole('MANAGER')}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--mulberry-500)',
                backgroundColor: 'var(--mulberry-100)',
                color: 'var(--mulberry-600)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--mulberry-500)' }} />
              Facility Mgr
            </button>

            <button
              type="button"
              onClick={() => handleSelectDemoRole('ADMIN')}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--lilac-400)',
                backgroundColor: 'var(--lilac-100)',
                color: 'var(--lilac-500)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--lilac-400)' }} />
              Admin
            </button>
          </div>
        </div>

        {/* Form Error Banner */}
        {authError && (
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
            <span>{authError}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            label="Campus Email"
            type="email"
            placeholder="netid@campusshare.demo"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-soft)', cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: 'var(--persimmon-500)' }} />
              Remember me
            </label>
            <Link to="/forgot-password" style={{ color: 'var(--persimmon-600)', textDecoration: 'none', fontWeight: 600 }}>
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isLoading}
            rightIcon={<LogIn size={18} />}
            style={{ width: '100%', marginTop: 'var(--space-2)' }}
          >
            Sign In
          </Button>
        </form>

        {/* Footer Link */}
        <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--ink-soft)' }}>
          Don't have an account yet?{' '}
          <Link to="/register" style={{ color: 'var(--persimmon-600)', fontWeight: 600, textDecoration: 'none' }}>
            Register as Student or Owner
          </Link>
        </div>
      </div>
    </div>
  );
};

