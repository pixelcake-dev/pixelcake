import React from 'react';
import { BaseModal } from './BaseModal';
import type { ModalVariant, ScrollBehavior } from './BaseModal';

// Keep backward compatibility
type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  size?: ModalSize;
  minHeight?: string;
  maxHeight?: string;
  fixedContent?: React.ReactNode;
  footer?: React.ReactNode;
  noScroll?: boolean;
  // New props from BaseModal
  variant?: ModalVariant;
  autoHeight?: boolean;
  verticalAlign?: 'center' | 'start' | 'top';
}

// Modal component - now wrapper around BaseModal for backward compatibility
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  size = 'sm',
  minHeight = '400px',
  maxHeight = '85vh',
  fixedContent,
  footer,
  noScroll = false,
  variant,
  autoHeight = false,
  verticalAlign
}) => {
  // Determine variant based on props for backward compatibility
  const effectiveVariant = variant || (noScroll ? 'fixed' : 'scrollable');

  // Determine scroll behavior
  const scroll: ScrollBehavior = noScroll ? 'none' : 'content';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      variant={effectiveVariant}
      size={size}
      minHeight={minHeight}
      maxHeight={maxHeight}
      autoHeight={autoHeight}
      header={fixedContent}
      footer={footer}
      scroll={scroll}
      className={className}
      verticalAlign={verticalAlign}
    >
      {children}
    </BaseModal>
  );
};
