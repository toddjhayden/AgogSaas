import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSDLCStore } from '@/stores/useSDLCStore';
import { Activity, GitBranch, Database, Layers, AlertTriangle, Lightbulb, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import * as api from '@/api/sdlc-client';

interface PhaseStats {
  code: string;
  name: string;
  count: number;
  wipLimit?: number;
}

interface ColumnStats {
  total: number;
  byType: Record<string, number>;
  byBu: Record<string, number>;
}

export default function DashboardPage() {
  const { health, fetchHealth, recommendations, fetchRecommendations } = useSDLCStore();
  const [phaseStats, setPhaseStats] = useState<PhaseStats[]>([]);
  const [columnStats, setColumnStats] = useState<ColumnStats | null>(null);
  const [cycles, setCycles] = useState<{ hasCycles: boolean; cycles: string[][] } | null>(null);

  useEffect(() => {
    fetchHealth();
    fetchRecommendations();

    // Fetch phase stats
    api.getPhaseStats().then((res) => {
      if (res.success && res.data) {
        setPhaseStats(res.data.phases);
      }
    });

    // Fetch column stats
    api.getColumnStats().then((res) => {
      if (res.success && res.data) {
        setColumnStats(res.data);
      }
    });

    // Check for cycles
    api.detectCycles().then((res) => {
      if (res.success && res.data) {
        setCycles(res.data);
      }
    });
  }, [fetchHealth, fetchRecommendations]);

  // Calculate recommendation stats
  const pendingRecommendations = recommendations.filter(r => r.status === 'pending');
  const approvedRecommendations = recommendations.filter(r => r.status === 'approved');
  const inProgressRecommendations = recommendations.filter(r => r.status === 'in_progress');
  const doneRecommendations = recommendations.filter(r => r.status === 'done');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h1>

      {/* Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Database Status */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Database</p>
              <p className="text-2xl font-bold">
                {health?.database ? 'Connected' : 'Disconnected'}
              </p>
            </div>
            <Activity
              size={40}
              className={health?.database ? 'text-green-500' : 'text-red-500'}
            />
          </div>
        </div>

        {/* Entity Count */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Entities</p>
              <p className="text-2xl font-bold">{health?.entityCount || 0}</p>
            </div>
            <GitBranch size={40} className="text-blue-500" />
          </div>
        </div>

        {/* Column Count */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Columns</p>
              <p className="text-2xl font-bold">{health?.columnCount || 0}</p>
            </div>
            <Database size={40} className="text-purple-500" />
          </div>
        </div>

        {/* Phase Count */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Phases</p>
              <p className="text-2xl font-bold">{health?.phaseCount || 0}</p>
            </div>
            <Layers size={40} className="text-amber-500" />
          </div>
        </div>

        {/* Recommendations Count */}
        <Link to="/recommendations" className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Recommendations</p>
              <p className="text-2xl font-bold">{recommendations.length}</p>
              {pendingRecommendations.length > 0 && (
                <p className="text-xs text-yellow-600 font-medium mt-1">
                  {pendingRecommendations.length} pending review
                </p>
              )}
            </div>
            <Lightbulb size={40} className="text-yellow-500" />
          </div>
        </Link>
      </div>

      {/* Alerts */}
      {cycles?.hasCycles && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={20} />
            <span className="font-semibold">Circular Dependencies Detected!</span>
          </div>
          <div className="mt-2 text-sm text-red-600">
            {cycles.cycles.map((cycle, i) => (
              <div key={i} className="mt-1">
                Cycle {i + 1}: {cycle.join(' → ')}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Phase Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Requests by Phase</h2>
          <div className="space-y-3">
            {phaseStats.map((phase) => {
              const percentage = phaseStats.reduce((sum, p) => sum + p.count, 0) > 0
                ? (phase.count / phaseStats.reduce((sum, p) => sum + p.count, 0)) * 100
                : 0;
              const isOverLimit = phase.wipLimit && phase.count > phase.wipLimit;

              return (
                <div key={phase.code}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={isOverLimit ? 'text-red-600 font-medium' : ''}>
                      {phase.name}
                      {isOverLimit && ' (over WIP limit!)'}
                    </span>
                    <span>
                      {phase.count}
                      {phase.wipLimit && ` / ${phase.wipLimit}`}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isOverLimit ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column Statistics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Column Registry</h2>
          {columnStats && (
            <>
              <div className="mb-4">
                <span className="text-3xl font-bold text-slate-800">
                  {columnStats.total}
                </span>
                <span className="text-slate-500 ml-2">registered columns</span>
              </div>

              <h3 className="text-sm font-medium text-slate-600 mb-2">By Type</h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(columnStats.byType).map(([type, count]) => (
                  <div
                    key={type}
                    className="bg-slate-50 rounded px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{type}</span>
                    <span className="text-slate-500 ml-2">{count}</span>
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-medium text-slate-600 mb-2">By BU</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(columnStats.byBu).map(([bu, count]) => (
                  <div
                    key={bu}
                    className="bg-slate-50 rounded px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{bu}</span>
                    <span className="text-slate-500 ml-2">{count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pending Recommendations */}
      {pendingRecommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="text-yellow-500" size={20} />
              Pending Recommendations
            </h2>
            <Link
              to="/recommendations"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View All <ArrowRight size={16} />
            </Link>
          </div>
          <div className="space-y-3">
            {pendingRecommendations.slice(0, 5).map((rec) => (
              <div key={rec.id} className="flex items-start justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-500">{rec.recNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      rec.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                      rec.urgency === 'high' ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {rec.urgency}
                    </span>
                  </div>
                  <h4 className="font-medium text-slate-800">{rec.title}</h4>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-1">{rec.description}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <Lightbulb size={12} />
                    <span>By: {rec.recommendedBy}</span>
                    {rec.affectedBus && rec.affectedBus.length > 0 && (
                      <span className="text-slate-400">| Affects: {rec.affectedBus.join(', ')}</span>
                    )}
                  </div>
                </div>
                <Link
                  to="/recommendations"
                  className="ml-4 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1"
                >
                  Review <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
          {pendingRecommendations.length > 5 && (
            <p className="text-center text-sm text-slate-500 mt-4">
              +{pendingRecommendations.length - 5} more pending recommendations
            </p>
          )}
        </div>
      )}

      {/* Recommendation Summary Stats */}
      {recommendations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <Clock className="mx-auto text-yellow-600 mb-2" size={24} />
            <p className="text-2xl font-bold text-yellow-700">{pendingRecommendations.length}</p>
            <p className="text-sm text-yellow-600">Pending</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <CheckCircle className="mx-auto text-blue-600 mb-2" size={24} />
            <p className="text-2xl font-bold text-blue-700">{approvedRecommendations.length}</p>
            <p className="text-sm text-blue-600">Approved</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
            <Activity className="mx-auto text-purple-600 mb-2" size={24} />
            <p className="text-2xl font-bold text-purple-700">{inProgressRecommendations.length}</p>
            <p className="text-sm text-purple-600">In Progress</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <CheckCircle className="mx-auto text-green-600 mb-2" size={24} />
            <p className="text-2xl font-bold text-green-700">{doneRecommendations.length}</p>
            <p className="text-sm text-green-600">Completed</p>
          </div>
        </div>
      )}
    </div>
  );
}
