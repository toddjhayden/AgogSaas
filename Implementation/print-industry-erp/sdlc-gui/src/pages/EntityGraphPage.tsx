import { useEffect, useState, useMemo } from 'react';
import { useSDLCStore } from '@/stores/useSDLCStore';
import { RefreshCw, GitBranch, List } from 'lucide-react';
import * as api from '@/api/sdlc-client';
import { D3EntityGraph } from '@/components/D3EntityGraph';

type ViewMode = 'list' | 'graph';

export default function EntityGraphPage() {
  const { entities, dependencies, graphLoading, fetchDependencyGraph } = useSDLCStore();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [executionPlan, setExecutionPlan] = useState<any>(null);
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  useEffect(() => {
    fetchDependencyGraph();
  }, [fetchDependencyGraph]);

  // Group entities by BU
  const entitiesByBu = entities.reduce((acc, entity) => {
    const bu = entity.owningBu;
    if (!acc[bu]) acc[bu] = [];
    acc[bu].push(entity);
    return acc;
  }, {} as Record<string, typeof entities>);

  // Get dependencies for selected entity
  const entityDeps = selectedEntity
    ? dependencies.filter(
        (d) => d.dependentEntity === selectedEntity || d.dependsOnEntity === selectedEntity
      )
    : [];

  const handleComputeOrder = async () => {
    if (selectedEntities.length === 0) return;
    const response = await api.getExecutionOrder(selectedEntities);
    if (response.success && response.data) {
      setExecutionPlan(response.data);
    }
  };

  const toggleEntitySelection = (entityName: string) => {
    setSelectedEntities((prev) =>
      prev.includes(entityName)
        ? prev.filter((e) => e !== entityName)
        : [...prev, entityName]
    );
  };

  // Prepare D3 graph data
  const d3GraphData = useMemo(() => {
    // Create nodes from entities
    const nodes = entities.map(entity => {
      const dependencyCount = dependencies.filter(d => d.dependentEntity === entity.entityName).length;
      const dependentCount = dependencies.filter(d => d.dependsOnEntity === entity.entityName).length;

      return {
        id: entity.entityName,
        name: entity.entityName,
        bu: entity.owningBu,
        type: entity.entityType || 'entity',
        dependencyCount,
        dependentCount,
      };
    });

    // Create links from dependencies
    const links = dependencies.map(dep => ({
      source: dep.dependentEntity,
      target: dep.dependsOnEntity,
      relationshipType: dep.dependencyType,
    }));

    return { nodes, links };
  }, [entities, dependencies]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Entity Dependency Graph</h1>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <List size={16} />
              List
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'graph'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <GitBranch size={16} />
              Graph
            </button>
          </div>
          <button
            onClick={() => fetchDependencyGraph()}
            disabled={graphLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={graphLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* D3 Force-Directed Graph View */}
      {viewMode === 'graph' && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <GitBranch className="text-blue-600" size={20} />
              Entity Dependency Network
            </h2>
            <div className="text-sm text-slate-500">
              {d3GraphData.nodes.length} entities · {d3GraphData.links.length} dependencies
            </div>
          </div>
          {d3GraphData.nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-slate-400">
              <p className="font-medium">No entities registered</p>
              <p className="text-sm">Register entities to build the dependency graph</p>
            </div>
          ) : (
            <div className="h-[600px]">
              <D3EntityGraph
                nodes={d3GraphData.nodes}
                links={d3GraphData.links}
                selectedEntity={selectedEntity}
                onNodeClick={(entityName) => {
                  setSelectedEntity(entityName);
                  toggleEntitySelection(entityName);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entity List by BU */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Entities by Business Unit</h2>
            <div className="text-sm text-slate-500">
              {selectedEntities.length > 0 && (
                <span>{selectedEntities.length} selected</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(entitiesByBu).map(([bu, buEntities]) => (
              <div key={bu} className="border rounded-lg p-4">
                <h3 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        bu === 'core-infra'
                          ? '#326CE5'
                          : bu === 'sales-engagement'
                          ? '#059669'
                          : bu === 'supply-chain'
                          ? '#7c3aed'
                          : bu === 'manufacturing'
                          ? '#dc2626'
                          : bu === 'finance'
                          ? '#0891b2'
                          : '#d97706',
                    }}
                  />
                  {bu}
                  <span className="text-slate-400 font-normal">({buEntities.length})</span>
                </h3>

                <div className="space-y-1">
                  {buEntities.map((entity) => {
                    const isSelected = selectedEntities.includes(entity.entityName);
                    const depCount = dependencies.filter(
                      (d) =>
                        d.dependentEntity === entity.entityName ||
                        d.dependsOnEntity === entity.entityName
                    ).length;

                    return (
                      <div
                        key={entity.entityName}
                        onClick={() => {
                          setSelectedEntity(entity.entityName);
                          toggleEntitySelection(entity.entityName);
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors ${
                          selectedEntity === entity.entityName
                            ? 'bg-blue-100 border border-blue-300'
                            : isSelected
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm ${
                              entity.isFoundation ? 'font-semibold' : ''
                            }`}
                          >
                            {entity.entityName}
                          </span>
                          {entity.isFoundation && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                              foundation
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">{depCount} deps</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {entities.length === 0 && !graphLoading && (
            <div className="text-center text-slate-500 py-8">
              No entities registered. Register entities to build the dependency graph.
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Selected Entity Details */}
          {selectedEntity && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Entity Details</h2>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-slate-500">Name</span>
                  <p className="font-medium">{selectedEntity}</p>
                </div>

                {entityDeps.length > 0 && (
                  <>
                    <div>
                      <span className="text-sm text-slate-500">Depends On</span>
                      <div className="mt-1 space-y-1">
                        {entityDeps
                          .filter((d) => d.dependentEntity === selectedEntity)
                          .map((d) => (
                            <div
                              key={d.id}
                              className="flex items-center justify-between text-sm bg-slate-50 px-2 py-1 rounded"
                            >
                              <span>{d.dependsOnEntity}</span>
                              <span className="text-xs text-slate-400">
                                {d.dependencyType}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-sm text-slate-500">Depended By</span>
                      <div className="mt-1 space-y-1">
                        {entityDeps
                          .filter((d) => d.dependsOnEntity === selectedEntity)
                          .map((d) => (
                            <div
                              key={d.id}
                              className="flex items-center justify-between text-sm bg-slate-50 px-2 py-1 rounded"
                            >
                              <span>{d.dependentEntity}</span>
                              <span className="text-xs text-slate-400">
                                {d.dependencyType}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Execution Order Calculator */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Execution Order</h2>
            <p className="text-sm text-slate-500 mb-4">
              Select entities to compute topological execution order
            </p>

            {selectedEntities.length > 0 && (
              <div className="mb-4 p-3 bg-slate-50 rounded">
                <div className="text-sm font-medium mb-2">Selected:</div>
                <div className="flex flex-wrap gap-1">
                  {selectedEntities.map((e) => (
                    <span
                      key={e}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleComputeOrder}
              disabled={selectedEntities.length === 0}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Compute Order
            </button>

            {executionPlan && (
              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium">Execution Order:</div>
                {executionPlan.order.map((step: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-sm bg-slate-50 px-3 py-2 rounded"
                  >
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">
                      {idx + 1}
                    </span>
                    <span>{step.entity}</span>
                    <span className="text-xs text-slate-400 ml-auto">{step.bu}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
