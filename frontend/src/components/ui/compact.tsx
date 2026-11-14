import React, { useId } from 'react';
import { cellClass, errorClass, hintClass, labelClass } from './compactStyles';

/**
 * The fields of a settings screen: a small label over a low field, several
 * to a row. A window that sets a device shows many values at once, and each
 * is a few characters long: a field as wide as the window for one address
 * hides the rest of the device below the fold.
 */

/** How many of the four columns of a row a field takes */
type Span = 1 | 2 | 3 | 4;
const spanClass: Record<Span, string> = {
  1: '',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
};

interface FieldFrame {
  label: string;
  /** Said under the field, in the colour of a note */
  hint?: React.ReactNode;
  /** What is wrong with the value, said under the field as it is typed */
  error?: string | null;
  span?: Span;
}

type TextFieldProps = FieldFrame &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'className'> & {
    /** An address, a MAC: letters of one width */
    mono?: boolean;
  };

export const TextField: React.FC<TextFieldProps> = ({
  label,
  hint,
  error,
  span = 1,
  mono = false,
  id,
  type = 'text',
  ...input
}) => {
  const own = useId();
  const fieldId = id ?? own;
  return (
    <div className={`flex flex-col gap-0.5 min-w-0 ${spanClass[span]}`}>
      <label htmlFor={fieldId} className={labelClass}>
        {label}
      </label>
      <input
        id={fieldId}
        type={type}
        className={mono ? `${cellClass} font-mono` : cellClass}
        aria-invalid={error ? true : undefined}
        {...input}
      />
      {hint && <span className={hintClass}>{hint}</span>}
      {error && (
        <span className={errorClass} role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

type TextAreaFieldProps = FieldFrame &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>;

/** A text of more than one line: a note. As wide as its row unless told otherwise */
export const TextAreaField: React.FC<TextAreaFieldProps> = ({
  label,
  hint,
  error,
  span = 4,
  id,
  rows = 2,
  ...area
}) => {
  const own = useId();
  const fieldId = id ?? own;
  return (
    <div className={`flex flex-col gap-0.5 min-w-0 ${spanClass[span]}`}>
      <label htmlFor={fieldId} className={labelClass}>
        {label}
      </label>
      <textarea
        id={fieldId}
        rows={rows}
        className={`${cellClass} resize-y`}
        aria-invalid={error ? true : undefined}
        {...area}
      />
      {hint && <span className={hintClass}>{hint}</span>}
      {error && (
        <span className={errorClass} role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

type SelectFieldProps = FieldFrame &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'className'>;

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  hint,
  error,
  span = 1,
  id,
  children,
  ...select
}) => {
  const own = useId();
  const fieldId = id ?? own;
  return (
    <div className={`flex flex-col gap-0.5 min-w-0 ${spanClass[span]}`}>
      <label htmlFor={fieldId} className={labelClass}>
        {label}
      </label>
      <select id={fieldId} className={cellClass} {...select}>
        {children}
      </select>
      {hint && <span className={hintClass}>{hint}</span>}
      {error && (
        <span className={errorClass} role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

interface CheckFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  hint?: React.ReactNode;
  span?: Span;
  /** In a row of fields the tick sits on the line of the fields, not of their labels */
  inRow?: boolean;
}

export const CheckField: React.FC<CheckFieldProps> = ({
  label,
  checked,
  onChange,
  id,
  disabled,
  hint,
  span = 1,
  inRow = false,
}) => {
  const own = useId();
  const fieldId = id ?? own;
  return (
    <div className={`flex flex-col gap-0.5 min-w-0 ${spanClass[span]} ${inRow ? 'pt-[18px]' : ''}`}>
      <div className="flex items-center gap-2 min-h-[30px]">
        <input
          type="checkbox"
          id={fieldId}
          className="w-4 h-4 shrink-0 cursor-pointer disabled:cursor-not-allowed"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <label htmlFor={fieldId} className="text-sm cursor-pointer">
          {label}
        </label>
      </div>
      {hint && <span className={hintClass}>{hint}</span>}
    </div>
  );
};

/** A row of up to four fields */
export const FieldRow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`grid grid-cols-4 gap-x-3 gap-y-2 ${className}`}>{children}</div>;

/** A value that is shown and not typed: what a port is linked to, the type of a device */
export const ReadOnlyField: React.FC<{
  label: string;
  children: React.ReactNode;
  span?: Span;
  id?: string;
}> = ({ label, children, span = 1, id }) => {
  const own = useId();
  const labelId = `${id ?? own}-label`;
  return (
    <div className={`flex flex-col gap-0.5 min-w-0 ${spanClass[span]}`}>
      <span id={labelId} className={labelClass}>
        {label}
      </span>
      <output aria-labelledby={labelId} className="flex items-center gap-2 min-h-[30px] text-sm">
        {children}
      </output>
    </div>
  );
};
