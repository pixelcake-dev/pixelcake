import React from 'react';
import { BaseModal } from './BaseModal';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface SimpleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  size?: ModalSize;
  maxHeight?: string;
  noTitle?: boolean;
}

export const SimpleModal: React.FC<SimpleModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  size = 'sm',
  maxHeight = '85vh',
  noTitle = false
}) => {
  // SimpleModal uses 'fixed' variant for simple static content
  // With custom scrollbar for consistency across all modals
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={noTitle ? '' : title}
      variant="fixed"
      size={size}
      maxHeight={maxHeight}
      scroll="content"
      autoHeight={true}
      autoHeightMin={100}
      autoHeightMax={maxHeight}
      className={className}
    >
      <div className="simple-modal-content">
        {children}
      </div>
    </BaseModal>
  );
};
