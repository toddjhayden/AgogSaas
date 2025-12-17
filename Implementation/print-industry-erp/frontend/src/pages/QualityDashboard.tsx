import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Chart } from '../components/common/Chart';
import { Breadcrumb } from '../components/layout/Breadcrumb';

const mockDefectData = [
  { product: 'Business Cards', defectRate: 1.2, trend: -0.3 },
  { product: 'Brochures', defectRate: 0.8, trend: -0.1 },
  { product: 'Flyers', defectRate: 1.5, trend: 0.2 },
  { product: 'Posters', defectRate: 2.1, trend: -0.5 },
];

export const QualityDashboard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('quality.title')}</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Quality Score</p>
              <p className="text-3xl font-bold text-success-600 mt-2">98.5%</p>
            </div>
            <ShieldCheck className="h-10 w-10 text-success-500" />
          </div>
        </div>

        <div className="card border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Defect Rate</p>
              <p className="text-3xl font-bold text-primary-600 mt-2">1.5%</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-primary-500" />
          </div>
        </div>

        <div className="card border-l-4 border-warning-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Open NCRs</p>
              <p className="text-3xl font-bold text-warning-600 mt-2">7</p>
            </div>
            <XCircle className="h-10 w-10 text-warning-500" />
          </div>
        </div>

        <div className="card border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Inspections Passed</p>
              <p className="text-3xl font-bold text-success-600 mt-2">342</p>
            </div>
            <CheckCircle className="h-10 w-10 text-success-500" />
          </div>
        </div>
      </div>

      <Chart
        type="bar"
        data={mockDefectData}
        xKey="product"
        yKey="defectRate"
        title={t('quality.defectRates')}
        colors={['#ef4444']}
        height={300}
      />
    </div>
  );
};
