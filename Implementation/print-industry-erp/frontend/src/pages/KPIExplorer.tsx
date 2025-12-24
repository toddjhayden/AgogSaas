import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Star, StarOff, Filter, TrendingUp } from 'lucide-react';
import { KPICard, KPIData } from '../components/common/KPICard';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { useAppStore } from '../store/appStore';
import clsx from 'clsx';

// Mock 119 KPIs data (showing subset for brevity)
const mockKPIs: KPIData[] = [
  // Operations KPIs
  {
    id: '1',
    name: 'Overall Equipment Effectiveness (OEE)',
    currentValue: 78.2,
    targetValue: 85,
    unit: '%',
    trend: 'up',
    trendPercent: 1.8,
    sparklineData: [74, 75, 76, 77, 78.2],
    formula: 'Availability × Performance × Quality',
  },
  {
    id: '2',
    name: 'Material Utilization %',
    currentValue: 87.5,
    targetValue: 85,
    unit: '%',
    trend: 'up',
    trendPercent: 2.3,
    sparklineData: [82, 84, 85, 86, 87.5],
    formula: '(Material Used / Material Issued) × 100',
  },
  {
    id: '3',
    name: 'First Pass Yield',
    currentValue: 96.3,
    targetValue: 98,
    unit: '%',
    trend: 'up',
    trendPercent: 0.5,
    sparklineData: [95.5, 95.8, 96, 96.1, 96.3],
    formula: '(Good Units / Total Units) × 100',
  },
  {
    id: '4',
    name: 'Changeover Time',
    currentValue: 45,
    targetValue: 30,
    unit: 'min',
    trend: 'down',
    trendPercent: 5.2,
    sparklineData: [52, 50, 48, 46, 45],
    formula: 'Average time between production runs',
  },
  {
    id: '5',
    name: 'Production Schedule Adherence',
    currentValue: 92.1,
    targetValue: 95,
    unit: '%',
    trend: 'up',
    trendPercent: 1.2,
    sparklineData: [89, 90, 91, 91.5, 92.1],
  },
  // Quality KPIs
  {
    id: '6',
    name: 'Defect Rate',
    currentValue: 1.8,
    targetValue: 2.0,
    unit: '%',
    trend: 'down',
    trendPercent: 0.3,
    sparklineData: [2.3, 2.1, 2.0, 1.9, 1.8],
    formula: '(Defective Units / Total Units) × 100',
  },
  {
    id: '7',
    name: 'Customer Rejection Rate',
    currentValue: 0.5,
    targetValue: 1.0,
    unit: '%',
    trend: 'stable',
    trendPercent: 0,
    sparklineData: [0.5, 0.5, 0.5, 0.5, 0.5],
  },
  {
    id: '8',
    name: 'In-Process Inspection Pass Rate',
    currentValue: 98.5,
    targetValue: 98,
    unit: '%',
    trend: 'up',
    trendPercent: 0.4,
    sparklineData: [97.8, 98.0, 98.2, 98.3, 98.5],
  },
  // Finance KPIs
  {
    id: '9',
    name: 'Revenue per Employee',
    currentValue: 285000,
    targetValue: 300000,
    unit: '$',
    trend: 'up',
    trendPercent: 3.5,
    sparklineData: [265000, 270000, 275000, 280000, 285000],
  },
  {
    id: '10',
    name: 'Operating Profit Margin',
    currentValue: 18.5,
    targetValue: 20,
    unit: '%',
    trend: 'up',
    trendPercent: 1.1,
    sparklineData: [16.5, 17.0, 17.5, 18.0, 18.5],
    formula: '(Operating Income / Revenue) × 100',
  },
  {
    id: '11',
    name: 'Days Sales Outstanding (DSO)',
    currentValue: 42,
    targetValue: 35,
    unit: 'days',
    trend: 'down',
    trendPercent: 2.3,
    sparklineData: [48, 46, 45, 43, 42],
  },
  {
    id: '12',
    name: 'Inventory Turnover Ratio',
    currentValue: 8.2,
    targetValue: 10,
    unit: 'x',
    trend: 'up',
    trendPercent: 1.5,
    sparklineData: [7.5, 7.7, 7.9, 8.0, 8.2],
  },
  // Delivery & Logistics KPIs
  {
    id: '13',
    name: 'On-Time Delivery Rate',
    currentValue: 94.5,
    targetValue: 95,
    unit: '%',
    trend: 'down',
    trendPercent: 0.8,
    sparklineData: [95, 95.5, 95, 94.8, 94.5],
  },
  {
    id: '14',
    name: 'Order Fill Rate',
    currentValue: 97.8,
    targetValue: 98,
    unit: '%',
    trend: 'up',
    trendPercent: 0.3,
    sparklineData: [97.2, 97.4, 97.5, 97.6, 97.8],
  },
  {
    id: '15',
    name: 'Warehouse Pick Accuracy',
    currentValue: 99.2,
    targetValue: 99.5,
    unit: '%',
    trend: 'up',
    trendPercent: 0.2,
    sparklineData: [98.8, 98.9, 99.0, 99.1, 99.2],
  },
  // More KPIs would be added here to reach 119 total
];

