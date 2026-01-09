import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = createContext<SelectContextType | null>(null);

interface SelectProps {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
}

export const Select: React.FC<SelectProps> = ({
  children,
  value: controlledValue,
  onValueChange,
  defaultValue = '',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);

  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
    setOpen(false);
  };

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen }}>
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  );
};

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export const SelectTrigger: React.FC<SelectTriggerProps> = ({ children, className }) => {
  const context = useContext(SelectContext);
  if (!context) throw new Error('SelectTrigger must be used within Select');

  return (
    <button
      type="button"
      onClick={() => context.setOpen(!context.open)}
      className={clsx(
        'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
        'focus:outline-none focus:ring-2 focus:ring-blue-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      {children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-2"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
};

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

export const SelectContent: React.FC<SelectContentProps> = ({ children, className }) => {
  const context = useContext(SelectContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        context?.setOpen(false);
      }
    };
    if (context?.open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [context?.open, context]);

  if (!context?.open) return null;

  return (
    <div
      ref={ref}
      className={clsx(
        'absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg',
        className
      )}
    >
      {children}
    </div>
  );
};

interface SelectItemProps {
  children: React.ReactNode;
  value: string;
  className?: string;
}

export const SelectItem: React.FC<SelectItemProps> = ({ children, value, className }) => {
  const context = useContext(SelectContext);
  if (!context) throw new Error('SelectItem must be used within Select');

  const isSelected = context.value === value;

  return (
    <div
      onClick={() => context.onValueChange(value)}
      className={clsx(
        'cursor-pointer px-3 py-2 text-sm hover:bg-gray-100',
        isSelected && 'bg-gray-50 font-medium',
        className
      )}
    >
      {children}
    </div>
  );
};

interface SelectValueProps {
  placeholder?: string;
}

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder }) => {
  const context = useContext(SelectContext);
  if (!context) throw new Error('SelectValue must be used within Select');

  return (
    <span className={clsx(!context.value && 'text-gray-400')}>
      {context.value || placeholder}
    </span>
  );
};
