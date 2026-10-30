import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { RefreshCw, X } from 'lucide-react';

export const ServerWakeupBanner: React.FC = () => {
  const [isWaking, setIsWaking] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const checkHealth = async () => {
    try {
      const res = await api.pingHealth();
      if (res && res.status === 'online') {
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
    if (isWaking && !dismissed) {
      timer = setTimeout(() => {
        checkHealth();
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [isWaking, retryCount, dismissed]);

  if ((isOnline && !isWaking) || dismissed) {
    return null;
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: 'var(--apricot-50, #FFF5EB)',
        borderBottom: '1px solid var(--apricot-400, #F08A3C)',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 8,
        color: 'var(--ink, #1F2421)',
        fontSize: '12px',
        fontFamily: 'var(--font-sans)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: 'var(--apricot-500, #F08A3C)',
          animation: 'pulse 1.5s infinite',
          flexShrink: 0,
        }}
      />
      <span style={{ lineHeight: 1.3 }}>
        <strong>Backend server connecting...</strong> If using Render free-tier, it may take ~20-30s to spin up.
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => {
            setRetryCount((c) => c + 1);
            checkHealth();
          }}
          style={{
            backgroundColor: 'var(--milk, #FFFDF8)',
            border: '1px solid var(--apricot-400, #F08A3C)',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--apricot-700, #C25E17)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <RefreshCw size={10} className={isWaking ? 'spin' : ''} /> Retry
        </button>
        <button
          onClick={() => setDismissed(true)}
          title="Dismiss banner"
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--ink-soft, #5C6460)',
            cursor: 'pointer',
            padding: '2px 4px',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>
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
