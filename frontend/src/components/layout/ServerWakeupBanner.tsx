import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { RefreshCw, X, Settings2, Check } from 'lucide-react';

export const ServerWakeupBanner: React.FC = () => {
  const [isWaking, setIsWaking] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [customUrl, setCustomUrl] = useState(() => localStorage.getItem('cs_custom_api_url') || '');

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

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim()) {
      localStorage.setItem('cs_custom_api_url', customUrl.trim());
    } else {
      localStorage.removeItem('cs_custom_api_url');
    }
    setShowConfig(false);
    window.location.reload();
  };

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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        color: 'var(--ink, #1F2421)',
        fontSize: '12px',
        fontFamily: 'var(--font-sans)',
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8 }}>
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
          <strong>Connecting to Backend...</strong> If Render was inactive, it takes ~20s to wake up.
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
            onClick={() => setShowConfig(!showConfig)}
            title="Set API URL"
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
            <Settings2 size={10} /> Set URL
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
      </div>

      {showConfig && (
        <form
          onSubmit={handleSaveUrl}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 4,
            maxWidth: 420,
            width: '100%',
          }}
        >
          <input
            type="text"
            placeholder="https://campusshare-xxxx.onrender.com"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            style={{
              flex: 1,
              padding: '3px 8px',
              fontSize: '11px',
              border: '1px solid var(--apricot-400, #F08A3C)',
              borderRadius: 4,
              outline: 'none',
              backgroundColor: 'var(--milk, #FFFDF8)',
            }}
          />
          <button
            type="submit"
            style={{
              backgroundColor: 'var(--terracotta-500, #D9532F)',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Check size={11} /> Connect
          </button>
        </form>
      )}

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
