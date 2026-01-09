import React, { createContext, useContext, useEffect } from 'react';
import clsx from 'clsx';

interface DialogContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextType | null>(null);

interface DialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Dialog: React.FC<DialogProps> = ({
  children,
  open = false,
  onOpenChange = () => {},
}) => {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
};

export const DialogTrigger: React.FC<{
  children: React.ReactNode;
  asChild?: boolean;
}> = ({ children }) => {
  const context = useContext(DialogContext);
  if (!context) throw new Error('DialogTrigger must be used within Dialog');

  return (
    <span onClick={() => context.onOpenChange(true)} className="cursor-pointer">
      {children}
    </span>
  );
};

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogContent: React.FC<DialogContentProps> = ({
  children,
  className,
}) => {
  const context = useContext(DialogContext);
  if (!context) throw new Error('DialogContent must be used within Dialog');

  const { open, onOpenChange } = context;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={clsx(
          'relative z-50 w-full max-w-lg rounded-lg bg-white p-6 shadow-lg',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
};

export const DialogHeader: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div className={clsx('flex flex-col space-y-1.5 text-center sm:text-left', className)}>
    {children}
  </div>
);

export const DialogFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div
    className={clsx(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4',
      className
    )}
  >
    {children}
  </div>
);

export const DialogTitle: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <h2 className={clsx('text-lg font-semibold leading-none tracking-tight', className)}>
    {children}
  </h2>
);

export const DialogDescription: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <p className={clsx('text-sm text-gray-500', className)}>{children}</p>
);
