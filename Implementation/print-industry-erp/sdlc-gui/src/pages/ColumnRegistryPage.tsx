import { useState, useEffect } from 'react';
import { Database, Shield, AlertTriangle } from 'lucide-react';
import * as api from '@/api/sdlc-client';

interface ColumnStats {
  total: number;
  byType: Record<string, number>;
  byBu: Record<string, number>;
}

export default function ColumnRegistryPage() {
  const [columnStats, setColumnStats] = useState<ColumnStats | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    reason?: string;
  } | null>(null);

  // Validation form state
  const [validateForm, setValidateForm] = useState({
    columnName: '',
    tableName: '',
    semanticType: 'attribute',
    dataType: 'varchar',
    referencesTable: '',
    requestingBu: 'core-infra',
  });

  useEffect(() => {
    api.getColumnStats().then((res) => {
      if (res.success && res.data) {
        setColumnStats(res.data);
      }
    });
  }, []);

  const handleValidate = async () => {
    const response = await api.validateColumn(
      {
        name: validateForm.columnName,
        table: validateForm.tableName,
        semanticType: validateForm.semanticType,
        dataType: validateForm.dataType,
        referencesTable: validateForm.referencesTable || undefined,
      },
      validateForm.requestingBu
    );

    if (response.data) {
      setValidationResult(response.data);
    }
  };

  const semanticTypes = ['pk', 'fk', 'attribute', 'audit', 'status'];
  const dataTypes = ['uuid', 'varchar', 'integer', 'boolean', 'timestamp', 'jsonb', 'text'];
  const bus = [
    'core-infra',
    'sales-engagement',
    'supply-chain',
    'manufacturing',
    'finance',
    'specialized',
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Column Semantic Registry</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Statistics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <Database size={24} className="text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{columnStats?.total || 0}</p>
                  <p className="text-sm text-slate-500">Total Columns</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <Shield size={24} className="text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {columnStats?.byType ? Object.keys(columnStats.byType).length : 0}
                  </p>
                  <p className="text-sm text-slate-500">Semantic Types</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle size={24} className="text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {columnStats?.byBu ? Object.keys(columnStats.byBu).length : 0}
                  </p>
                  <p className="text-sm text-slate-500">BUs Contributing</p>
                </div>
              </div>
            </div>
          </div>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By Type */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">By Semantic Type</h2>
              {columnStats?.byType && (
                <div className="space-y-3">
                  {Object.entries(columnStats.byType).map(([type, count]) => {
                    const total = columnStats.total || 1;
                    const percentage = (count / total) * 100;
                    const colors: Record<string, string> = {
                      pk: 'bg-blue-500',
                      fk: 'bg-green-500',
                      attribute: 'bg-purple-500',
                      audit: 'bg-amber-500',
                      status: 'bg-pink-500',
                    };

                    return (
                      <div key={type}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{type}</span>
                          <span className="text-slate-500">{count}</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${colors[type] || 'bg-slate-400'}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* By BU */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">By Business Unit</h2>
              {columnStats?.byBu && (
                <div className="space-y-3">
                  {Object.entries(columnStats.byBu).map(([bu, count]) => {
                    const total = columnStats.total || 1;
                    const percentage = (count / total) * 100;

                    return (
                      <div key={bu}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{bu}</span>
                          <span className="text-slate-500">{count}</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Governance Rules */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Column Semantic Governance Rules</h2>
            <div className="space-y-4 text-sm">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="font-medium text-green-800 mb-2">Allowed: Same Semantic Meaning</div>
                <code className="text-xs block bg-white p-2 rounded">
                  sales_orders.customer_id → FK to customers.id ✓<br />
                  invoices.customer_id → FK to customers.id ✓<br />
                  shipments.customer_id → FK to customers.id ✓
                </code>
              </div>

              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="font-medium text-red-800 mb-2">Blocked: Semantic Overloading</div>
                <code className="text-xs block bg-white p-2 rounded">
                  customers.customer_id → PK (the entity) ✓<br />
                  partner_links.customer_id → Actually a vendor! ✗<br />
                  legacy_codes.customer_id → A string code! ✗
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Validate Column</h2>
          <p className="text-sm text-slate-500 mb-4">
            Check if a new column name complies with semantic governance rules
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Column Name
              </label>
              <input
                type="text"
                value={validateForm.columnName}
                onChange={(e) =>
                  setValidateForm({ ...validateForm, columnName: e.target.value })
                }
                placeholder="e.g., customer_id"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Table Name
              </label>
              <input
                type="text"
                value={validateForm.tableName}
                onChange={(e) =>
                  setValidateForm({ ...validateForm, tableName: e.target.value })
                }
                placeholder="e.g., sales_orders"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Semantic Type
              </label>
              <select
                value={validateForm.semanticType}
                onChange={(e) =>
                  setValidateForm({ ...validateForm, semanticType: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg"
              >
                {semanticTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data Type
              </label>
              <select
                value={validateForm.dataType}
                onChange={(e) =>
                  setValidateForm({ ...validateForm, dataType: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg"
              >
                {dataTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {validateForm.semanticType === 'fk' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  References Table
                </label>
                <input
                  type="text"
                  value={validateForm.referencesTable}
                  onChange={(e) =>
                    setValidateForm({ ...validateForm, referencesTable: e.target.value })
                  }
                  placeholder="e.g., customers"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Requesting BU
              </label>
              <select
                value={validateForm.requestingBu}
                onChange={(e) =>
                  setValidateForm({ ...validateForm, requestingBu: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg"
              >
                {bus.map((bu) => (
                  <option key={bu} value={bu}>
                    {bu}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleValidate}
              disabled={!validateForm.columnName || !validateForm.tableName}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Validate
            </button>

            {validationResult && (
              <div
                className={`p-4 rounded-lg ${
                  validationResult.isValid
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div
                  className={`font-medium ${
                    validationResult.isValid ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  {validationResult.isValid ? 'Valid!' : 'Blocked!'}
                </div>
                {validationResult.reason && (
                  <div className="text-sm mt-1">{validationResult.reason}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
