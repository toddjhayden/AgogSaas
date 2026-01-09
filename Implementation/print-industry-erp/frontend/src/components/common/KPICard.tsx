import React from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

export interface KPIData {
  id: string;
  name: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  sparklineData?: number[];
  formula?: string;
}

export interface KPICardProps {
  kpi?: KPIData;
  // Direct props as alternative to kpi object
  id?: string;
  name?: string;
  title?: string; // Alias for name
  currentValue?: number;
  value?: string | number; // Alias for currentValue
  targetValue?: number;
  unit?: string;
  suffix?: string; // Alias for unit
  trend?: 'up' | 'down' | 'stable';
  trendPercent?: number;
  sparklineData?: number[];
  formula?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
}

export const KPICard: React.FC<KPICardProps> = (props) => {
  const { kpi, size = 'md', onClick, icon: _IconComponent, color: _color } = props;
  const { t } = useTranslation();
  // Note: icon and color props are reserved for future use

  // Support both kpi object and direct props (including aliases)
  const name = kpi?.name ?? props.name ?? props.title ?? '';
  const rawValue = kpi?.currentValue ?? props.currentValue ?? props.value ?? 0;
  const currentValue = typeof rawValue === 'string' ? parseFloat(rawValue) || 0 : rawValue;
  const targetValue = kpi?.targetValue ?? props.targetValue ?? currentValue; // Default to currentValue if not provided
  const unit = kpi?.unit ?? props.unit ?? props.suffix ?? '';
  const trend = kpi?.trend ?? props.trend ?? 'stable';
  const trendPercent = kpi?.trendPercent ?? props.trendPercent ?? 0;
  const sparklineData = kpi?.sparklineData ?? props.sparklineData;
  const formula = kpi?.formula ?? props.formula;

  // Calculate performance percentage
  const performancePercent = (currentValue / targetValue) * 100;

  // Determine color based on performance
  const getStatusColor = () => {
    if (performancePercent >= 100) return 'success';
    if (performancePercent >= 80) return 'warning';
    return 'danger';
  };

  const statusColor = getStatusColor();

  const colorClasses = {
    success: 'border-success-500 bg-success-50',
    warning: 'border-warning-500 bg-warning-50',
    danger: 'border-danger-500 bg-danger-50',
  };

  const textColorClasses = {
    success: 'text-success-600',
    warning: 'text-warning-600',
    danger: 'text-danger-600',
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={clsx(
        'card border-l-4 hover:shadow-md transition-shadow cursor-pointer',
        colorClasses[statusColor],
        sizeClasses[size]
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-600 mb-1">{name}</h3>
          <div className="flex items-baseline space-x-2">
            <span className={clsx('text-3xl font-bold', textColorClasses[statusColor])}>
              {currentValue.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500">{unit}</span>
          </div>
        </div>

        {formula && (
          <button className="p-1 hover:bg-gray-100 rounded group relative">
            <Info className="h-4 w-4 text-gray-400" />
            <div className="absolute hidden group-hover:block right-0 top-full mt-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 z-10">
              <strong>{t('kpis.card.formulaLabel')}:</strong> {formula}
            </div>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">
          {t('kpis.card.target')}: <span className="font-medium">{targetValue.toLocaleString()} {unit}</span>
        </div>
        <div className={clsx('flex items-center space-x-1', textColorClasses[statusColor])}>
          <TrendIcon className="h-4 w-4" />
          <span className="text-sm font-medium">{Math.abs(trendPercent)}%</span>
        </div>
      </div>

      {sparklineData && sparklineData.length > 0 && (
        <div className="h-12 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData.map((value, index) => ({ value, index }))}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={statusColor === 'success' ? '#22c55e' : statusColor === 'warning' ? '#eab308' : '#ef4444'}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">{t('kpis.card.performance')}</span>
          <span className={clsx('font-semibold', textColorClasses[statusColor])}>
            {performancePercent.toFixed(1)}%
          </span>
        </div>
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all',
              statusColor === 'success' ? 'bg-success-500' :
              statusColor === 'warning' ? 'bg-warning-500' : 'bg-danger-500'
            )}
            style={{ width: `${Math.min(performancePercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
