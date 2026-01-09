import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Kanban,
  FileText,
  GitBranch,
  Database,
  BarChart3,
  Settings,
  Activity,
  List,
  Lightbulb,
  Network,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSDLCStore } from '@/stores/useSDLCStore';
import { GitHubChatPanel, ChatButton } from '@/components/GitHubChat';

// Pages
import DashboardPage from '@/pages/DashboardPage';
import KanbanPage from '@/pages/KanbanPage';
import RecommendationsKanbanPage from '@/pages/RecommendationsKanbanPage';
import EntityGraphPage from '@/pages/EntityGraphPage';
import BlockerGraphPage from '@/pages/BlockerGraphPage';
import DiagramsPage from '@/pages/DiagramsPage';
import ColumnRegistryPage from '@/pages/ColumnRegistryPage';
import ImpactAnalysisPage from '@/pages/ImpactAnalysisPage';
import RequestsPage from '@/pages/RequestsPage';
import { SettingsPage } from '@/pages/SettingsPage';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/requests', label: 'All Requests', icon: List },
  { path: '/kanban', label: 'Kanban', icon: Kanban },
  { path: '/blockers', label: 'Blocker Graph', icon: Network },
  { path: '/recommendations', label: 'Recommendations', icon: Lightbulb },
  { path: '/entities', label: 'Entity Graph', icon: GitBranch },
  { path: '/diagrams', label: 'Diagrams', icon: FileText },
  { path: '/columns', label: 'Column Registry', icon: Database },
  { path: '/impact', label: 'Impact Analysis', icon: BarChart3 },
];

function Sidebar() {
  const { health, fetchHealth } = useSDLCStore();

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-bold">SDLC Control</h1>
        <p className="text-xs text-slate-400 mt-1">Entity DAG | Kanban | Governance</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <li key={path}>
              <NavLink
                to={path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon size={20} />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Health Status */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-2 text-sm">
          <Activity size={16} className={health?.database ? 'text-green-400' : 'text-red-400'} />
          <span className="text-slate-400">
            {health?.database ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {health && (
          <div className="mt-2 text-xs text-slate-500">
            <div>Entities: {health.entityCount}</div>
            <div>Columns: {health.columnCount}</div>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="p-4 border-t border-slate-700">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 w-full rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleOpenSettings = () => {
    navigate('/settings');
    setIsChatOpen(false);
  };

  const handleToggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const handleCloseChat = () => {
    setIsChatOpen(false);
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className={`flex-1 overflow-auto bg-slate-100 transition-all ${isChatOpen ? 'mr-96' : ''}`}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/blockers" element={<BlockerGraphPage />} />
          <Route path="/recommendations" element={<RecommendationsKanbanPage />} />
          <Route path="/entities" element={<EntityGraphPage />} />
          <Route path="/diagrams" element={<DiagramsPage />} />
          <Route path="/columns" element={<ColumnRegistryPage />} />
          <Route path="/impact" element={<ImpactAnalysisPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      {/* Chat Panel - Fixed to right side */}
      {isChatOpen && (
        <div className="fixed top-0 right-0 h-full z-40">
          <GitHubChatPanel
            onOpenSettings={handleOpenSettings}
            onClose={handleCloseChat}
          />
        </div>
      )}

      {/* Floating Chat Button - Always visible */}
      <ChatButton
        onClick={handleToggleChat}
        isOpen={isChatOpen}
      />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
