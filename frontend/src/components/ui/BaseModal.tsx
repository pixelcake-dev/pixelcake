import React from 'react';
import { X } from 'lucide-react';
import { Scrollbars } from 'react-custom-scrollbars-2';

// Modal variants for different use cases
export type ModalVariant = 'fixed' | 'scrollable' | 'auto' | 'fullscreen' | 'tabbed';

// Layout options for modal content
export type ModalLayout = 'single' | 'two-column' | 'sidebar';

// Size options
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

// Scroll behavior for content
export type ScrollBehavior = 'none' | 'content' | 'container' | 'nested';

// Responsive layout configuration
export type ResponsiveLayout = {
  base?: ModalLayout;
  sm?: ModalLayout;
  md?: ModalLayout;
  lg?: ModalLayout;
  xl?: ModalLayout;
};

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;

  // Layout and appearance
  variant?: ModalVariant;
  size?: ModalSize;
  layout?: ModalLayout | ResponsiveLayout;
  className?: string;

  // Scroll configuration
  scroll?: ScrollBehavior;

  // Height configuration
  minHeight?: string;
  maxHeight?: string;
  autoHeight?: boolean;
  autoHeightMin?: number;
  autoHeightMax?: string;

  // Fixed sections
  header?: React.ReactNode;
  footer?: React.ReactNode;
  sidebar?: React.ReactNode;

  // Advanced options
  noScrollbar?: boolean;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  verticalAlign?: 'center' | 'start' | 'top';
}

// Size configurations
const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-md',    // 448px
  md: 'max-w-2xl',   // 672px
  lg: 'max-w-4xl',   // 896px
  xl: 'max-w-6xl',   // 1152px
  '2xl': 'max-w-7xl', // 1280px
  full: 'max-w-full mx-4', // Full width with margin
};

// Variant-specific height configurations
const variantHeights: Record<ModalVariant, { min?: string; max: string }> = {
  fixed: { min: '400px', max: '600px' },
  scrollable: { max: '85vh' },
  auto: { max: 'calc(90vh - 100px)' },
  fullscreen: { max: 'calc(100vh - 80px)' },
  tabbed: { max: 'calc(90vh - 120px)' },
};

const getLayoutClass = (layout?: ModalLayout | ResponsiveLayout): string => {
  if (!layout) return '';

  if (typeof layout === 'string') {
    switch (layout) {
      case 'two-column':
        return 'modal-layout-two-column';
      case 'sidebar':
        return 'modal-layout-sidebar';
      default:
        return '';
    }
  }

  // Handle responsive layout
  const classes: string[] = [];
  if (layout.base) classes.push(`modal-layout-${layout.base}`);
  if (layout.sm) classes.push(`sm:modal-layout-${layout.sm}`);
  if (layout.md) classes.push(`md:modal-layout-${layout.md}`);
  if (layout.lg) classes.push(`lg:modal-layout-${layout.lg}`);
  if (layout.xl) classes.push(`xl:modal-layout-${layout.xl}`);

  return classes.join(' ');
};

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  variant = 'scrollable',
  size = 'md',
  layout = 'single',
  className,
  scroll = variant === 'fixed' ? 'none' : 'content',
  minHeight,
  maxHeight,
  autoHeight = variant === 'auto',
  autoHeightMin = 200,
  autoHeightMax,
  header,
  footer,
  sidebar,
  noScrollbar = false,
  closeOnOverlayClick = true,
  showCloseButton = true,
  verticalAlign = 'center',
}) => {
  if (!isOpen) return null;

  const sizeClass = sizeClasses[size];
  const layoutClass = getLayoutClass(layout);
  const heights = variantHeights[variant];

  const finalMinHeight = minHeight || heights.min;
  const finalMaxHeight = maxHeight || heights.max;
  const finalAutoHeightMax = autoHeightMax || heights.max;

  // Determine vertical alignment class
  const alignClass = verticalAlign === 'start' || verticalAlign === 'top' ? 'items-start pt-20' : 'items-center';

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      onClose();
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const renderScrollableContent = () => {
    if (scroll === 'none' || noScrollbar) {
      return <div className="modal-content-inner">{children}</div>;
    }

    if (autoHeight) {
      return (
        <Scrollbars
          autoHide
          autoHideTimeout={1000}
          autoHeight
          autoHeightMin={autoHeightMin}
          autoHeightMax={finalAutoHeightMax}
          renderView={({ style, ...props }) => (
            <div {...props} style={{
              ...style,
              backgroundColor: 'var(--bg-toolbar)',
              marginRight: -20,
              marginBottom: -20
            }} />
          )}
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
                right: '-2px',
                bottom: '-2px',
                top: '-2px',
                background: 'linear-gradient(to right, transparent calc(50% - 1px), rgba(128, 128, 128, 0.3) calc(50% - 1px), rgba(128, 128, 128, 0.3) calc(50% + 1px), transparent calc(50% + 1px))',
              }}
            />
          )}
        >
          <div className="modal-content-inner px-6 py-4">
            {children}
          </div>
        </Scrollbars>
      );
    }

    return (
      <Scrollbars
        autoHide
        autoHideTimeout={1000}
        style={{ flex: 1, minHeight: 0 }}
        renderView={({ style, ...props }) => (
          <div {...props} style={{
            ...style,
            backgroundColor: 'var(--bg-toolbar)',
            marginRight: -20,
            marginBottom: -20
          }} />
        )}
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
              right: '-2px',
              bottom: '-2px',
              top: '-2px',
              background: 'linear-gradient(to right, transparent calc(50% - 1px), rgba(128, 128, 128, 0.3) calc(50% - 1px), rgba(128, 128, 128, 0.3) calc(50% + 1px), transparent calc(50% + 1px))',
            }}
          />
        )}
      >
        <div className="modal-content-inner px-6 py-4">
          {children}
        </div>
      </Scrollbars>
    );
  };

  return (
    <div
      className={`fixed inset-0 flex ${alignClass} justify-center p-4`}
      style={{ backgroundColor: 'var(--bg-modal-backdrop)', zIndex: 5000 }}
      onClick={handleOverlayClick}
    >
      <div
        className={`base-modal w-full ${sizeClass} ${layoutClass} bg-[var(--bg-toolbar)] rounded-xl shadow-modal flex flex-col overflow-hidden ${className || ''}`}
        style={{
          minHeight: finalMinHeight,
          maxHeight: finalMaxHeight,
          ...(variant === 'fullscreen' && { height: finalMaxHeight })
        }}
        onClick={handleContentClick}
      >
        {/* Header - Fixed */}
        {!header && (
          <div className="modal-header flex items-center justify-between px-6 pt-6 pb-3 flex-shrink-0">
            <h3 className="text-lg font-semibold">{title}</h3>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-[var(--bg-canvas)] rounded transition-colors"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* Custom Header Content */}
        {header && (
          <div className="modal-header-custom flex-shrink-0">
            {header}
          </div>
        )}

        {/* Main Content Area */}
        <div className={`modal-body flex-1 flex ${sidebar ? 'flex-row' : 'flex-col'} overflow-hidden`}>
          {/* Sidebar (optional) */}
          {sidebar && (
            <div className="modal-sidebar flex-shrink-0 border-r border-[var(--border-color)] px-4 py-4">
              {sidebar}
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {renderScrollableContent()}
          </div>
        </div>

        {/* Footer (optional) */}
        {footer && (
          <div className="modal-footer flex-shrink-0 border-t border-[var(--border-color)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};