const categories = [
  'All',
  'Operations',
  'Quality',
  'Finance',
  'Delivery & Logistics',
  'Maintenance',
  'Safety',
  'HR & Training',
  'Customer Service',
];

export const KPIExplorer: React.FC = () => {
  const { t } = useTranslation();
  const { kpiFavorites, addKPIFavorite, removeKPIFavorite, preferences } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const isFavorite = (kpiId: string) =>
    kpiFavorites.some((fav) => fav.id === kpiId);

  const toggleFavorite = (kpi: KPIData) => {
    if (isFavorite(kpi.id)) {
      removeKPIFavorite(kpi.id);
    } else {
      addKPIFavorite({
        id: kpi.id,
        name: kpi.name,
        category: selectedCategory,
      });
    }
  };

  const filteredKPIs = mockKPIs.filter((kpi) => {
    const matchesSearch = kpi.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || true; // In production, KPIs would have category field
    const matchesFavorites = !showFavoritesOnly || isFavorite(kpi.id);
    return matchesSearch && matchesCategory && matchesFavorites;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('kpis.title')}</h1>
          <Breadcrumb />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium">{t('kpis.totalKPIs')}</p>
              <p className="text-4xl font-bold mt-2">119</p>
            </div>
            <TrendingUp className="h-12 w-12 text-primary-200" />
          </div>
        </div>

        <div className="card border-l-4 border-success-500">
          <p className="text-sm font-medium text-gray-600">{t('kpis.aboveTarget')}</p>
          <p className="text-3xl font-bold text-success-600 mt-2">
            {mockKPIs.filter((kpi) => kpi.currentValue >= kpi.targetValue).length}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {((mockKPIs.filter((kpi) => kpi.currentValue >= kpi.targetValue).length / mockKPIs.length) * 100).toFixed(1)}%
          </p>
        </div>

        <div className="card border-l-4 border-warning-500">
          <p className="text-sm font-medium text-gray-600">{t('kpis.nearTarget')}</p>
          <p className="text-3xl font-bold text-warning-600 mt-2">
            {mockKPIs.filter((kpi) => {
              const perf = (kpi.currentValue / kpi.targetValue) * 100;
              return perf >= 80 && perf < 100;
            }).length}
          </p>
        </div>

        <div className="card border-l-4 border-danger-500">
          <p className="text-sm font-medium text-gray-600">{t('kpis.belowTarget')}</p>
          <p className="text-3xl font-bold text-danger-600 mt-2">
            {mockKPIs.filter((kpi) => (kpi.currentValue / kpi.targetValue) * 100 < 80).length}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('kpis.search')}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={clsx(
                'flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors',
                showFavoritesOnly
                  ? 'bg-warning-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              <Star className="h-4 w-4" />
              <span>{t('kpis.favorites')} ({kpiFavorites.length})</span>
            </button>

            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none bg-gray-100 border-0 rounded-lg px-4 py-2 pr-10 font-medium text-gray-700 focus:ring-primary-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {showFavoritesOnly ? t('kpis.favoriteKPIs') : t('kpis.allKPIs')}
          </h2>
          <p className="text-sm text-gray-500">
            {t('kpis.showing', { count: filteredKPIs.length, total: mockKPIs.length })}
          </p>
        </div>

        {filteredKPIs.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500">
              {showFavoritesOnly
                ? t('kpis.noFavorites')
                : t('kpis.noResults')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredKPIs.map((kpi) => (
              <div key={kpi.id} className="relative">
                <button
                  onClick={() => toggleFavorite(kpi)}
                  className="absolute top-4 right-4 z-10 p-2 hover:bg-gray-100 rounded-full transition-colors"
                  title={isFavorite(kpi.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {isFavorite(kpi.id) ? (
                    <Star className="h-5 w-5 text-warning-500 fill-warning-500" />
                  ) : (
                    <StarOff className="h-5 w-5 text-gray-400" />
                  )}
                </button>
                <KPICard kpi={kpi} size="md" onClick={() => console.log('View KPI details:', kpi.id)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Language-specific note */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-blue-900">
              {preferences.language === 'en' ? 'Bilingual KPI Support' : '双语KPI支持'}
            </h3>
            <p className="mt-1 text-sm text-blue-700">
              {preferences.language === 'en'
                ? 'All 119 KPIs are available in both English and Mandarin Chinese. Use the language switcher in the header to toggle between languages.'
                : '所有119个KPI均提供英文和中文版本。使用页眉中的语言切换器在语言之间切换。'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
