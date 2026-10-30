import React, { forwardRef } from 'react';
import styles from './Textarea.module.css';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, showCount, maxLength, value, defaultValue, className = '', id, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const currentLen = typeof value === 'string' ? value.length : typeof defaultValue === 'string' ? defaultValue.length : 0;

    return (
      <div className={styles.container}>
        {(label || (showCount && maxLength)) && (
          <div className={styles.labelRow}>
            {label ? (
              <label htmlFor={textareaId} className={styles.label}>
                {label}
              </label>
            ) : <span />}
            {showCount && maxLength && (
              <span className={styles.charCount}>
                {currentLen}/{maxLength}
              </span>
            )}
          </div>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          maxLength={maxLength}
          value={value}
          defaultValue={defaultValue}
          className={`${styles.textarea} ${error ? styles.errorBorder : ''} ${className}`}
          {...props}
        />

        {error ? (
          <span className={styles.errorText}>{error}</span>
        ) : hint ? (
          <span className={styles.hint}>{hint}</span>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
