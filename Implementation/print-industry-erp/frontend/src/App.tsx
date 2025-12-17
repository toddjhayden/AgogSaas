import React, { useEffect } from 'react';
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
import { natsClient } from './websocket/natsClient';
import './index.css';

const App: React.FC = () => {
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        const wsUrl = import.meta.env.VITE_NATS_WS_URL || 'ws://localhost:4222';
        await natsClient.connect(wsUrl);
        console.log('WebSocket connection initialized');
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
      }
    };

    initializeWebSocket();

    return () => {
      natsClient.disconnect();
    };
  }, []);

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
              </Route>
            </Routes>
          </Router>
        </I18nextProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
};

export default App;
