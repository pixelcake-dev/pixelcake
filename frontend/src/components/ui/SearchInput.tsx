import { useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  inputWidth?: string;
  iconSize?: number;
  size?: 'sm' | 'md';
  onClear?: () => void;
}

export const SearchInput = ({
  value,
  onChange,
  placeholder = '',
  autoFocus = false,
  className = '',
  inputWidth = '140px',
  iconSize = 12,
  size = 'sm',
  onClear,
}: SearchInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleClear = () => {
    onChange('');
    if (onClear) {
      onClear();
    }
    inputRef.current?.focus();
  };

  // Size-based styles
  const sizeStyles = {
    sm: {
      container: 'px-2.5 py-1',
      text: 'text-xs',
      gap: 'gap-2',
    },
    md: {
      container: 'px-3 py-1.5',
      text: 'text-sm',
      gap: 'gap-2.5',
    },
  };

  const styles = sizeStyles[size];

  return (
    <div className={className}>
      <div
        className={`inline-flex items-center ${styles.gap} ${styles.container} rounded-md border border-[var(--border-color)] bg-[var(--bg-canvas)]`}
      >
        <Search
          size={iconSize}
          className="text-[var(--text-color-light)] flex-shrink-0"
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          className={`bg-transparent text-[var(--text-color)] ${styles.text} focus:outline-none border-0 p-0 m-0`}
          style={{
            width: inputWidth,
            outline: 'none',
            boxShadow: 'none',
            border: 'none',
            backgroundColor: 'transparent',
            height: 'auto',
            lineHeight: '1',
            minHeight: 'unset',
            padding: '0',
            margin: '0',
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[var(--text-color-light)] hover:text-[var(--text-color)] flex-shrink-0 transition-colors"
            aria-label="Clear search"
          >
            <X size={iconSize} />
          </button>
        )}
      </div>
    </div>
  );
};
