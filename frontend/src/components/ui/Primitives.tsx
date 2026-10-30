import React from 'react';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  roleColor?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  roleColor,
}) => {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const px = size === 'sm' ? 28 : size === 'lg' ? 44 : 36;
  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 16 : 13;

  return (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        backgroundColor: 'var(--oat-200)',
        border: `1.5px solid ${roleColor || 'var(--ink)'}`,
        boxShadow: '1px 1px 0 var(--ink)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        fontSize,
        color: 'var(--ink)',
      }}
      title={name}
    >
      {src ? (
        <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initials
      )}
    </div>
  );
};

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'persimmon' | 'fern' | 'mulberry' | 'lilac' | 'apricot' | 'cherry' | 'oat';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'oat' }) => {
  const variantStyles: Record<string, React.CSSProperties> = {
    persimmon: { backgroundColor: 'var(--persimmon-100)', color: 'var(--persimmon-600)', borderColor: 'var(--persimmon-500)' },
    fern: { backgroundColor: 'var(--fern-100)', color: 'var(--fern-600)', borderColor: 'var(--fern-500)' },
    mulberry: { backgroundColor: 'var(--mulberry-100)', color: 'var(--mulberry-600)', borderColor: 'var(--mulberry-500)' },
    lilac: { backgroundColor: 'var(--lilac-100)', color: 'var(--lilac-500)', borderColor: 'var(--lilac-400)' },
    apricot: { backgroundColor: 'var(--apricot-100)', color: 'var(--apricot-600)', borderColor: 'var(--apricot-500)' },
    cherry: { backgroundColor: 'var(--cherry-100)', color: 'var(--cherry-600)', borderColor: 'var(--cherry-500)' },
    oat: { backgroundColor: 'var(--oat-100)', color: 'var(--ink)', borderColor: 'var(--oat-200)' },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        borderRadius: 'var(--radius-sm)',
        border: '1px solid',
        ...variantStyles[variant],
      }}
    >
      {children}
    </span>
  );
};

export interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  variant?: 'persimmon' | 'fern' | 'mulberry' | 'apricot' | 'cherry';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  variant = 'persimmon',
}) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  const colorMap = {
    persimmon: 'var(--persimmon-500)',
    fern: 'var(--fern-500)',
    mulberry: 'var(--mulberry-500)',
    apricot: 'var(--apricot-500)',
    cherry: 'var(--cherry-500)',
  };

  return (
    <div
      style={{
        width: '100%',
        height: '8px',
        backgroundColor: 'var(--oat-200)',
        borderRadius: 'var(--radius-full)',
        overflow: 'hidden',
        border: '1px solid var(--ink-border)',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: colorMap[variant],
          borderRadius: 'var(--radius-full)',
          transition: 'width 250ms ease-out',
        }}
      />
    </div>
  );
};

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%) translateY(-6px)',
            backgroundColor: 'var(--ink)',
            color: 'var(--milk)',
            fontSize: '11px',
            fontFamily: 'var(--font-body)',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            whiteSpace: 'nowrap',
            zIndex: 100,
            pointerEvents: 'none',
            boxShadow: '2px 2px 0 rgba(0,0,0,0.2)',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};
