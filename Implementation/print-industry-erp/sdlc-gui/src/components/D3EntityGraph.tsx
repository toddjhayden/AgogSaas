/**
 * D3 Force-Directed Entity Dependency Graph
 * Interactive visualization of entity relationships and dependencies
 */

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface EntityNode {
  id: string;
  name: string;
  bu: string;
  type: string;
  dependencyCount: number;
  dependentCount: number;
  isHighlighted?: boolean;
}

interface EntityLink {
  source: string;
  target: string;
  relationshipType?: string;
}

interface D3EntityGraphProps {
  nodes: EntityNode[];
  links: EntityLink[];
  selectedEntity?: string | null;
  highlightedEntities?: Set<string>;
  onNodeClick?: (entityName: string) => void;
  onNodeDoubleClick?: (entityName: string) => void;
  width?: number;
  height?: number;
}

// Business unit colors
const buColors: Record<string, string> = {
  'core-infra': '#326CE5',
  'sales-engagement': '#059669',
  'supply-chain': '#7c3aed',
  'manufacturing': '#dc2626',
  'finance': '#0891b2',
  'default': '#d97706',
};

export function D3EntityGraph({
  nodes,
  links,
  selectedEntity,
  highlightedEntities,
  onNodeClick,
  onNodeDoubleClick,
  width = 800,
  height = 600,
}: D3EntityGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width, height });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: EntityNode } | null>(null);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || width,
          height: rect.height || height,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [width, height]);

  // D3 Force Simulation
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width: w, height: h } = dimensions;

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create container for zoom/pan
    const container = svg.append('g');

    // Create arrow marker for directed edges
    svg.append('defs').append('marker')
      .attr('id', 'entity-arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#94a3b8');

    // Prepare node data with d3 simulation properties
    const nodeData: (EntityNode & d3.SimulationNodeDatum)[] = nodes.map(n => ({ ...n }));

    // Prepare link data
    const linkData: d3.SimulationLinkDatum<EntityNode & d3.SimulationNodeDatum>[] = links.map(l => ({
      source: l.source,
      target: l.target,
    }));

    // Create force simulation
    const simulation = d3.forceSimulation(nodeData)
      .force('link', d3.forceLink<EntityNode & d3.SimulationNodeDatum, d3.SimulationLinkDatum<EntityNode & d3.SimulationNodeDatum>>(linkData)
        .id(d => d.id)
        .distance(80)
        .strength(0.3))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide().radius(35))
      .force('x', d3.forceX(w / 2).strength(0.05))
      .force('y', d3.forceY(h / 2).strength(0.05));

    // Check if highlighting is active for links
    const linkHasHighlighting = highlightedEntities && highlightedEntities.size > 0;

    // Draw links
    const link = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(linkData)
      .enter()
      .append('line')
      .attr('stroke', d => {
        if (!linkHasHighlighting) return '#cbd5e1';
        const sourceId = typeof d.source === 'string' ? d.source : (d.source as any).id;
        const targetId = typeof d.target === 'string' ? d.target : (d.target as any).id;
        if (highlightedEntities.has(sourceId) && highlightedEntities.has(targetId)) {
          return '#10b981'; // Green for highlighted path
        }
        return '#e2e8f0';
      })
      .attr('stroke-width', d => {
        if (!linkHasHighlighting) return 1.5;
        const sourceId = typeof d.source === 'string' ? d.source : (d.source as any).id;
        const targetId = typeof d.target === 'string' ? d.target : (d.target as any).id;
        if (highlightedEntities.has(sourceId) && highlightedEntities.has(targetId)) {
          return 2.5;
        }
        return 1;
      })
      .attr('stroke-opacity', d => {
        if (!linkHasHighlighting) return 0.6;
        const sourceId = typeof d.source === 'string' ? d.source : (d.source as any).id;
        const targetId = typeof d.target === 'string' ? d.target : (d.target as any).id;
        if (highlightedEntities.has(sourceId) && highlightedEntities.has(targetId)) {
          return 0.8;
        }
        return 0.2;
      })
      .attr('marker-end', 'url(#entity-arrowhead)');

    // Draw nodes
    const node = container.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodeData)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, EntityNode & d3.SimulationNodeDatum>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // Check if highlighting is active
    const hasHighlighting = highlightedEntities && highlightedEntities.size > 0;

    // Node circles
    node.append('circle')
      .attr('r', d => {
        // Larger nodes for entities with more dependencies
        const baseRadius = 18;
        return baseRadius + Math.min((d.dependencyCount + d.dependentCount) * 2, 12);
      })
      .attr('fill', d => {
        const baseColor = buColors[d.bu] || buColors['default'];
        // Dim non-highlighted nodes when highlighting is active
        if (hasHighlighting && !highlightedEntities.has(d.name)) {
          return '#e2e8f0'; // Light gray for non-highlighted
        }
        return baseColor;
      })
      .attr('stroke', d => {
        if (d.name === selectedEntity) return '#3b82f6';
        if (hasHighlighting && highlightedEntities.has(d.name)) return '#10b981'; // Green for highlighted
        return '#fff';
      })
      .attr('stroke-width', d => {
        if (d.name === selectedEntity) return 4;
        if (hasHighlighting && highlightedEntities.has(d.name)) return 3;
        return 2;
      })
      .attr('opacity', d => {
        if (hasHighlighting && !highlightedEntities.has(d.name)) return 0.4;
        return 1;
      });

    // Node labels (entity name abbreviated)
    node.append('text')
      .text(d => {
        // Abbreviate long names
        const name = d.name;
        if (name.length <= 10) return name;
        return name.slice(0, 8) + '...';
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '9px')
      .attr('font-weight', '600')
      .attr('fill', 'white')
      .attr('pointer-events', 'none');

    // Event handlers
    node
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick?.(d.name);
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        onNodeDoubleClick?.(d.name);
      })
      .on('mouseover', (event, d) => {
        const [x, y] = d3.pointer(event, svgRef.current);
        setTooltip({ x, y, node: d });

        // Highlight connected links
        link
          .attr('stroke', l =>
            (l.source as any).id === d.id || (l.target as any).id === d.id
              ? buColors[d.bu] || buColors['default']
              : '#cbd5e1'
          )
          .attr('stroke-width', l =>
            (l.source as any).id === d.id || (l.target as any).id === d.id
              ? 2.5
              : 1.5
          );
      })
      .on('mouseout', () => {
        setTooltip(null);
        // Reset link styles
        link
          .attr('stroke', '#cbd5e1')
          .attr('stroke-width', 1.5);
      });

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, links, dimensions, selectedEntity, highlightedEntities, onNodeClick, onNodeDoubleClick]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[400px]">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-slate-50 rounded-lg"
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-white shadow-lg rounded-lg p-3 border border-slate-200 z-10 max-w-xs"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y + 10,
          }}
        >
          <div className="font-semibold text-slate-800">{tooltip.node.name}</div>
          <div className="text-xs text-slate-500 mt-1">{tooltip.node.type}</div>
          <div className="flex gap-2 mt-2">
            <span
              className="text-xs px-2 py-0.5 rounded text-white"
              style={{ backgroundColor: buColors[tooltip.node.bu] || buColors['default'] }}
            >
              {tooltip.node.bu}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-2 space-y-0.5">
            <div>Depends on: <span className="font-medium text-slate-700">{tooltip.node.dependencyCount}</span> entities</div>
            <div>Depended by: <span className="font-medium text-slate-700">{tooltip.node.dependentCount}</span> entities</div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg p-3 shadow-sm border border-slate-200">
        <div className="text-xs font-semibold text-slate-600 mb-2">Business Units</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {Object.entries(buColors).filter(([key]) => key !== 'default').map(([bu, color]) => (
            <div key={bu} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-slate-600">{bu}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-400 mt-2">
          Drag nodes · Scroll to zoom · Click to select
        </div>
      </div>
    </div>
  );
}
