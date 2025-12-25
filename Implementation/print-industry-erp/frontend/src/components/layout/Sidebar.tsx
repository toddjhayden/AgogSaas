import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Factory,
  Warehouse,
  DollarSign,
  ShieldCheck,
  ShoppingCart,
  BarChart3,
  FileText,
  Package,
  Brain,
  Activity,
  Shield,
  Box,
  Layers,
  Award,
  Users,
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'nav.dashboard' },
  { path: '/operations', icon: Factory, label: 'nav.operations' },
  { path: '/wms', icon: Warehouse, label: 'nav.wms' },
  { path: '/wms/bin-utilization', icon: Package, label: 'nav.binUtilization' },
  { path: '/wms/bin-utilization-enhanced', icon: Brain, label: 'nav.binUtilizationEnhanced' },
  { path: '/wms/health', icon: Activity, label: 'nav.healthMonitoring' },
  { path: '/wms/data-quality', icon: Shield, label: 'nav.dataQuality' },
  { path: '/wms/fragmentation', icon: Box, label: 'nav.fragmentation' },
  { path: '/wms/3d-optimization', icon: Layers, label: 'nav.3dOptimization' },
  { path: '/finance', icon: DollarSign, label: 'nav.finance' },
  { path: '/quality', icon: ShieldCheck, label: 'nav.quality' },
  { path: '/marketplace', icon: ShoppingCart, label: 'nav.marketplace' },
  { path: '/procurement/purchase-orders', icon: FileText, label: 'nav.procurement' },
  { path: '/procurement/vendor-scorecard', icon: Award, label: 'nav.vendorScorecard' },
  { path: '/procurement/vendor-comparison', icon: Users, label: 'nav.vendorComparison' },
  { path: '/kpis', icon: BarChart3, label: 'nav.kpis' },
];

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();

  return (
    <aside className="bg-gray-900 text-white w-64 min-h-screen p-4">
      <nav className="space-y-2 mt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{t(item.label)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
