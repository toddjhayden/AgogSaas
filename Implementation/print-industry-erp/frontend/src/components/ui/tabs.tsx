import React, { createContext, useContext, useState } from 'react';
import clsx from 'clsx';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

export interface TabsProps {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  children,
  defaultValue = '',
  value: controlledValue,
  onValueChange,
  className
}) => {
  const [internalTab, setInternalTab] = useState(defaultValue);

  const activeTab = controlledValue !== undefined ? controlledValue : internalTab;
  const setActiveTab = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalTab(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={clsx('w-full', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className
}) => (
  <div className={clsx('inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1', className)}>
    {children}
  </div>
);

interface TabsTriggerProps {
  children: React.ReactNode;
  value: string;
  className?: string;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ children, value, className }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === value;

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={clsx(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all',
        isActive
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-900',
        className
      )}
    >
      {children}
    </button>
  );
};

interface TabsContentProps {
  children: React.ReactNode;
  value: string;
  className?: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({ children, value, className }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  const { activeTab } = context;

  if (activeTab !== value) return null;

  return (
    <div className={clsx('mt-4', className)}>
      {children}
    </div>
  );
};
