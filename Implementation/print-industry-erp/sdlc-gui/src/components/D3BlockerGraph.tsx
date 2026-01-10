/**
 * D3 Force-Directed Blocker Graph
 * Interactive visualization of blocking relationships between requests
 */

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface BlockerNode {
  id: string;
  reqNumber: string;
  title: string;
  priority: string;
  phase: string;
  isBlocked: boolean;
  blockedByCount: number;
  blockingCount: number;
}

interface BlockerLink {
  source: string;
  target: string;
}

interface D3BlockerGraphProps {
  nodes: BlockerNode[];
  links: BlockerLink[];
  focusedItem?: string | null;
  onNodeClick?: (reqNumber: string) => void;
  onNodeDoubleClick?: (reqNumber: string) => void;
  width?: number;
  height?: number;
}

// Priority colors
const priorityColors: Record<string, string> = {
  critical: '#dc2626',
  catastrophic: '#7f1d1d',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

// Phase colors
const phaseColors: Record<string, string> = {
  backlog: '#94a3b8',
  ready: '#3b82f6',
  in_progress: '#8b5cf6',
  review: '#f59e0b',
  done: '#22c55e',
  blocked: '#ef4444',
};

export function D3BlockerGraph({
  nodes,
  links,
  focusedItem,
  onNodeClick,
  onNodeDoubleClick,
  width = 800,
  height = 600,
}: D3BlockerGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width, height });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: BlockerNode } | null>(null);

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
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#94a3b8');

    // Prepare node data with d3 simulation properties
    const nodeData: (BlockerNode & d3.SimulationNodeDatum)[] = nodes.map(n => ({ ...n }));

    // Prepare link data - need to reference node objects
    const linkData: d3.SimulationLinkDatum<BlockerNode & d3.SimulationNodeDatum>[] = links.map(l => ({
      source: l.source,
      target: l.target,
    }));

    // Create force simulation
    const simulation = d3.forceSimulation(nodeData)
      .force('link', d3.forceLink<BlockerNode & d3.SimulationNodeDatum, d3.SimulationLinkDatum<BlockerNode & d3.SimulationNodeDatum>>(linkData)
        .id(d => d.id)
        .distance(100)
        .strength(0.5))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide().radius(40));

    // Draw links
    const link = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(linkData)
      .enter()
      .append('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#arrowhead)');

    // Draw nodes
    const node = container.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodeData)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, BlockerNode & d3.SimulationNodeDatum>()
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

    // Node circles
    node.append('circle')
      .attr('r', d => {
        // Larger nodes for items that block more
        const baseRadius = 15;
        return baseRadius + Math.min(d.blockingCount * 3, 15);
      })
      .attr('fill', d => priorityColors[d.priority] || '#64748b')
      .attr('stroke', d => {
        if (d.reqNumber === focusedItem) return '#3b82f6';
        if (d.isBlocked) return '#ef4444';
        return phaseColors[d.phase] || '#94a3b8';
      })
      .attr('stroke-width', d => d.reqNumber === focusedItem ? 4 : 2);

    // Node labels
    node.append('text')
      .text(d => d.reqNumber.replace('REQ-', '').slice(0, 8))
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', 'white')
      .attr('pointer-events', 'none');

    // Event handlers
    node
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick?.(d.reqNumber);
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        onNodeDoubleClick?.(d.reqNumber);
      })
      .on('mouseover', (event, d) => {
        const [x, y] = d3.pointer(event, svgRef.current);
        setTooltip({ x, y, node: d });
      })
      .on('mouseout', () => {
        setTooltip(null);
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
  }, [nodes, links, dimensions, focusedItem, onNodeClick, onNodeDoubleClick]);

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
          <div className="font-mono text-sm font-bold text-slate-800">{tooltip.node.reqNumber}</div>
          <div className="text-sm text-slate-600 mt-1 line-clamp-2">{tooltip.node.title}</div>
          <div className="flex gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded ${
              tooltip.node.priority === 'critical' || tooltip.node.priority === 'catastrophic'
                ? 'bg-red-100 text-red-700'
                : tooltip.node.priority === 'high'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {tooltip.node.priority}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {tooltip.node.phase}
            </span>
          </div>
          {(tooltip.node.blockedByCount > 0 || tooltip.node.blockingCount > 0) && (
            <div className="text-xs text-slate-500 mt-2">
              {tooltip.node.blockedByCount > 0 && (
                <span className="text-red-600">Blocked by {tooltip.node.blockedByCount}</span>
              )}
              {tooltip.node.blockedByCount > 0 && tooltip.node.blockingCount > 0 && ' · '}
              {tooltip.node.blockingCount > 0 && (
                <span className="text-amber-600">Blocking {tooltip.node.blockingCount}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg p-3 shadow-sm border border-slate-200">
        <div className="text-xs font-semibold text-slate-600 mb-2">Legend</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600" />
            <span className="text-xs text-slate-600">Critical/Catastrophic</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-xs text-slate-600">High Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-xs text-slate-600">Medium Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-transparent" />
            <span className="text-xs text-slate-600">Blocked</span>
          </div>
        </div>
        <div className="text-xs text-slate-400 mt-2">
          Drag nodes · Scroll to zoom · Click to select
        </div>
      </div>
    </div>
  );
}
