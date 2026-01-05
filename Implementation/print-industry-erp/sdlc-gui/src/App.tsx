import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
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
import { useEffect } from 'react';
import { useSDLCStore } from '@/stores/useSDLCStore';

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
        <button className="flex items-center gap-3 px-3 py-2 w-full text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-100">
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
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
