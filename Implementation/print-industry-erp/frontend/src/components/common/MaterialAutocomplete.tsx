import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@apollo/client';
import { Search, Package, X } from 'lucide-react';
import { GET_MATERIALS } from '../../graphql/queries/forecasting';

interface Material {
  id: string;
  materialCode: string;
  materialName: string;
  description: string | null;
  materialType: string;
  materialCategory: string | null;
  primaryUom: string;
  isActive: boolean;
}

interface MaterialAutocompleteProps {
  tenantId: string;
  value: string;
  onChange: (materialId: string, material: Material | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const MaterialAutocomplete: React.FC<MaterialAutocompleteProps> = ({
  tenantId,
  value,
  onChange,
  placeholder = 'Search materials...',
  disabled = false,
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Query materials
  const { data, loading } = useQuery<{ materials: Material[] }>(GET_MATERIALS, {
    variables: {
      tenantId,
      isActive: true,
      limit: 50,
      offset: 0,
    },
    skip: !tenantId,
  });

  const materials = data?.materials || [];

  // Filter materials based on search term
  const filteredMaterials = materials.filter((material) => {
    const search = searchTerm.toLowerCase();
    return (
      material.materialCode.toLowerCase().includes(search) ||
      material.materialName.toLowerCase().includes(search) ||
      material.description?.toLowerCase().includes(search) ||
      material.id === search
    );
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update selected material when value changes
  useEffect(() => {
    if (value && materials.length > 0) {
      const material = materials.find((m) => m.id === value);
      if (material) {
        setSelectedMaterial(material);
        setSearchTerm(material.materialCode);
      }
    } else {
      setSelectedMaterial(null);
      setSearchTerm('');
    }
  }, [value, materials]);

  const handleSelect = (material: Material) => {
    setSelectedMaterial(material);
    setSearchTerm(material.materialCode);
    onChange(material.id, material);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedMaterial(null);
    setSearchTerm('');
    onChange('', null);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);

    // If user clears the input, clear the selection
    if (!newValue) {
      handleClear();
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
            selectedMaterial ? 'bg-blue-50 border-blue-300' : ''
          }`}
        />
        {searchTerm && !disabled && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-500">Loading materials...</div>
          )}

          {!loading && filteredMaterials.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">No materials found</div>
          )}

          {!loading && filteredMaterials.length > 0 && (
            <div className="py-1">
              {filteredMaterials.map((material) => (
                <button
                  key={material.id}
                  onClick={() => handleSelect(material)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors ${
                    material.id === value ? 'bg-blue-50' : ''
                  }`}
                  type="button"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <Package className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {material.materialCode}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            material.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {material.materialType}
                        </span>
                      </div>
                      <div className="text-sm text-gray-900 font-medium">
                        {material.materialName}
                      </div>
                      {material.description && (
                        <div className="text-xs text-gray-500 truncate">
                          {material.description}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>UOM: {material.primaryUom}</span>
                        {material.materialCategory && (
                          <span>Category: {material.materialCategory}</span>
                        )}
                        <span className="text-gray-400">ID: {material.id}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Material Display */}
      {selectedMaterial && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                {selectedMaterial.materialName}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Code: {selectedMaterial.materialCode} | Type: {selectedMaterial.materialType} | UOM:{' '}
                {selectedMaterial.primaryUom}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
