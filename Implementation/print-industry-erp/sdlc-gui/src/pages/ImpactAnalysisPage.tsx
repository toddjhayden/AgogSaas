import { useState, useEffect } from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import * as api from '@/api/sdlc-client';
import { useSDLCStore } from '@/stores/useSDLCStore';

export default function ImpactAnalysisPage() {
  const { entities, fetchDependencyGraph } = useSDLCStore();
  const [selectedEntity, setSelectedEntity] = useState('');
  const [impactResult, setImpactResult] = useState<{
    entity: string;
    dependents: string[];
    crossBuImpacts: string[];
  } | null>(null);
  const [crossBuMatrix, setCrossBuMatrix] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDependencyGraph();

    // Fetch cross-BU matrix
    api.getCrossBuMatrix().then((res) => {
      if (res.success && res.data) {
        setCrossBuMatrix(res.data);
      }
    });
  }, [fetchDependencyGraph]);

  const handleAnalyze = async () => {
    if (!selectedEntity) return;

    setLoading(true);
    const response = await api.analyzeImpact(selectedEntity);
    if (response.success && response.data) {
      setImpactResult(response.data);
    }
    setLoading(false);
  };

  const bus = Object.keys(crossBuMatrix);
  const maxCount = Math.max(
    1,
    ...Object.values(crossBuMatrix).flatMap((row) => Object.values(row))
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Impact Analysis</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entity Impact Analyzer */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Entity Impact Analysis</h2>
          <p className="text-sm text-slate-500 mb-4">
            Analyze which entities and BUs would be affected by changes to an entity
          </p>

          <div className="flex gap-2 mb-6">
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg"
            >
              <option value="">Select an entity...</option>
              {entities.map((e) => (
                <option key={e.entityName} value={e.entityName}>
                  {e.entityName} ({e.owningBu})
                </option>
              ))}
            </select>
            <button
              onClick={handleAnalyze}
              disabled={!selectedEntity || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>

          {impactResult && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="font-medium text-slate-700 mb-2">
                  Impact Summary for: {impactResult.entity}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Direct Dependents:</span>
                    <span className="ml-2 font-medium">
                      {impactResult.dependents.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Cross-BU Impacts:</span>
                    <span className="ml-2 font-medium">
                      {impactResult.crossBuImpacts.length}
                    </span>
                  </div>
                </div>
              </div>

              {impactResult.dependents.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-2">
                    Affected Entities
                  </h3>
                  <div className="space-y-2">
                    {impactResult.dependents.map((dep) => {
                      const entity = entities.find((e) => e.entityName === dep);
                      const isCrossBu = impactResult.crossBuImpacts.includes(dep);

                      return (
                        <div
                          key={dep}
                          className={`flex items-center justify-between px-3 py-2 rounded ${
                            isCrossBu ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <ArrowRight size={14} className="text-slate-400" />
                            <span>{dep}</span>
                            {isCrossBu && (
                              <AlertTriangle size={14} className="text-amber-500" />
                            )}
                          </div>
                          <span className="text-xs text-slate-500">
                            {entity?.owningBu}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {impactResult.crossBuImpacts.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                    <AlertTriangle size={16} />
                    Cross-BU Impact Warning
                  </div>
                  <p className="text-sm text-amber-600">
                    Changes to this entity will affect {impactResult.crossBuImpacts.length}{' '}
                    entity(ies) in other business units. Coordinate with respective BU owners.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cross-BU Dependency Matrix */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Cross-BU Dependency Matrix</h2>
          <p className="text-sm text-slate-500 mb-4">
            Shows dependency counts between business units (rows depend on columns)
          </p>

          {bus.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left text-xs font-medium text-slate-500">
                      From \ To
                    </th>
                    {bus.map((bu) => (
                      <th
                        key={bu}
                        className="px-2 py-1 text-center text-xs font-medium text-slate-500"
                        title={bu}
                      >
                        {bu.split('-')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bus.map((fromBu) => (
                    <tr key={fromBu}>
                      <td className="px-2 py-1 text-xs font-medium text-slate-600">
                        {fromBu.split('-')[0]}
                      </td>
                      {bus.map((toBu) => {
                        const count = crossBuMatrix[fromBu]?.[toBu] || 0;
                        const intensity = count / maxCount;

                        return (
                          <td
                            key={toBu}
                            className="px-2 py-1 text-center"
                            title={`${fromBu} → ${toBu}: ${count}`}
                          >
                            {fromBu === toBu ? (
                              <span className="text-slate-300">-</span>
                            ) : count > 0 ? (
                              <div
                                className="w-8 h-8 mx-auto rounded flex items-center justify-center text-xs font-medium"
                                style={{
                                  backgroundColor: `rgba(239, 68, 68, ${intensity * 0.8})`,
                                  color: intensity > 0.5 ? 'white' : 'inherit',
                                }}
                              >
                                {count}
                              </div>
                            ) : (
                              <span className="text-slate-300">0</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-8">
              No cross-BU dependencies found
            </div>
          )}

          <div className="mt-4 text-xs text-slate-500">
            <p>
              <strong>Reading:</strong> Row BU depends on Column BU. Higher numbers
              (redder) indicate stronger coupling.
            </p>
          </div>
        </div>

        {/* Recommendations */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Impact Mitigation Recommendations</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-2">1. Identify Foundation Entities</h3>
              <p className="text-sm text-blue-600">
                Entities with no dependencies (foundations) should be changed with extreme
                care as they impact everything downstream.
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-800 mb-2">2. Use Versioned APIs</h3>
              <p className="text-sm text-green-600">
                When making breaking changes, version your APIs and provide migration
                paths for dependent BUs.
              </p>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg">
              <h3 className="font-medium text-amber-800 mb-2">3. Notify Affected BUs</h3>
              <p className="text-sm text-amber-600">
                Cross-BU impacts require coordination. Use the impact analysis to identify
                and notify all affected BU owners.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
