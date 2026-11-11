import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface VLANInputProps {
  label?: string;
  value: number[];
  onChange: (vlans: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * VLANInput - Multi-value input for VLAN IDs with tag chips
 * Validates VLAN range (1-4094) and displays as removable tags
 */
export const VLANInput = ({ label, value, onChange, placeholder = 'es. 10, 20, 30', disabled = false }: VLANInputProps) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  const addVLAN = (vlanString: string) => {
    const trimmed = vlanString.trim();
    if (!trimmed) return;

    const vlanNum = parseInt(trimmed, 10);

    // Validate VLAN range
    if (isNaN(vlanNum) || vlanNum < 1 || vlanNum > 4094) {
      setError('VLAN deve essere tra 1 e 4094');
      return;
    }

    // Check for duplicates
    if (value.includes(vlanNum)) {
      setError('VLAN già presente');
      return;
    }

    // Add VLAN
    onChange([...value, vlanNum]);
    setInputValue('');
    setError('');
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
        <label className="block text-sm font-semibold text-[var(--text-color-light)] mb-1.5">
          {label}
        </label>
      )}

      <div
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '6px 8px',
          minHeight: '38px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
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
              padding: '2px 8px',
              backgroundColor: 'var(--accent-color)',
              color: 'white',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {vlan}
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
                  color: 'white',
                }}
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
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={value.length === 0 ? placeholder : ''}
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
        <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
          {error}
        </p>
      )}

      {/* Helper Text */}
      <p style={{ color: 'var(--text-color-light)', fontSize: '12px', marginTop: '4px' }}>
        Premi Enter o virgola per aggiungere VLAN (1-4094)
      </p>
    </div>
  );
};
