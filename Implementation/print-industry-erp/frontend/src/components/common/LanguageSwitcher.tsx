import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/appStore';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const { preferences, setLanguage } = useAppStore();

  const toggleLanguage = () => {
    const newLang = preferences.language === 'en' ? 'zh' : 'en';
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
      title="Switch Language / 切换语言"
    >
      <Globe className="h-4 w-4 text-gray-600" />
      <span className="text-sm font-medium text-gray-700">
        {preferences.language === 'en' ? 'EN' : '中文'}
      </span>
    </button>
  );
};
