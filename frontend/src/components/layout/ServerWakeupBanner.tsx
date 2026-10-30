import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

export const ServerWakeupBanner: React.FC = () => {
  const [isWaking, setIsWaking] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const checkHealth = async () => {
    try {
      const res = await api.pingHealth();
      if (res && res.status === 'ok') {
        setIsWaking(false);
        setIsOnline(true);
      }
    } catch {
      setIsWaking(true);
      setIsOnline(false);
    }
  };

  useEffect(() => {
    // Initial probe
    checkHealth();
    // Poll every 5s if server is sleeping
    let timer: ReturnType<typeof setTimeout>;
    if (isWaking) {
      timer = setTimeout(() => {
        checkHealth();
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [isWaking, retryCount]);

  if (isOnline && !isWaking) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: 'var(--apricot-50)',
        borderBottom: '1.5px solid var(--apricot-400)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: 'var(--ink)',
        fontSize: '13px',
        boxShadow: '0 2px 8px rgba(44, 36, 22, 0.08)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: 'var(--apricot-500)',
          animation: 'pulse 1.5s infinite',
        }}
      />
      <span>
        <strong>Waking up backend server...</strong> Render free tier instances sleep after inactivity and take ~20-30s to spin up.
      </span>
      <button
        onClick={() => {
          setRetryCount((c) => c + 1);
          checkHealth();
        }}
        style={{
          backgroundColor: 'var(--milk)',
          border: '1px solid var(--apricot-400)',
          borderRadius: 'var(--radius-sm, 6px)',
          padding: '3px 10px',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--apricot-700)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <RefreshCw size={12} className={isWaking ? 'spin' : ''} /> Retry Ping
      </button>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.6; }
        }
        .spin {
          animation: rotate 1.5s linear infinite;
        }
        @keyframes rotate {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
