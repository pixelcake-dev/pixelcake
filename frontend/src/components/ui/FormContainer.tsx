import React from 'react';

type FormGap = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '8';
type FormColumns = 1 | 2 | 3 | 4;

interface FormContainerProps {
  children: React.ReactNode;
  gap?: FormGap;
  columns?: FormColumns | { base?: FormColumns; sm?: FormColumns; md?: FormColumns; lg?: FormColumns };
  className?: string;
  direction?: 'vertical' | 'horizontal';
  fullWidth?: boolean;
}

const gapClasses: Record<FormGap, string> = {
  '0': 'gap-0',
  '1': 'gap-1',
  '2': 'gap-2',
  '3': 'gap-3',
  '4': 'gap-4',
  '5': 'gap-5',
  '6': 'gap-6',
  '8': 'gap-8',
};

const columnClasses: Record<FormColumns, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

export const FormContainer: React.FC<FormContainerProps> = ({
  children,
  gap = '4',
  columns = 1,
  className = '',
  direction = 'vertical',
  fullWidth = true,
}) => {
  const gapClass = gapClasses[gap];

  // Handle responsive columns
  const getColumnClasses = () => {
    if (typeof columns === 'number') {
      return columnClasses[columns];
    }

    const classes: string[] = [];
    if (columns.base) classes.push(columnClasses[columns.base]);
    if (columns.sm) classes.push(`sm:${columnClasses[columns.sm]}`);
    if (columns.md) classes.push(`md:${columnClasses[columns.md]}`);
    if (columns.lg) classes.push(`lg:${columnClasses[columns.lg]}`);

    return classes.join(' ');
  };

  // For vertical single column layout, use flex
  if (direction === 'vertical' && columns === 1) {
    return (
      <div
        className={`flex flex-col ${gapClass} ${fullWidth ? 'w-full' : ''} ${className}`}
      >
        {children}
      </div>
    );
  }

  // For horizontal or multi-column layout, use grid
  return (
    <div
      className={`grid ${getColumnClasses()} ${gapClass} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

// FormFieldset for grouped fields with border
interface FormFieldsetProps {
  children: React.ReactNode;
  legend: string;
  className?: string;
}

export const FormFieldset: React.FC<FormFieldsetProps> = ({
  children,
  legend,
  className = '',
}) => {
  return (
    <fieldset className={className}>
      {/* (its look is the one every legend has: see the style sheet) */}
      <legend>
        {legend}
      </legend>
      {children}
    </fieldset>
  );
};