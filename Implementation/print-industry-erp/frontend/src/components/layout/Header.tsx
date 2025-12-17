import React from 'react';
import { Bell, User, Settings } from 'lucide-react';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { FacilitySelector } from '../common/FacilitySelector';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold text-primary-600">AgogSaaS ERP</h1>
      </div>

      <div className="flex items-center space-x-4">
        <FacilitySelector />
        <LanguageSwitcher />

        <button className="p-2 hover:bg-gray-100 rounded-lg relative">
          <Bell className="h-5 w-5 text-gray-600" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-danger-500 rounded-full"></span>
        </button>

        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <Settings className="h-5 w-5 text-gray-600" />
        </button>

        <button className="flex items-center space-x-2 hover:bg-gray-100 rounded-lg p-2">
          <div className="h-8 w-8 bg-primary-500 rounded-full flex items-center justify-center">
            <User className="h-5 w-5 text-white" />
          </div>
          <span className="text-sm font-medium">Admin User</span>
        </button>
      </div>
    </header>
  );
};
