/**
 * D3 Chord Diagram for Cross-BU Dependencies
 * Shows how business units depend on each other
 */

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface D3ChordDiagramProps {
  matrix: Record<string, Record<string, number>>;
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
  'core': '#326CE5',
  'sales': '#059669',
  'supply': '#7c3aed',
  'mfg': '#dc2626',
  'fin': '#0891b2',
};

function getBuColor(bu: string): string {
  const lower = bu.toLowerCase();
  for (const [key, color] of Object.entries(buColors)) {
    if (lower.includes(key)) return color;
  }
  return '#d97706';
}

export function D3ChordDiagram({
  matrix,
  width = 500,
  height = 500,
}: D3ChordDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width, height });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const size = Math.min(rect.width || width, rect.height || height);
        setDimensions({ width: size, height: size });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [width, height]);

  useEffect(() => {
    if (!svgRef.current) return;

    const bus = Object.keys(matrix);
    if (bus.length === 0) return;

    // Convert matrix to array format for d3.chord
    const matrixArray: number[][] = bus.map(fromBu =>
      bus.map(toBu => matrix[fromBu]?.[toBu] || 0)
    );

    // Check if there's any data
    const hasData = matrixArray.some(row => row.some(val => val > 0));
    if (!hasData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width: w, height: h } = dimensions;
    const outerRadius = Math.min(w, h) * 0.4;
    const innerRadius = outerRadius - 20;

    // Create chord layout
    const chord = d3.chord()
      .padAngle(0.05)
      .sortSubgroups(d3.descending);

    const chords = chord(matrixArray);

    // Create arc generator for groups
    const arc = d3.arc<d3.ChordGroup>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);

    // Create ribbon generator for chords
    const ribbon = d3.ribbon<d3.Chord, d3.ChordSubgroup>()
      .radius(innerRadius);

    // Center the diagram
    const g = svg.append('g')
      .attr('transform', `translate(${w / 2}, ${h / 2})`);

    // Draw the arcs (BU segments)
    const group = g.append('g')
      .selectAll('g')
      .data(chords.groups)
      .join('g');

    group.append('path')
      .attr('fill', d => getBuColor(bus[d.index]))
      .attr('stroke', d => d3.rgb(getBuColor(bus[d.index])).darker().toString())
      .attr('d', arc)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        // Fade non-related chords
        g.selectAll('.chord')
          .style('opacity', (c: any) =>
            c.source.index === d.index || c.target.index === d.index ? 1 : 0.1
          );

        const total = d.value;
        setTooltip({
          x: event.pageX,
          y: event.pageY,
          text: `${bus[d.index]}: ${total} dependencies`
        });
      })
      .on('mouseout', function() {
        g.selectAll('.chord').style('opacity', 0.75);
        setTooltip(null);
      });

    // Add BU labels
    group.append('text')
      .each(d => { (d as any).angle = (d.startAngle + d.endAngle) / 2; })
      .attr('dy', '.35em')
      .attr('transform', d => {
        const angle = ((d as any).angle * 180 / Math.PI - 90);
        const flip = (d as any).angle > Math.PI;
        return `
          rotate(${angle})
          translate(${outerRadius + 10})
          ${flip ? 'rotate(180)' : ''}
        `;
      })
      .attr('text-anchor', d => (d as any).angle > Math.PI ? 'end' : null)
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .attr('fill', '#374151')
      .text(d => bus[d.index].split('-')[0]);

    // Draw the ribbons (dependency connections)
    g.append('g')
      .attr('fill-opacity', 0.75)
      .selectAll('path')
      .data(chords)
      .join('path')
      .attr('class', 'chord')
      .attr('d', ribbon)
      .attr('fill', d => getBuColor(bus[d.source.index]))
      .attr('stroke', d => d3.rgb(getBuColor(bus[d.source.index])).darker().toString())
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).style('opacity', 1);

        const from = bus[d.source.index];
        const to = bus[d.target.index];
        const value = d.source.value;

        setTooltip({
          x: event.pageX,
          y: event.pageY,
          text: `${from} → ${to}: ${value} dependencies`
        });
      })
      .on('mouseout', function() {
        d3.select(this).style('opacity', 0.75);
        setTooltip(null);
      });

  }, [matrix, dimensions]);

  const bus = Object.keys(matrix);

  if (bus.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        No cross-BU data available
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[400px]">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="mx-auto"
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-2 text-sm bg-slate-800 text-white rounded-lg shadow-lg pointer-events-none"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 10,
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur rounded-lg p-2 text-xs">
        <div className="font-medium text-slate-700 mb-1">Business Units</div>
        <div className="flex flex-wrap gap-2">
          {bus.map(bu => (
            <div key={bu} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getBuColor(bu) }}
              />
              <span className="text-slate-600">{bu.split('-')[0]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default D3ChordDiagram;
