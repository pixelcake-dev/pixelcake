import { useRef, useState } from 'react';

interface InlineEditProps {
  /** Text the edit starts from */
  value: string;
  /** Accessible name of the input */
  label: string;
  placeholder?: string;
  className?: string;
  /** The most that can be typed */
  maxLength?: number;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

/**
 * A text edited in place: Enter (or leaving the field) confirms, Escape
 * cancels. The parent mounts it while the edit lasts and unmounts it from
 * either callback, each of which is called at most once.
 */
export const InlineEdit = ({
  value,
  label,
  placeholder,
  className = '',
  maxLength,
  onCommit,
  onCancel,
}: InlineEditProps) => {
  const [draft, setDraft] = useState(value);
  // Enter and Escape unmount the input, and a browser may still send it a
  // blur on the way out: only the first outcome counts
  const settled = useRef(false);

  const finish = (commit: boolean) => {
    if (settled.current) return;
    settled.current = true;
    if (commit) {
      onCommit(draft);
    } else {
      onCancel();
    }
  };

  return (
    <input
      type="text"
      className={className}
      aria-label={label}
      placeholder={placeholder}
      maxLength={maxLength}
      value={draft}
      autoFocus
      onFocus={e => e.currentTarget.select()}
      onChange={e => setDraft(e.target.value)}
      // The field often sits inside something clickable (a card, a row)
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      onKeyDown={e => {
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') {
          // The press is used up here: it cancels the edit and nothing else
          // (it does not also close a window, see useEscapeToClose)
          e.preventDefault();
          finish(false);
        }
      }}
      onBlur={() => finish(true)}
    />
  );
};
