import { useEffect, useState, useRef } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import mermaid from 'mermaid';
import * as api from '@/api/sdlc-client';
import type { DiagramType, GeneratedDiagram } from '@/types';

// Initialize mermaid once on first import
let mermaidInitialized = false;
if (!mermaidInitialized) {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
  });
  mermaidInitialized = true;
}

const DIAGRAM_TYPES: { type: DiagramType; label: string; description: string }[] = [
  { type: 'c4-context', label: 'C4 System Context', description: 'High-level system overview' },
  { type: 'entity-dag', label: 'Entity DAG', description: 'Entity dependency graph' },
  { type: 'cross-bu-impact', label: 'Cross-BU Impact', description: 'BU dependency matrix' },
  { type: 'phase-workflow', label: 'Phase Workflow', description: 'SDLC phase state diagram' },
  { type: 'erd', label: 'ERD (per BU)', description: 'Entity-Relationship diagram' },
];

export default function DiagramsPage() {
  const [selectedType, setSelectedType] = useState<DiagramType>('c4-context');
  const [selectedScope, setSelectedScope] = useState<string>('');
  const [diagram, setDiagram] = useState<GeneratedDiagram | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderedSvg, setRenderedSvg] = useState<string>('');
  const diagramRef = useRef<HTMLDivElement>(null);

  const fetchDiagram = async () => {
    setLoading(true);
    setError(null);

    const scope = selectedType === 'erd' ? selectedScope : undefined;
    const response = await api.getDiagram(selectedType, scope);

    if (response.success && response.data) {
      setDiagram(response.data);
    } else {
      setError(response.error || 'Failed to fetch diagram');
      setDiagram(null);
    }
    setLoading(false);
  };

  const generateDiagram = async () => {
    setLoading(true);
    setError(null);

    const scope = selectedType === 'erd' ? selectedScope : undefined;
    const response = await api.generateDiagram(selectedType, scope);

    if (response.success && response.data) {
      setDiagram(response.data);
    } else {
      setError(response.error || 'Failed to generate diagram');
    }
    setLoading(false);
  };

  // Render mermaid diagram
  useEffect(() => {
    if (!diagram?.mermaidSource) {
      setRenderedSvg('');
      return;
    }

    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, diagram.mermaidSource);
        setRenderedSvg(svg);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setRenderedSvg('');
        setError('Failed to render diagram. The Mermaid syntax may be invalid.');
      }
    };

    renderDiagram();
  }, [diagram?.mermaidSource]);

  useEffect(() => {
    fetchDiagram();
  }, [selectedType, selectedScope]);

  const downloadSvg = () => {
    if (!renderedSvg) return;

    const blob = new Blob([renderedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedType}${selectedScope ? `-${selectedScope}` : ''}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Architecture Diagrams</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={generateDiagram}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Regenerate
          </button>
          <button
            onClick={downloadSvg}
            disabled={!renderedSvg}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            Download SVG
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
        {/* Diagram Type Selector */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">Diagram Type</h2>
          <div className="space-y-2">
            {DIAGRAM_TYPES.map(({ type, label, description }) => (
              <button
                key={type}
                onClick={() => {
                  setSelectedType(type);
                  if (type !== 'erd') setSelectedScope('');
                }}
                className={`w-full text-left px-3 py-2 rounded transition-colors ${
                  selectedType === type
                    ? 'bg-blue-100 border border-blue-300'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="font-medium text-sm">{label}</div>
                <div className="text-xs text-slate-500">{description}</div>
              </button>
            ))}
          </div>

          {selectedType === 'erd' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select BU
              </label>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select a BU...</option>
                <option value="core-infra">Core Infrastructure</option>
                <option value="sales-engagement">Sales & Engagement</option>
                <option value="supply-chain">Supply Chain</option>
                <option value="manufacturing">Manufacturing</option>
                <option value="finance">Finance</option>
                <option value="specialized">Specialized</option>
              </select>
            </div>
          )}

          {diagram && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-sm font-medium text-slate-700 mb-2">Metadata</h3>
              <div className="space-y-1 text-xs text-slate-500">
                <div>Version: {diagram.version}</div>
                <div>Generated: {new Date(diagram.generatedAt).toLocaleString()}</div>
                <div className="font-mono truncate">Hash: {diagram.sourceHash}</div>
              </div>
            </div>
          )}
        </div>

        {/* Diagram Viewer */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow p-4 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">
              {DIAGRAM_TYPES.find((d) => d.type === selectedType)?.label}
              {selectedScope && ` - ${selectedScope}`}
            </h2>
          </div>

          <div
            ref={diagramRef}
            className="flex-1 mermaid-container overflow-auto min-h-[400px] flex items-center justify-center"
          >
            {loading ? (
              <div className="text-slate-500">Loading diagram...</div>
            ) : error ? (
              <div className="text-center">
                <div className="text-red-500 mb-2">{error}</div>
                <button
                  onClick={generateDiagram}
                  className="text-blue-600 hover:underline text-sm"
                >
                  Try generating a new diagram
                </button>
              </div>
            ) : renderedSvg ? (
              <div
                dangerouslySetInnerHTML={{ __html: renderedSvg }}
                className="w-full"
              />
            ) : diagram?.mermaidSource ? (
              <div className="text-center text-slate-500">
                <div>Unable to render diagram</div>
                <pre className="mt-4 text-left text-xs bg-slate-50 p-4 rounded overflow-auto max-h-96">
                  {diagram.mermaidSource}
                </pre>
              </div>
            ) : (
              <div className="text-slate-500">
                Select a diagram type to view
                {selectedType === 'erd' && !selectedScope && ' and choose a BU'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
