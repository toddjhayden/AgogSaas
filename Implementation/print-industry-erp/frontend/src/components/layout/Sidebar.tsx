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
  FileCheck,
  TrendingUp,
  CheckSquare,
  Settings,
  Gauge,
  Calendar,
  Monitor,
  LineChart,
  Target,
  AlertTriangle,
  PieChart,
  Database,
  Download,
  Calculator,
  Briefcase,
  FileSearch,
  Palette,
  CreditCard,
  Receipt,
  FileText as InvoiceIcon,
  Code,
  Workflow,
  ListTodo,
  GitBranch,
  Wrench,
  UserCircle,
  Target as TargetIcon,
  Truck,
  ClipboardList,
  Server,
  Rocket,
  Undo2,
  ShieldAlert,
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'nav.dashboard' },
  { path: '/operations', icon: Factory, label: 'nav.operations' },
  { path: '/operations/forecasting', icon: TrendingUp, label: 'nav.forecasting' },
  { path: '/operations/production-planning', icon: Calendar, label: 'nav.productionPlanning' },
  { path: '/operations/work-center-monitoring', icon: Monitor, label: 'nav.workCenterMonitoring' },
  { path: '/operations/production-analytics', icon: LineChart, label: 'nav.productionAnalytics' },
  { path: '/operations/predictive-maintenance', icon: Wrench, label: 'nav.predictiveMaintenance' },
  { path: '/operations/preflight', icon: FileSearch, label: 'nav.preflight' },
  { path: '/operations/preflight/profiles', icon: Palette, label: 'nav.preflightProfiles' },
  { path: '/wms', icon: Warehouse, label: 'nav.wms' },
  { path: '/wms/bin-utilization', icon: Package, label: 'nav.binUtilization' },
  { path: '/wms/bin-utilization-enhanced', icon: Brain, label: 'nav.binUtilizationEnhanced' },
  { path: '/wms/health', icon: Activity, label: 'nav.healthMonitoring' },
  { path: '/wms/data-quality', icon: Shield, label: 'nav.dataQuality' },
  { path: '/wms/fragmentation', icon: Box, label: 'nav.fragmentation' },
  { path: '/wms/3d-optimization', icon: Layers, label: 'nav.3dOptimization' },
  { path: '/finance', icon: DollarSign, label: 'nav.finance' },
  { path: '/finance/invoices', icon: InvoiceIcon, label: 'nav.invoices' },
  { path: '/finance/payments-processing', icon: Receipt, label: 'nav.paymentProcessing' },
  { path: '/finance/payments', icon: CreditCard, label: 'nav.payments' },
  { path: '/quality', icon: ShieldCheck, label: 'nav.quality' },
  { path: '/quality/code-quality', icon: Code, label: 'nav.codeQuality' },
  { path: '/quality/spc', icon: Target, label: 'nav.spc' },
  { path: '/quality/spc/alerts', icon: AlertTriangle, label: 'nav.spcAlerts' },
  { path: '/marketplace', icon: ShoppingCart, label: 'nav.marketplace' },
  { path: '/approvals/my-approvals', icon: CheckSquare, label: 'nav.myApprovals' },
  { path: '/procurement/purchase-orders', icon: FileText, label: 'nav.procurement' },
  { path: '/procurement/vendor-scorecard', icon: Award, label: 'nav.vendorScorecard' },
  { path: '/procurement/vendor-comparison', icon: Users, label: 'nav.vendorComparison' },
  { path: '/procurement/vendor-config', icon: Settings, label: 'nav.vendorConfig' },
  { path: '/sales/quotes', icon: FileCheck, label: 'nav.quotes' },
  { path: '/crm', icon: UserCircle, label: 'nav.crm' },
  { path: '/crm/contacts', icon: Users, label: 'nav.contacts' },
  { path: '/crm/pipeline', icon: TargetIcon, label: 'nav.pipeline' },
  { path: '/estimating/estimates', icon: Calculator, label: 'nav.estimates' },
  { path: '/estimating/job-costs', icon: Briefcase, label: 'nav.jobCosting' },
  { path: '/estimating/variance-report', icon: BarChart3, label: 'nav.varianceReport' },
  { path: '/monitoring/performance', icon: Gauge, label: 'nav.performanceAnalytics' },
  { path: '/kpis', icon: BarChart3, label: 'nav.kpis' },
  { path: '/analytics/business-intelligence', icon: PieChart, label: 'nav.businessIntelligence' },
  { path: '/analytics/advanced', icon: Database, label: 'nav.advancedAnalytics' },
  { path: '/analytics/reports', icon: Download, label: 'nav.reportBuilder' },
  { path: '/workflows/my-tasks', icon: ListTodo, label: 'nav.myTasks' },
  { path: '/workflows/instances', icon: GitBranch, label: 'nav.workflowInstances' },
  { path: '/workflows/analytics', icon: Workflow, label: 'nav.workflowAnalytics' },
  // Supplier Portal - REQ-STRATEGIC-AUTO-1767116143666
  { path: '/supplier', icon: Truck, label: 'nav.supplierPortal' },
  { path: '/supplier/purchase-orders', icon: ClipboardList, label: 'nav.supplierPurchaseOrders' },
  { path: '/supplier/performance', icon: Award, label: 'nav.supplierPerformance' },
  // DevOps/Edge - REQ-DEVOPS-EDGE-PROVISION-1767150339448
  { path: '/devops/edge-provisioning', icon: Server, label: 'nav.edgeProvisioning' },
  // DevOps Deployment Approvals - REQ-DEVOPS-DEPLOY-APPROVAL-1767150339448
  { path: '/devops/deployment-approvals', icon: Rocket, label: 'nav.deploymentApprovals' },
  // DevOps Rollback Decision - REQ-DEVOPS-ROLLBACK-1767150339448
  { path: '/devops/rollback-decision', icon: Undo2, label: 'nav.rollbackDecision' },
  // Security Audit Dashboard - REQ-DEVOPS-SECURITY-1767150339448
  { path: '/security/audit', icon: ShieldAlert, label: 'nav.securityAudit' },
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
