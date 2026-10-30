import React, { forwardRef } from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, optional, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={styles.container}>
        {label && (
          <div className={styles.labelRow}>
            <label htmlFor={inputId} className={styles.label}>
              {label}
            </label>
            {optional && <span className={styles.optional}>(Optional)</span>}
          </div>
        )}

        <div className={styles.inputWrapper}>
          {leftIcon && <span className={`${styles.iconSlot} ${styles.leftSlot}`}>{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={`
              ${styles.input} 
              ${leftIcon ? styles.hasLeftIcon : ''} 
              ${rightIcon ? styles.hasRightIcon : ''} 
              ${error ? styles.errorBorder : ''} 
              ${className}
            `}
            {...props}
          />
          {rightIcon && <span className={`${styles.iconSlot} ${styles.rightSlot}`}>{rightIcon}</span>}
        </div>

        {error ? (
          <span className={styles.errorText}>{error}</span>
        ) : hint ? (
          <span className={styles.hint}>{hint}</span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
