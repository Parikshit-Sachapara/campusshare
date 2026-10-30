import React from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTabId?: string;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  onChange?: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTabId,
  activeTab,
  onTabChange,
  onChange,
  className = '',
}) => {
  const currentActive = activeTabId || activeTab || tabs[0]?.id;
  const handleChange = (id: string) => {
    if (onTabChange) onTabChange(id);
    if (onChange) onChange(id);
  };

  return (
    <div className={`${styles.tabList} ${className}`} role="tablist">
      {tabs.map((tab) => {
        const isActive = currentActive === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            className={`${styles.tabBtn} ${isActive ? styles.activeTab : ''}`}
            onClick={() => handleChange(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span className={styles.countBadge}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
