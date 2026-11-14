import React from 'react';

export type InputSize = 'xs' | 'sm' | 'md' | 'lg' | 'full';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  size?: InputSize;
  fullWidth?: boolean;
}

// Size configurations for input fields
const sizeClasses: Record<InputSize, string> = {
  xs: 'max-w-[120px]',   // For very short fields (ports, etc.)
  sm: 'max-w-[180px]',   // For IPs, subnet masks
  md: 'max-w-[280px]',   // For names, vendors
  lg: 'max-w-[400px]',   // For longer text
  full: 'w-full',        // Full width
};

export const Input: React.FC<InputProps> = ({
  label,
  className = '',
  id,
  size = 'full',
  fullWidth = false,
  ...props
}) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  // Determine width class
  const widthClass = fullWidth ? 'w-full' : sizeClasses[size];

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[var(--text-color-light)] mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`${widthClass} px-3 py-1.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-lg text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...props}
      />
    </div>
  );
};
