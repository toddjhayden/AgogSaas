import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Chart.js format data interface
interface ChartJsData {
  labels?: string[];
  datasets?: Array<{
    label?: string;
    data?: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    [key: string]: any;
  }>;
}

export interface ChartProps {
  type: 'line' | 'bar' | 'pie';
  data: any[] | ChartJsData; // Support both recharts array and Chart.js format
  xKey?: string;
  yKey?: string | string[];
  yKeys?: string[]; // Alias for yKey when it's an array
  xAxisKey?: string; // Alias for xKey
  yAxisLabel?: string;
  colors?: string[];
  title?: string;
  height?: number;
  options?: Record<string, any>; // For extended configuration
  labels?: string[]; // For pie chart labels
  series?: Array<{ dataKey: string; color: string; name: string }>; // For multi-series charts
}

const DEFAULT_COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899'];

export const Chart: React.FC<ChartProps> = ({
  type,
  data,
  xKey = 'name',
  xAxisKey, // Alias for xKey
  yKey = 'value',
  yKeys, // Alias for yKey when array
  colors = DEFAULT_COLORS,
  title,
  height = 300,
  options: _options, // Extended options (reserved for future use)
  labels: _labels, // Pie chart labels (reserved for future use)
  yAxisLabel: _yAxisLabel, // Y-axis label (reserved for future use)
  series, // Multi-series chart data
}) => {
  // Use aliases if provided
  const effectiveXKey = xAxisKey || xKey;
  const effectiveYKey = yKeys || yKey;
  // Use series if provided for multi-line charts
  const effectiveColors = series ? series.map(s => s.color) : colors;

  // Helper to check if data is in Chart.js format
  const isChartJsFormat = (d: any): d is ChartJsData => {
    return d && typeof d === 'object' && !Array.isArray(d) && ('labels' in d || 'datasets' in d);
  };

  // Convert Chart.js format to recharts format
  const convertToRechartsFormat = (chartJsData: ChartJsData): any[] => {
    if (!chartJsData.labels || !chartJsData.datasets) return [];
    return chartJsData.labels.map((label, index) => {
      const point: Record<string, any> = { name: label };
      chartJsData.datasets?.forEach((dataset) => {
        const key = dataset.label || 'value';
        point[key] = dataset.data?.[index] ?? 0;
      });
      return point;
    });
  };

  // Normalize data to recharts format
  const chartData = isChartJsFormat(data) ? convertToRechartsFormat(data) : data;

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={effectiveXKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {series ? (
                series.map((s, index) => (
                  <Line
                    key={s.dataKey}
                    type="monotone"
                    dataKey={s.dataKey}
                    name={s.name}
                    stroke={s.color || effectiveColors[index % effectiveColors.length]}
                    strokeWidth={2}
                  />
                ))
              ) : Array.isArray(effectiveYKey) ? (
                effectiveYKey.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={effectiveColors[index % effectiveColors.length]}
                    strokeWidth={2}
                  />
                ))
              ) : (
                <Line type="monotone" dataKey={effectiveYKey} stroke={effectiveColors[0]} strokeWidth={2} />
              )}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={effectiveXKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {Array.isArray(effectiveYKey) ? (
                effectiveYKey.map((key, index) => (
                  <Bar key={key} dataKey={key} fill={effectiveColors[index % effectiveColors.length]} />
                ))
              ) : (
                <Bar dataKey={effectiveYKey} fill={effectiveColors[0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => entry.name}
                outerRadius={80}
                fill="#8884d8"
                dataKey={typeof effectiveYKey === 'string' ? effectiveYKey : effectiveYKey[0]}
              >
                {chartData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={effectiveColors[index % effectiveColors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="card">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      {renderChart()}
    </div>
  );
};
