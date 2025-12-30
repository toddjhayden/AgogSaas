import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { I18nextProvider } from 'react-i18next';
import { Toaster, toast } from 'react-hot-toast';
import { apolloClient } from './graphql/client';
import i18n from './i18n/config';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { EmailVerificationPage } from './pages/auth/EmailVerificationPage';
import { EmailVerificationReminderPage } from './pages/auth/EmailVerificationReminderPage';
import { setupAuthorizationErrorHandler } from './utils/tenantIsolation';
import { useAuthStore } from './store/authStore';
import { useAppStore } from './store/appStore';
import { ExecutiveDashboard } from './pages/ExecutiveDashboard';
import { OperationsDashboard } from './pages/OperationsDashboard';
import { WMSDashboard } from './pages/WMSDashboard';
import { FinanceDashboard } from './pages/FinanceDashboard';
import { QualityDashboard } from './pages/QualityDashboard';
import { CodeQualityDashboard } from './pages/CodeQualityDashboard';
import { MarketplaceDashboard } from './pages/MarketplaceDashboard';
import { KPIExplorer } from './pages/KPIExplorer';
import { MonitoringDashboard } from './pages/MonitoringDashboard';
import { OrchestratorDashboard } from './pages/OrchestratorDashboard';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { PurchaseOrderDetailPage } from './pages/PurchaseOrderDetailPage';
import { PurchaseOrderDetailPageEnhanced } from './pages/PurchaseOrderDetailPageEnhanced';
import { CreatePurchaseOrderPage } from './pages/CreatePurchaseOrderPage';
import { MyApprovalsPage } from './pages/MyApprovalsPage';
import { BinUtilizationDashboard } from './pages/BinUtilizationDashboard';
import { BinUtilizationEnhancedDashboard } from './pages/BinUtilizationEnhancedDashboard';
import { BinOptimizationHealthDashboard } from './pages/BinOptimizationHealthDashboard';
import { BinDataQualityDashboard } from './pages/BinDataQualityDashboard';
import { BinFragmentationDashboard } from './pages/BinFragmentationDashboard';
import { Bin3DOptimizationDashboard } from './pages/Bin3DOptimizationDashboard';
import BinUtilizationPredictionDashboard from './pages/BinUtilizationPredictionDashboard';
import BinOptimizationConfigPage from './pages/BinOptimizationConfigPage';
import { VendorScorecardDashboard } from './pages/VendorScorecardDashboard';
import { VendorScorecardEnhancedDashboard } from './pages/VendorScorecardEnhancedDashboard';
import { VendorComparisonDashboard } from './pages/VendorComparisonDashboard';
import { VendorScorecardConfigPage } from './pages/VendorScorecardConfigPage';
import { InventoryForecastingDashboard } from './pages/InventoryForecastingDashboard';
import SalesQuoteDashboard from './pages/SalesQuoteDashboard';
import SalesQuoteDetailPage from './pages/SalesQuoteDetailPage';
import { PerformanceAnalyticsDashboard } from './pages/PerformanceAnalyticsDashboard';
import { PredictiveMaintenanceDashboard } from './pages/PredictiveMaintenanceDashboard';
import { ProductionPlanningDashboard } from './pages/ProductionPlanningDashboard';
import { WorkCenterMonitoringDashboard } from './pages/WorkCenterMonitoringDashboard';
import { ProductionRunExecutionPage } from './pages/ProductionRunExecutionPage';
import { ProductionAnalyticsDashboard } from './pages/ProductionAnalyticsDashboard';
import SPCDashboard from './pages/SPCDashboard';
import SPCControlChartPage from './pages/SPCControlChartPage';
import SPCAlertManagementPage from './pages/SPCAlertManagementPage';
import BusinessIntelligenceDashboard from './pages/BusinessIntelligenceDashboard';
import AdvancedAnalyticsDashboard from './pages/AdvancedAnalyticsDashboard';
import ReportBuilderPage from './pages/ReportBuilderPage';
import EstimatesDashboard from './pages/EstimatesDashboard';
import JobCostingDashboard from './pages/JobCostingDashboard';
import VarianceReportPage from './pages/VarianceReportPage';
import { PreflightDashboard } from './pages/PreflightDashboard';
import { PreflightProfilesPage } from './pages/PreflightProfilesPage';
import { PreflightReportDetailPage } from './pages/PreflightReportDetailPage';
import { ColorProofManagementPage } from './pages/ColorProofManagementPage';
import { PaymentManagementPage } from './pages/PaymentManagementPage';
import { InvoiceManagementPage } from './pages/InvoiceManagementPage';
import { PaymentProcessingPage } from './pages/PaymentProcessingPage';
import MyTasksPage from './pages/MyTasksPage';
import WorkflowInstancesPage from './pages/WorkflowInstancesPage';
import WorkflowInstanceDetailPage from './pages/WorkflowInstanceDetailPage';
import WorkflowAnalyticsDashboard from './pages/WorkflowAnalyticsDashboard';
import { QualityGateValidationDetailPage } from './pages/QualityGateValidationDetailPage';
import { CRMDashboard } from './pages/CRMDashboard';
import { ContactManagementPage } from './pages/ContactManagementPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { PipelineManagementPage } from './pages/PipelineManagementPage';
import { OpportunityDetailPage } from './pages/OpportunityDetailPage';
import SupplierDashboard from './pages/SupplierDashboard';
import SupplierPurchaseOrdersPage from './pages/SupplierPurchaseOrdersPage';
import SupplierPurchaseOrderDetailPage from './pages/SupplierPurchaseOrderDetailPage';
import SupplierCreateASNPage from './pages/SupplierCreateASNPage';
import SupplierPerformanceDashboard from './pages/SupplierPerformanceDashboard';
import './index.css';

