import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { vlanShort } from '@/utils/vlanNames';
import { useVlanNames } from '@/utils/useVlanNames';
import { useT } from '@/i18n';

interface VLANInputProps {
  label?: string;
  value: number[];
  onChange: (vlans: number[]) => void;
  /** Shown while no VLAN is in the field; an example of what to type when not given */
  placeholder?: string;
  disabled?: boolean;
}

/** Why what was typed was not taken (kept as a kind: its words follow the language) */
type Refusal = 'outOfRange' | 'duplicate';

/**
 * VLANInput - Multi-value input for VLAN IDs with tag chips
 * Validates VLAN range (1-4094) and displays as removable tags. A VLAN the
 * project gave a name to shows it on its tag, after the number
 */
export const VLANInput = ({ label, value, onChange, placeholder, disabled = false }: VLANInputProps) => {
  const t = useT();
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<Refusal | null>(null);
  const names = useVlanNames();

  const addVLAN = (vlanString: string) => {
    const trimmed = vlanString.trim();
    if (!trimmed) return;

    const vlanNum = parseInt(trimmed, 10);

    // Validate VLAN range
    if (isNaN(vlanNum) || vlanNum < 1 || vlanNum > 4094) {
      setError('outOfRange');
      return;
    }

    // Check for duplicates
    if (value.includes(vlanNum)) {
      setError('duplicate');
      return;
    }

    // Add VLAN
    onChange([...value, vlanNum]);
    setInputValue('');
    setError(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addVLAN(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      // Remove last VLAN if input is empty
      onChange(value.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addVLAN(inputValue);
    }
  };

  const removeVLAN = (vlanToRemove: number) => {
    onChange(value.filter((v) => v !== vlanToRemove));
  };

  return (
    <div className="vlan-input-container">
      {label && (
        <label htmlFor="vlan-input" className="block text-xs text-[var(--text-color-light)] mb-0.5">
          {label}
        </label>
      )}

      <div
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius)',
          padding: '2px 6px',
          minHeight: '30px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          alignItems: 'center',
          backgroundColor: disabled ? 'var(--bg-toolbar)' : 'var(--bg-canvas)',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
        onClick={() => !disabled && document.getElementById('vlan-input')?.focus()}
      >
        {/* VLAN Tags */}
        {value.map((vlan) => (
          <span
            key={vlan}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0 6px',
              backgroundColor: 'var(--bg-component)',
              color: 'var(--text-color)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-small)',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {vlanShort(vlan, names)}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeVLAN(vlan);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-color-light)',
                }}
                aria-label={t.vlan.input.remove(vlan)}
              >
                <X size={14} />
              </button>
            )}
          </span>
        ))}

        {/* Input Field */}
        <input
          id="vlan-input"
          type="text"
          aria-label={label ?? 'VLAN'}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={value.length === 0 ? (placeholder ?? t.vlan.input.placeholder) : ''}
          disabled={disabled}
          style={{
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-color)',
            fontSize: '14px',
            flex: 1,
            minWidth: '80px',
            padding: '2px',
          }}
        />
      </div>

      {/* Error Message */}
      {error && (
        <p style={{ color: 'var(--danger-color)', fontSize: '12px', marginTop: '4px' }}>
          {error === 'outOfRange' ? t.vlan.input.outOfRange : t.vlan.input.duplicate}
        </p>
      )}

      {/* Helper Text */}
      <p style={{ color: 'var(--text-color-light)', fontSize: '12px', marginTop: '4px' }}>
        {t.vlan.input.hint}
      </p>
    </div>
  );
};
