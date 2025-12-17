import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { apolloClient } from './graphql/client';
import { MonitoringDashboard } from './pages/MonitoringDashboard';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
});

const App: React.FC = () => {
  return (
    <ApolloProvider client={apolloClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/monitoring" replace />} />
            <Route path="/monitoring" element={<MonitoringDashboard />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </ApolloProvider>
  );
};

export default App;
