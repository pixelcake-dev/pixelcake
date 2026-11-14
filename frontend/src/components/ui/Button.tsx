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
    'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-toolbar)] disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    // The main button is a block of ink, as on the site; under the pointer it
    // takes the orange (a button that cannot be pressed stays as it is)
    primary:
      'bg-[var(--text-color)] border-[var(--text-color)] text-[var(--bg-canvas)] enabled:hover:bg-[var(--accent-color)] enabled:hover:border-[var(--accent-color)] enabled:hover:text-[var(--on-accent)]',
    secondary:
      'bg-transparent border-[var(--border-color)] text-[var(--text-color)] enabled:hover:border-[var(--text-color)]',
    danger: 'bg-[var(--danger-color)] border-[var(--danger-color)] text-white enabled:hover:opacity-90',
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-[13px]',
    md: 'px-3.5 py-1.5 text-sm',
    lg: 'px-5 py-2.5 text-base',
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
