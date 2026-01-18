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
  // REC support
  itemType?: 'req' | 'rec';
  status?: string; // For RECs: pending, approved, rejected, in_progress, done
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

// REC status colors (for border)
const recStatusColors: Record<string, string> = {
  approved: '#22c55e',  // green
  pending: '#f59e0b',   // amber
  rejected: '#ef4444',  // red
  in_progress: '#8b5cf6', // purple
  done: '#22c55e',      // green
};

// Done phase color (muted green)
const DONE_COLOR = '#86efac'; // Light green for done items

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

    // Node shapes - circles for REQ, diamonds for REC
    node.each(function(d) {
      const g = d3.select(this);
      const isRec = d.itemType === 'rec';
      const isDone = d.phase === 'done' || d.status === 'done';
      const baseRadius = 15;
      const radius = baseRadius + Math.min(d.blockingCount * 3, 15);

      // Determine stroke color
      let strokeColor = phaseColors[d.phase] || '#94a3b8';
      if (d.reqNumber === focusedItem) {
        strokeColor = '#3b82f6';
      } else if (isDone) {
        strokeColor = '#22c55e'; // Green for done
      } else if (isRec && d.status) {
        // For RECs, use status color for border
        strokeColor = recStatusColors[d.status] || '#f59e0b';
      } else if (d.isBlocked) {
        strokeColor = '#ef4444';
      }

      const strokeWidth = d.reqNumber === focusedItem ? 4 : isRec ? 3 : 2;
      const fillColor = isDone ? DONE_COLOR : (priorityColors[d.priority] || '#64748b');
      const opacity = isDone ? 0.6 : 1;

      if (isRec) {
        // Diamond shape for recommendations
        const size = radius * 1.4;
        g.append('path')
          .attr('d', `M 0 ${-size} L ${size} 0 L 0 ${size} L ${-size} 0 Z`)
          .attr('fill', fillColor)
          .attr('fill-opacity', opacity)
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth)
          .attr('stroke-dasharray', isDone ? '4,2' : 'none');

        // Add status indicator icon for RECs
        if (isDone || d.status === 'approved') {
          g.append('text')
            .text('✓')
            .attr('text-anchor', 'middle')
            .attr('dy', '-1.8em')
            .attr('font-size', '12px')
            .attr('fill', '#22c55e');
        } else if (d.status === 'rejected') {
          g.append('text')
            .text('✗')
            .attr('text-anchor', 'middle')
            .attr('dy', '-1.8em')
            .attr('font-size', '12px')
            .attr('fill', '#ef4444');
        } else if (d.status === 'pending') {
          g.append('text')
            .text('?')
            .attr('text-anchor', 'middle')
            .attr('dy', '-1.8em')
            .attr('font-size', '12px')
            .attr('font-weight', 'bold')
            .attr('fill', '#f59e0b');
        }
      } else {
        // Circle for requests
        g.append('circle')
          .attr('r', radius)
          .attr('fill', fillColor)
          .attr('fill-opacity', opacity)
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth)
          .attr('stroke-dasharray', isDone ? '4,2' : 'none');

        // Add done checkmark for completed REQs
        if (isDone) {
          g.append('text')
            .text('✓')
            .attr('text-anchor', 'middle')
            .attr('dy', '-1.5em')
            .attr('font-size', '12px')
            .attr('font-weight', 'bold')
            .attr('fill', '#22c55e');
        }
      }
    });

    // Node labels
    node.append('text')
      .text(d => {
        const prefix = d.itemType === 'rec' ? 'REC-' : 'REQ-';
        return d.reqNumber.replace(prefix, '').replace('REQ-', '').slice(0, 8);
      })
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
          <div className="flex items-center gap-2">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              tooltip.node.itemType === 'rec' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {tooltip.node.itemType === 'rec' ? 'REC' : 'REQ'}
            </span>
            <span className="font-mono text-sm font-bold text-slate-800">{tooltip.node.reqNumber}</span>
          </div>
          <div className="text-sm text-slate-600 mt-1 line-clamp-2">{tooltip.node.title}</div>
          <div className="flex flex-wrap gap-2 mt-2">
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
            {tooltip.node.itemType === 'rec' && tooltip.node.status && (
              <span className={`text-xs px-2 py-0.5 rounded ${
                tooltip.node.status === 'approved' ? 'bg-green-100 text-green-700' :
                tooltip.node.status === 'rejected' ? 'bg-red-100 text-red-700' :
                tooltip.node.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {tooltip.node.status}
              </span>
            )}
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {/* Shapes */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-400" />
            <span className="text-xs text-slate-600">REQ (Request)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rotate-45 bg-slate-400" />
            <span className="text-xs text-slate-600">REC (Recommendation)</span>
          </div>
          {/* Priority */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600" />
            <span className="text-xs text-slate-600">Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-xs text-slate-600">High</span>
          </div>
          {/* REC Status */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rotate-45 border-2 border-green-500 bg-transparent" />
            <span className="text-xs text-slate-600">Approved</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rotate-45 border-2 border-amber-500 bg-transparent" />
            <span className="text-xs text-slate-600">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rotate-45 border-2 border-red-500 bg-transparent" />
            <span className="text-xs text-slate-600">Rejected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-transparent" />
            <span className="text-xs text-slate-600">Blocked</span>
          </div>
          {/* Done status */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-200 border-2 border-dashed border-green-500 opacity-60" />
            <span className="text-xs text-slate-600">Done</span>
          </div>
        </div>
        <div className="text-xs text-slate-400 mt-2">
          Drag nodes · Scroll to zoom · Click to select
        </div>
      </div>
    </div>
  );
}
