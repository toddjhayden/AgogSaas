import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import clsx from 'clsx';

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
}

interface AlertPanelProps {
  alerts: Alert[];
  onDismiss?: (alertId: string) => void;
  maxVisible?: number;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({
  alerts,
  onDismiss,
  maxVisible = 5,
}) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  const visibleAlerts = showAll ? alerts : alerts.slice(0, maxVisible);

  const getAlertConfig = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-danger-50',
          borderColor: 'border-danger-500',
          textColor: 'text-danger-700',
          iconColor: 'text-danger-600',
        };
      case 'warning':
        return {
          icon: AlertCircle,
          bgColor: 'bg-warning-50',
          borderColor: 'border-warning-500',
          textColor: 'text-warning-700',
          iconColor: 'text-warning-600',
        };
      case 'info':
        return {
          icon: Info,
          bgColor: 'bg-primary-50',
          borderColor: 'border-primary-500',
          textColor: 'text-primary-700',
          iconColor: 'text-primary-600',
        };
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">{t('dashboard.alerts')}</h3>
        <p className="text-gray-500 text-center py-8">{t('common.noData')}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{t('dashboard.alerts')}</h3>
        <span className="text-sm text-gray-500">
          {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
        </span>
      </div>

      <div className="space-y-3">
        {visibleAlerts.map((alert) => {
          const config = getAlertConfig(alert.type);
          const Icon = config.icon;

          return (
            <div
              key={alert.id}
              className={clsx(
                'border-l-4 rounded-lg p-4 flex items-start space-x-3',
                config.bgColor,
                config.borderColor
              )}
            >
              <Icon className={clsx('h-5 w-5 flex-shrink-0 mt-0.5', config.iconColor)} />

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className={clsx('font-medium text-sm', config.textColor)}>
                      {alert.title}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>

                  {onDismiss && (
                    <button
                      onClick={() => onDismiss(alert.id)}
                      className="ml-2 p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      <X className="h-4 w-4 text-gray-500" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {alerts.length > maxVisible && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          {showAll ? 'Show Less' : `View All ${alerts.length} Alerts`}
        </button>
      )}
    </div>
  );
};
