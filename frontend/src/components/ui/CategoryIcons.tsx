import React from 'react';

export type ResourceCategory =
  | 'Computing'
  | 'Electronics'
  | 'Robotics'
  | 'Photography'
  | 'Laboratories'
  | 'Classrooms'
  | 'Audio/Visual'
  | 'Manufacturing'
  | 'Sports';

interface CategoryIconProps {
  category: ResourceCategory | string;
  size?: number;
  className?: string;
  strokeColor?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  size = 24,
  className = '',
  strokeColor = 'currentColor',
}) => {
  const norm = category.toLowerCase().trim();

  // Handcrafted warm SVG line icons with playful campus character
  if (norm.includes('comput')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="2" y="3" width="20" height="13" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 16v5" />
        <path d="M6 8h.01" />
        <path d="M9 8h6" />
        <path d="M6 11h3" />
      </svg>
    );
  }

  if (norm.includes('electron')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 1v3" />
        <path d="M15 1v3" />
        <path d="M9 20v3" />
        <path d="M15 20v3" />
        <path d="M1 9h3" />
        <path d="M1 15h3" />
        <path d="M20 9h3" />
        <path d="M20 15h3" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  if (norm.includes('robot')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8" y2="16.01" strokeWidth="2.8" />
        <line x1="16" y1="16" x2="16" y2="16.01" strokeWidth="2.8" />
        <path d="M10 19h4" />
        <path d="M1 15h2" />
        <path d="M21 15h2" />
      </svg>
    );
  }

  if (norm.includes('photo')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
        <circle cx="18" cy="10" r="1" fill={strokeColor} />
      </svg>
    );
  }

  if (norm.includes('lab')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M9 3h6" />
        <path d="M10 3v5l-6 10a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3l-6-10V3" />
        <path d="M8 15h8" strokeDasharray="1.5 2" />
        <circle cx="11" cy="18" r="1" fill={strokeColor} />
      </svg>
    );
  }

  if (norm.includes('class')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M2 3h20v14H2z" rx="2" />
        <path d="M8 21l4-4 4 4" />
        <path d="M7 8h10" strokeDasharray="2 2" />
        <path d="M7 11h6" />
      </svg>
    );
  }

  if (norm.includes('audio') || norm.includes('visual')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      </svg>
    );
  }

  if (norm.includes('manuf') || norm.includes('tool') || norm.includes('3d')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    );
  }

  if (norm.includes('sport')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20" />
        <path d="M12 2a14.5 14.5 0 0 1 0 20" />
        <path d="M2 12h20" />
      </svg>
    );
  }

  // Fallback box/resource icon
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
};
