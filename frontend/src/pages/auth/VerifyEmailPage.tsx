import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui';

export const VerifyEmailPage: React.FC = () => {
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
          alignItems: 'center',
          textAlign: 'center',
          gap: 'var(--space-4)',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--fern-100)',
            color: 'var(--fern-600)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckCircle2 size={32} />
        </div>

        <div>
          <h2 style={{ margin: '0 0 var(--space-1) 0', color: 'var(--ink)', fontSize: 'var(--text-xl)' }}>
            Email Verified
          </h2>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            Your campus institutional email address has been successfully verified. You now have full access to CampusShare reservation passes and equipment requests.
          </p>
        </div>

        <Link to="/login" style={{ width: '100%', marginTop: 'var(--space-2)' }}>
          <Button variant="primary" size="lg" rightIcon={<ArrowRight size={18} />} style={{ width: '100%' }}>
            Proceed to Login
          </Button>
        </Link>
      </div>
    </div>
  );
};

