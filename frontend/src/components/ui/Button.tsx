import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  // What is inside stands in a row, centred, with a small gap: an icon next
  // to its label. (An icon is a block of its own in this style sheet: left
  // to the normal flow it took a line for itself, with the label under it.)
  // A button that cannot be pressed must look it
  const baseClasses =
    'inline-flex items-center justify-center gap-1 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-[var(--accent-color)] text-white hover:opacity-90 focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-opacity-50',
    secondary: 'bg-[var(--bg-toolbar)] border border-[var(--border-color)] hover:bg-[var(--bg-canvas)] text-[var(--text-color)]',
    danger: 'bg-[var(--danger-color)] text-white hover:opacity-90 focus:ring-2 focus:ring-[var(--danger-color)] focus:ring-opacity-50',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
