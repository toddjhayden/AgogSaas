import React from 'react';
import { Award } from 'lucide-react';
import clsx from 'clsx';

export interface TierBadgeProps {
  tier: 'STRATEGIC' | 'PREFERRED' | 'TRANSACTIONAL' | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const TIER_CONFIG = {
  STRATEGIC: {
    label: 'Strategic',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    iconColor: 'text-green-600',
    description: 'Top 10-15% of spend, mission-critical'
  },
  PREFERRED: {
    label: 'Preferred',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300',
    iconColor: 'text-blue-600',
    description: '15-40% of spend, important partnerships'
  },
  TRANSACTIONAL: {
    label: 'Transactional',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-300',
    iconColor: 'text-gray-600',
    description: 'Remaining vendors, annual reviews'
  }
};

const SIZE_CONFIG = {
  sm: {
    badge: 'px-2 py-0.5 text-xs',
    icon: 'h-3 w-3'
  },
  md: {
    badge: 'px-2.5 py-1 text-sm',
    icon: 'h-4 w-4'
  },
  lg: {
    badge: 'px-3 py-1.5 text-base',
    icon: 'h-5 w-5'
  }
};

/**
 * TierBadge - Displays vendor tier classification with color coding
 *
 * - STRATEGIC: Green badge (top performers)
 * - PREFERRED: Blue badge (important vendors)
 * - TRANSACTIONAL: Gray badge (standard vendors)
 *
 * Features:
 * - Color-coded by tier
 * - Optional Award icon
 * - Configurable size (sm/md/lg)
 * - Tooltip with tier description
 */
export const TierBadge: React.FC<TierBadgeProps> = ({
  tier,
  size = 'md',
  showIcon = true,
  className
}) => {
  if (!tier || !TIER_CONFIG[tier]) {
    return null;
  }

  const config = TIER_CONFIG[tier];
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium border',
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeConfig.badge,
        className
      )}
      title={config.description}
    >
      {showIcon && <Award className={clsx(sizeConfig.icon, config.iconColor)} />}
      <span>{config.label}</span>
    </span>
  );
};
