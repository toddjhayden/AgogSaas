import React from 'react';
import { useAppStore } from '../../store/appStore';
import { Building2 } from 'lucide-react';

// Mock facilities data - in production, this would come from GraphQL
const facilities = [
  { id: null, name: 'All Facilities' },
  { id: 'fac-1', name: 'Shanghai Plant' },
  { id: 'fac-2', name: 'Shenzhen Plant' },
  { id: 'fac-3', name: 'Beijing Plant' },
];

export const FacilitySelector: React.FC = () => {
  const { preferences, setFacility } = useAppStore();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value === '' ? null : e.target.value;
    setFacility(value);
  };

  return (
    <div className="flex items-center space-x-2">
      <Building2 className="h-4 w-4 text-gray-600" />
      <select
        value={preferences.selectedFacility || ''}
        onChange={handleChange}
        className="text-sm border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
      >
        {facilities.map((facility) => (
          <option key={facility.id || 'all'} value={facility.id || ''}>
            {facility.name}
          </option>
        ))}
      </select>
    </div>
  );
};
