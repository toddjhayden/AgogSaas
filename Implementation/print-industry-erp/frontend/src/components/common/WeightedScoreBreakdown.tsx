import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import clsx from 'clsx';

export interface CategoryScore {
  category: string;
  score: number; // 0-100 scale
  weight: number; // 0-100 percentage
  weightedScore: number; // score * weight / 100
  color?: string;
}

export interface WeightedScoreBreakdownProps {
  scores: CategoryScore[];
  overallScore: number;
  height?: number;
  className?: string;
}

const DEFAULT_COLORS = {
  Quality: '#10b981', // green
  Delivery: '#3b82f6', // blue
  Cost: '#f59e0b', // amber
  Service: '#8b5cf6', // purple
  Innovation: '#ec4899', // pink
  ESG: '#14b8a6' // teal
};

/**
 * WeightedScoreBreakdown - Visual breakdown of weighted scorecard
 *
 * Features:
 * - Horizontal stacked bar chart showing category contributions
 * - Each category displays: score, weight, and weighted contribution
 * - Overall score calculated from weighted sum
 * - Color-coded by category
 * - Tooltip shows detailed breakdown
 *
 * Formula: Overall Score = Σ(Category Score × Category Weight) / 100
 */
export const WeightedScoreBreakdown: React.FC<WeightedScoreBreakdownProps> = ({
  scores,
  overallScore,
  height = 300,
  className
}) => {
  const chartData = scores.map((s) => ({
    ...s,
    displayName: `${s.category} (${s.weight}%)`,
    fill: s.color || DEFAULT_COLORS[s.category as keyof typeof DEFAULT_COLORS] || '#6b7280'
  }));

  return (
    <div className={clsx('card', className)}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Weighted Score Breakdown</h3>
          <p className="text-sm text-gray-600">Category contributions to overall rating</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-blue-600">{overallScore.toFixed(1)}</div>
          <p className="text-xs text-gray-500 mt-1">Overall Score</p>
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {scores.map((category) => (
          <div key={category.category} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: category.color || DEFAULT_COLORS[category.category as keyof typeof DEFAULT_COLORS] || '#6b7280' }}
              />
              <h4 className="text-xs font-semibold text-gray-900 truncate">{category.category}</h4>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Score:</span>
                <span className="text-sm font-medium text-gray-900">{category.score.toFixed(1)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Weight:</span>
                <span className="text-sm font-medium text-gray-900">{category.weight.toFixed(0)}%</span>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-gray-300">
                <span className="text-xs font-medium text-gray-600">Contribution:</span>
                <span className="text-sm font-bold text-blue-600">{category.weightedScore.toFixed(1)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stacked Bar Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={[{ name: 'Score Breakdown', ...Object.fromEntries(scores.map((s) => [s.category, s.weightedScore])) }]}
            layout="vertical"
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} label={{ value: 'Weighted Contribution', position: 'insideBottom', offset: -10 }} />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip
              formatter={(value: any) => [value.toFixed(2), 'Contribution']}
              contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <Legend />
            {scores.map((category) => (
              <Bar
                key={category.category}
                dataKey={category.category}
                stackId="a"
                fill={category.color || DEFAULT_COLORS[category.category as keyof typeof DEFAULT_COLORS] || '#6b7280'}
                name={`${category.category} (${category.weight}%)`}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Formula Explanation */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Weighted Scoring Formula</h4>
        <p className="text-xs text-gray-700 mb-2">
          Overall Score = Σ(Category Score × Category Weight) / 100
        </p>
        <div className="text-xs text-gray-600">
          {scores.map((s, idx) => (
            <span key={s.category}>
              {idx > 0 && ' + '}
              ({s.score.toFixed(1)} × {s.weight}%)
            </span>
          ))}
          {' = '}
          <span className="font-bold text-blue-600">{overallScore.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
};