const App: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const setTenantId = useAppStore((state) => state.setTenantId);

  // Extract tenant ID from authenticated user's JWT payload and set it in app store
  // This ensures proper Row-Level Security (RLS) enforcement for multi-tenancy
  useEffect(() => {
    if (user?.tenantId) {
      // The tenant ID from the JWT token is used for RLS enforcement
      // This is passed to the GraphQL backend via x-tenant-id header
      setTenantId(user.tenantId);
    }
  }, [user, setTenantId]);

  // Setup authorization error handler
  useEffect(() => {
    setupAuthorizationErrorHandler((error) => {
      toast.error(error.message || 'Access denied to this resource', {
        duration: 5000,
        icon: '🔒',
      });
    });
  }, []);

  return (
    <ErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <I18nextProvider i18n={i18n}>
          <Toaster position="top-right" />
          <Router>
            <Routes>
              {/* Public routes - authentication */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
              <Route path="/verify-email/:token" element={<EmailVerificationPage />} />
              <Route path="/verify-email-reminder" element={<EmailVerificationReminderPage />} />

              {/* Protected routes - require authentication */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<ExecutiveDashboard />} />
                <Route path="/operations" element={<OperationsDashboard />} />
                <Route path="/wms" element={<WMSDashboard />} />
                <Route path="/finance" element={<FinanceDashboard />} />
                <Route path="/quality" element={<QualityDashboard />} />
                <Route path="/quality/code-quality" element={<CodeQualityDashboard />} />
                <Route path="/marketplace" element={<MarketplaceDashboard />} />
                <Route path="/kpis" element={<KPIExplorer />} />
                <Route path="/monitoring" element={<MonitoringDashboard />} />
                <Route path="/orchestrator" element={<OrchestratorDashboard />} />
                <Route path="/procurement/purchase-orders" element={<PurchaseOrdersPage />} />
                <Route path="/procurement/purchase-orders/new" element={<CreatePurchaseOrderPage />} />
                <Route path="/procurement/purchase-orders/:id" element={<PurchaseOrderDetailPageEnhanced />} />
                <Route path="/approvals/my-approvals" element={<MyApprovalsPage />} />
                <Route path="/procurement/my-approvals" element={<Navigate to="/approvals/my-approvals" replace />} />
                <Route path="/wms/bin-utilization" element={<BinUtilizationDashboard />} />
                <Route path="/wms/bin-utilization-enhanced" element={<BinUtilizationEnhancedDashboard />} />
                <Route path="/wms/health" element={<BinOptimizationHealthDashboard />} />
                <Route path="/wms/data-quality" element={<BinDataQualityDashboard />} />
                <Route path="/wms/fragmentation" element={<BinFragmentationDashboard />} />
                <Route path="/wms/3d-optimization" element={<Bin3DOptimizationDashboard />} />
                <Route path="/wms/bin-prediction" element={<BinUtilizationPredictionDashboard />} />
                <Route path="/wms/optimization-config" element={<BinOptimizationConfigPage />} />
                <Route path="/procurement/vendor-scorecard" element={<VendorScorecardDashboard />} />
                <Route path="/procurement/vendor-scorecard-enhanced" element={<VendorScorecardEnhancedDashboard />} />
                <Route path="/procurement/vendor-comparison" element={<VendorComparisonDashboard />} />
                <Route path="/procurement/vendor-config" element={<VendorScorecardConfigPage />} />
                <Route path="/operations/forecasting" element={<InventoryForecastingDashboard />} />
                <Route path="/operations/production-planning" element={<ProductionPlanningDashboard />} />
                <Route path="/operations/work-center-monitoring" element={<WorkCenterMonitoringDashboard />} />
                <Route path="/operations/production-analytics" element={<ProductionAnalyticsDashboard />} />
                <Route path="/operations/production-runs/:id" element={<ProductionRunExecutionPage />} />
                <Route path="/operations/predictive-maintenance" element={<PredictiveMaintenanceDashboard />} />
                <Route path="/sales/quotes" element={<SalesQuoteDashboard />} />
                <Route path="/sales/quotes/:quoteId" element={<SalesQuoteDetailPage />} />
                <Route path="/monitoring/performance" element={<PerformanceAnalyticsDashboard />} />
                <Route path="/quality/spc" element={<SPCDashboard />} />
                <Route path="/quality/spc/chart/:parameterCode" element={<SPCControlChartPage />} />
                <Route path="/quality/spc/alerts" element={<SPCAlertManagementPage />} />
                <Route path="/analytics/business-intelligence" element={<BusinessIntelligenceDashboard />} />
                <Route path="/analytics/advanced" element={<AdvancedAnalyticsDashboard />} />
                <Route path="/analytics/reports" element={<ReportBuilderPage />} />
                <Route path="/estimating/estimates" element={<EstimatesDashboard />} />
                <Route path="/estimating/job-costs" element={<JobCostingDashboard />} />
                <Route path="/estimating/variance-report" element={<VarianceReportPage />} />
                <Route path="/operations/preflight" element={<PreflightDashboard />} />
                <Route path="/operations/preflight/profiles" element={<PreflightProfilesPage />} />
                <Route path="/operations/preflight/reports/:id" element={<PreflightReportDetailPage />} />
                <Route path="/operations/color-proofs" element={<ColorProofManagementPage />} />
                <Route path="/finance/payments" element={<PaymentManagementPage />} />
                <Route path="/finance/invoices" element={<InvoiceManagementPage />} />
                <Route path="/finance/payments-processing" element={<PaymentProcessingPage />} />
                <Route path="/workflows/my-tasks" element={<MyTasksPage />} />
                <Route path="/workflows/instances" element={<WorkflowInstancesPage />} />
                <Route path="/workflows/instances/:instanceId" element={<WorkflowInstanceDetailPage />} />
                <Route path="/workflows/analytics" element={<WorkflowAnalyticsDashboard />} />
                <Route path="/quality/code-quality/validations/:id" element={<QualityGateValidationDetailPage />} />
                <Route path="/crm" element={<CRMDashboard />} />
                <Route path="/crm/contacts" element={<ContactManagementPage />} />
                <Route path="/crm/contacts/:id" element={<ContactDetailPage />} />
                <Route path="/crm/pipeline" element={<PipelineManagementPage />} />
                <Route path="/crm/opportunities" element={<PipelineManagementPage />} />
                <Route path="/crm/opportunities/:id" element={<OpportunityDetailPage />} />
                {/* Supplier Portal Routes - REQ-STRATEGIC-AUTO-1767116143666 */}
                <Route path="/supplier" element={<SupplierDashboard />} />
                <Route path="/supplier/dashboard" element={<SupplierDashboard />} />
                <Route path="/supplier/purchase-orders" element={<SupplierPurchaseOrdersPage />} />
                <Route path="/supplier/purchase-orders/:poNumber" element={<SupplierPurchaseOrderDetailPage />} />
                <Route path="/supplier/asn/create" element={<SupplierCreateASNPage />} />
                <Route path="/supplier/performance" element={<SupplierPerformanceDashboard />} />
              </Route>
            </Routes>
          </Router>
        </I18nextProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
};

export default App;
