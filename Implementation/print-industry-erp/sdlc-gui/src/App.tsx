import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  Menu,
  X,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useSDLCStore } from '@/stores/useSDLCStore';
import { AIChatPanel, ChatButton } from '@/components/AIChatPanel';
import { AIComparePanel } from '@/components/AIComparePanel';
import { GlobalFilterToggle } from '@/components/GlobalFilterBar';

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

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: () => void;
}

function Sidebar({ isOpen, onClose, onNavigate }: SidebarProps) {
  const { health, fetchHealth } = useSDLCStore();

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    onNavigate?.();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-64 bg-slate-900 text-white flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">SDLC Control</h1>
            <p className="text-xs text-slate-400 mt-1">Entity DAG | Kanban | Governance</p>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-1 text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {navItems.map(({ path, label, icon: Icon }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
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

        {/* Global Filters */}
        <div className="px-4">
          <GlobalFilterToggle />
        </div>

        {/* Settings */}
        <div className="p-4 border-t border-slate-700">
          <NavLink
            to="/settings"
            onClick={handleNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 w-full rounded-lg transition-colors ${
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
    </>
  );
}

// Mobile Header Component
function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const location = useLocation();

  // Find current page title
  const currentPage = navItems.find((item) => item.path === location.pathname);
  const pageTitle = currentPage?.label || (location.pathname === '/settings' ? 'Settings' : 'SDLC Control');

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-slate-900 text-white px-4 py-3 flex items-center gap-3 shadow-lg">
      <button
        onClick={onMenuClick}
        className="p-2 -ml-2 hover:bg-slate-800 rounded-lg transition-colors"
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>
      <h1 className="text-lg font-semibold truncate">{pageTitle}</h1>
    </header>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const handleOpenSettings = () => {
    navigate('/settings');
    setIsChatOpen(false);
    setIsCompareOpen(false);
  };

  const handleToggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const handleCloseChat = () => {
    setIsChatOpen(false);
  };

  const handleOpenCompare = () => {
    setIsCompareOpen(true);
    setIsChatOpen(false);
  };

  const handleCloseCompare = () => {
    setIsCompareOpen(false);
  };

  const handleOpenSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  return (
    <div className="flex h-screen">
      {/* Mobile Header */}
      <MobileHeader onMenuClick={handleOpenSidebar} />

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        onNavigate={handleCloseSidebar}
      />

      {/* Main Content */}
      <main
        className={`
          flex-1 overflow-auto bg-slate-100 transition-all
          pt-14 md:pt-0
          ${isChatOpen ? 'md:mr-96' : ''}
        `}
      >
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

      {/* Chat Panel - Fixed to right side on desktop, full-screen modal on mobile */}
      {isChatOpen && (
        <div className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:h-full z-40">
          <AIChatPanel
            onOpenSettings={handleOpenSettings}
            onClose={handleCloseChat}
            onOpenCompare={handleOpenCompare}
          />
        </div>
      )}

      {/* Comparison Panel - Full screen modal */}
      {isCompareOpen && (
        <AIComparePanel
          onClose={handleCloseCompare}
          onOpenSettings={handleOpenSettings}
        />
      )}

      {/* Floating Chat Button - Hidden when chat is open (close button in panel header is sufficient) */}
      {!isChatOpen && (
        <ChatButton
          onClick={handleToggleChat}
          isOpen={isChatOpen}
        />
      )}
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
