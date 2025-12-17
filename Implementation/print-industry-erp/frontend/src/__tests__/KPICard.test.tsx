import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KPICard, KPIData } from '../components/common/KPICard';

describe('KPICard', () => {
  const mockKPI: KPIData = {
    id: '1',
    name: 'Test KPI',
    currentValue: 85,
    targetValue: 100,
    unit: '%',
    trend: 'up',
    trendPercent: 5.2,
    sparklineData: [80, 82, 83, 84, 85],
    formula: 'Test Formula',
  };

  it('renders KPI name', () => {
    render(<KPICard kpi={mockKPI} />);
    expect(screen.getByText('Test KPI')).toBeDefined();
  });

  it('renders current value with unit', () => {
    render(<KPICard kpi={mockKPI} />);
    expect(screen.getByText('85')).toBeDefined();
    expect(screen.getByText('%')).toBeDefined();
  });

  it('renders target value', () => {
    render(<KPICard kpi={mockKPI} />);
    expect(screen.getByText(/Target:/)).toBeDefined();
    expect(screen.getByText(/100/)).toBeDefined();
  });

  it('renders trend percentage', () => {
    render(<KPICard kpi={mockKPI} />);
    expect(screen.getByText('5.2%')).toBeDefined();
  });

  it('calculates performance percentage correctly', () => {
    render(<KPICard kpi={mockKPI} />);
    expect(screen.getByText('85.0%')).toBeDefined();
  });
});
