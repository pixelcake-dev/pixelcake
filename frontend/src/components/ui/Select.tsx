import { forwardRef, useId } from 'react';
import type { SelectHTMLAttributes } from 'react';

export type SelectSize = 'xs' | 'sm' | 'md' | 'lg' | 'full';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  size?: SelectSize;
  fullWidth?: boolean;
}

// Size configurations for select fields (same as Input)
const sizeClasses: Record<SelectSize, string> = {
  xs: 'max-w-[120px]',   // For very short fields
  sm: 'max-w-[180px]',   // For short selections
  md: 'max-w-[280px]',   // For medium selections
  lg: 'max-w-[400px]',   // For longer selections
  full: 'w-full',        // Full width
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className = '', children, size = 'full', fullWidth = false, ...props }, ref) => {
    // Determine width class
    const widthClass = fullWidth ? 'w-full' : sizeClasses[size];
    // The label must name the control, for screen readers and for a click on
    // it to reach the select: without an id of its own the select gets one
    const generatedId = useId();
    const selectId = props.id ?? generatedId;

    return (
      <div className="form-group">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium mb-1 text-[var(--text-color-light)]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`${widthClass} px-3 py-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-canvas)] text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="mt-1 text-sm text-[var(--danger-color)]">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
export { Select };
