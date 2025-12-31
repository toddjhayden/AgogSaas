import React from 'react';
import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className }) => (
  <div className={clsx('bg-white rounded-lg shadow-sm border border-gray-200', className)}>
    {children}
  </div>
);

export const CardHeader: React.FC<CardProps> = ({ children, className }) => (
  <div className={clsx('px-6 py-4 border-b border-gray-100', className)}>
    {children}
  </div>
);

export const CardTitle: React.FC<CardProps> = ({ children, className }) => (
  <h3 className={clsx('text-lg font-semibold text-gray-900', className)}>
    {children}
  </h3>
);

export const CardDescription: React.FC<CardProps> = ({ children, className }) => (
  <p className={clsx('text-sm text-gray-500 mt-1', className)}>
    {children}
  </p>
);

export const CardContent: React.FC<CardProps> = ({ children, className }) => (
  <div className={clsx('px-6 py-4', className)}>
    {children}
  </div>
);
