import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { I18nextProvider } from 'react-i18next';
import { apolloClient } from './graphql/client';
import i18n from './i18n/config';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { MainLayout } from './components/layout/MainLayout';
import { ExecutiveDashboard } from './pages/ExecutiveDashboard';
import { OperationsDashboard } from './pages/OperationsDashboard';
import { WMSDashboard } from './pages/WMSDashboard';
import { FinanceDashboard } from './pages/FinanceDashboard';
import { QualityDashboard } from './pages/QualityDashboard';
import { MarketplaceDashboard } from './pages/MarketplaceDashboard';
import { KPIExplorer } from './pages/KPIExplorer';
import { MonitoringDashboard } from './pages/MonitoringDashboard';
import { OrchestratorDashboard } from './pages/OrchestratorDashboard';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { PurchaseOrderDetailPage } from './pages/PurchaseOrderDetailPage';
import { CreatePurchaseOrderPage } from './pages/CreatePurchaseOrderPage';
import { BinUtilizationDashboard } from './pages/BinUtilizationDashboard';
import { BinUtilizationEnhancedDashboard } from './pages/BinUtilizationEnhancedDashboard';
import { BinOptimizationHealthDashboard } from './pages/BinOptimizationHealthDashboard';
import { BinDataQualityDashboard } from './pages/BinDataQualityDashboard';
import { BinFragmentationDashboard } from './pages/BinFragmentationDashboard';
import { Bin3DOptimizationDashboard } from './pages/Bin3DOptimizationDashboard';
import { VendorScorecardDashboard } from './pages/VendorScorecardDashboard';
import { VendorComparisonDashboard } from './pages/VendorComparisonDashboard';
import './index.css';

const App: React.FC = () => {

  return (
    <ErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <I18nextProvider i18n={i18n}>
          <Router>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<ExecutiveDashboard />} />
                <Route path="/operations" element={<OperationsDashboard />} />
                <Route path="/wms" element={<WMSDashboard />} />
                <Route path="/finance" element={<FinanceDashboard />} />
                <Route path="/quality" element={<QualityDashboard />} />
                <Route path="/marketplace" element={<MarketplaceDashboard />} />
                <Route path="/kpis" element={<KPIExplorer />} />
                <Route path="/monitoring" element={<MonitoringDashboard />} />
                <Route path="/orchestrator" element={<OrchestratorDashboard />} />
                <Route path="/procurement/purchase-orders" element={<PurchaseOrdersPage />} />
                <Route path="/procurement/purchase-orders/new" element={<CreatePurchaseOrderPage />} />
                <Route path="/procurement/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
                <Route path="/wms/bin-utilization" element={<BinUtilizationDashboard />} />
                <Route path="/wms/bin-utilization-enhanced" element={<BinUtilizationEnhancedDashboard />} />
                <Route path="/wms/health" element={<BinOptimizationHealthDashboard />} />
                <Route path="/wms/data-quality" element={<BinDataQualityDashboard />} />
                <Route path="/wms/fragmentation" element={<BinFragmentationDashboard />} />
                <Route path="/wms/3d-optimization" element={<Bin3DOptimizationDashboard />} />
                <Route path="/procurement/vendor-scorecard" element={<VendorScorecardDashboard />} />
                <Route path="/procurement/vendor-comparison" element={<VendorComparisonDashboard />} />
              </Route>
            </Routes>
          </Router>
        </I18nextProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
};

export default App;
