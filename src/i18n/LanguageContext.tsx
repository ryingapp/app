import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language } from './translations';

interface LanguageContextType {
  language: Language;
  isRTL: boolean;
  t: (key: string) => string;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ar',
  isRTL: true,
  t: (key: string) => key,
  setLanguage: () => {},
  toggleLanguage: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar');

  useEffect(() => {
    AsyncStorage.getItem('app_language').then((saved) => {
      if (saved === 'en' || saved === 'ar') {
        setLanguageState(saved);
        const isRTL = saved === 'ar';
        if (I18nManager.isRTL !== isRTL) {
          I18nManager.forceRTL(isRTL);
        }
      }
    });
  }, []);

  const isRTL = language === 'ar';

  const t = useCallback(
    (key: string): string => {
      return translations[language]?.[key] || key;
    },
    [language]
  );

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem('app_language', lang);
    const newRTL = lang === 'ar';
    if (I18nManager.isRTL !== newRTL) {
      I18nManager.forceRTL(newRTL);
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    const newLang = language === 'ar' ? 'en' : 'ar';
    setLanguage(newLang);
  }, [language, setLanguage]);

  return (
    <LanguageContext.Provider value={{ language, isRTL, t, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
