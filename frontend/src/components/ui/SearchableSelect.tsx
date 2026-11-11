import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { Scrollbars } from 'react-custom-scrollbars-2';
import { SearchInput } from './SearchInput';

interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

const SearchableSelect = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Seleziona...',
}: SearchableSelectProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState(options);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update display label when value changes
  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : placeholder;

  // Filter options based on search term
  useEffect(() => {
    const filtered = options.filter((option) =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredOptions(filtered);
  }, [searchTerm, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
    }
  };

  return (
    <div className="form-group relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium mb-1 text-[var(--text-color-light)]">
          {label}
        </label>
      )}

      {/* Select Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full px-3 py-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-canvas)] text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] flex items-center justify-between gap-2"
      >
        <span className={`overflow-hidden text-ellipsis whitespace-nowrap ${!selectedOption ? 'text-[var(--text-color-light)]' : ''}`}>
          {displayValue}
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-canvas)] shadow-lg">
          {/* Search Input inside dropdown */}
          <div className="px-3 py-1.5">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              autoFocus={isOpen}
              inputWidth="140px"
            />
          </div>

          {/* Options List */}
          <Scrollbars
            autoHeight
            autoHeightMax={240}
            style={{ width: '100%' }}
            renderThumbVertical={({ style, ...props }) => (
              <div
                {...props}
                style={{
                  ...style,
                  backgroundColor: 'var(--accent-color)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: '2px solid transparent',
                  backgroundClip: 'padding-box',
                }}
              />
            )}
            renderTrackVertical={({ style, ...props }) => (
              <div
                {...props}
                style={{
                  ...style,
                  width: '10px',
                  right: '2px',
                  bottom: '2px',
                  top: '2px',
                  background: 'linear-gradient(to right, transparent calc(50% - 1px), rgba(128, 128, 128, 0.3) calc(50% - 1px), rgba(128, 128, 128, 0.3) calc(50% + 1px), transparent calc(50% + 1px))',
                }}
              />
            )}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-color-hover)] ${
                    option.value === value
                      ? 'bg-[var(--accent-color)] text-white'
                      : 'text-[var(--text-color)]'
                  }`}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-[var(--text-color-light)] text-center">
                Nessun risultato trovato
              </div>
            )}
          </Scrollbars>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
