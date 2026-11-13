import { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { ChevronDown } from 'lucide-react';
import { COMMON_NETWORK_ICONS } from '@/data/commonIcons';
import { useEscapeToClose } from './useEscapeToClose';

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  color?: string;
  label?: string;
  error?: string;
}

const IconPicker = ({
  value,
  onChange,
  color = '#6b7280',
  label,
  error,
}: IconPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Esc closes the list of icons, before the window the picker is in
  useEscapeToClose(isOpen, () => setIsOpen(false));

  // Filter icons based on search query
  const filteredIcons = COMMON_NETWORK_ICONS.filter((icon) => {
    const query = searchQuery.toLowerCase();
    return (
      icon.label.toLowerCase().includes(query) ||
      icon.category.toLowerCase().includes(query) ||
      icon.name.toLowerCase().includes(query) ||
      icon.keywords?.some((keyword) => keyword.toLowerCase().includes(query))
    );
  });

  // Get current icon label
  const currentIcon = COMMON_NETWORK_ICONS.find((icon) => icon.name === value);
  const currentLabel = currentIcon?.label || value || 'Select icon';

  const handleSelect = (iconName: string) => {
    onChange(iconName);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-[var(--text-color-light)] mb-1.5">
          {label}
        </label>
      )}

      {/* Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-left flex items-center justify-between gap-2 hover:border-[var(--accent-color)] transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {value && (
            <Icon icon={value} width={20} height={20} style={{ color, flexShrink: 0 }} />
          )}
          <span className="text-sm text-[var(--text-color)] truncate">{currentLabel}</span>
        </div>
        <ChevronDown
          size={16}
          className={`text-[var(--text-color-light)] transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {error && <span className="text-sm text-red-500 mt-1 block">{error}</span>}

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-lg shadow-2xl overflow-hidden"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            maxHeight: `min(500px, calc(100vh - ${dropdownPosition.top + 16}px))`,
          }}
        >
          {/* Search */}
          <div className="p-3 border-b border-[var(--border-color)]">
            <input
              type="text"
              placeholder="Cerca icone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded text-sm text-[var(--text-color)] placeholder:text-[var(--text-color-light)] focus:outline-none focus:border-[var(--accent-color)]"
              autoFocus
            />
          </div>

          {/* Icon Grid */}
          <div className="overflow-y-auto p-3" style={{ maxHeight: '400px' }}>
            {filteredIcons.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--text-color-light)]">
                Nessuna icona trovata
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                {filteredIcons.map((icon) => (
                  <button
                    key={icon.name}
                    type="button"
                    onClick={() => handleSelect(icon.name)}
                    className={`flex flex-col items-center gap-1 p-2 rounded hover:bg-[var(--accent-color-light)] transition-colors group ${
                      value === icon.name
                        ? 'bg-[var(--accent-color-light)] ring-2 ring-[var(--accent-color)]'
                        : ''
                    }`}
                    title={icon.label}
                  >
                    <Icon
                      icon={icon.name}
                      width={32}
                      height={32}
                      style={{ color: value === icon.name ? color : '#6b7280' }}
                    />
                    <span className="text-xs text-[var(--text-color-light)] text-center truncate w-full group-hover:text-[var(--text-color)]">
                      {icon.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/*
          ===================================================================
          MANUAL INPUT FIELD (COMMENTED OUT - FOR FUTURE IMPLEMENTATION)
          ===================================================================
          Uncomment this section to allow manual input of any Iconify icon

          <div className="p-3 border-t border-[var(--border-color)] bg-[var(--color-canvas)]">
            <label className="block text-xs font-medium text-[var(--text-color-light)] mb-1.5">
              Inserimento Manuale (Iconify)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="es: mdi:custom-icon"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleSelect(searchQuery.trim());
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded text-sm text-[var(--text-color)] placeholder:text-[var(--text-color-light)] focus:outline-none focus:border-[var(--accent-color)]"
              />
              <button
                type="button"
                onClick={() => {
                  if (searchQuery.trim()) {
                    handleSelect(searchQuery.trim());
                  }
                }}
                disabled={!searchQuery.trim()}
                className="px-3 py-1.5 bg-[var(--accent-color)] text-white rounded text-sm font-medium hover:bg-[var(--accent-color-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                OK
              </button>
            </div>
            <p className="text-xs text-[var(--text-color-light)] mt-1.5">
              Cerca icone su:{' '}
              <a
                href="https://icon-sets.iconify.design/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-color)] underline"
              >
                icon-sets.iconify.design
              </a>
            </p>
          </div>
          */}
        </div>
      )}
    </div>
  );
};

export default IconPicker;
