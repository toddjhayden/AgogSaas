import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client';
import { useAppStore } from '../../store/appStore';
import { Globe } from 'lucide-react';
import { UPDATE_USER_PREFERENCES } from '../../graphql/mutations/userPreferences';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const { preferences, setLanguage } = useAppStore();
  const [updatePreferences] = useMutation(UPDATE_USER_PREFERENCES);

  const toggleLanguage = async () => {
    const newLang = preferences.language === 'en' ? 'zh' : 'en';
    const langCode = newLang === 'en' ? 'en-US' : 'zh-CN';

    // Update local state immediately for better UX
    setLanguage(newLang);
    i18n.changeLanguage(newLang);

    // Sync to backend (fire and forget, handle errors silently)
    try {
      await updatePreferences({
        variables: {
          input: { preferredLanguage: langCode }
        }
      });
    } catch (error) {
      console.error('Failed to sync language preference to backend:', error);
      // Language still works locally, so we don't show error to user
    }
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
