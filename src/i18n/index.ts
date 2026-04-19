import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import ptTranslations from './locales/pt.json';
import enTranslations from './locales/en.json';

const resources = {
    pt: { translation: ptTranslations },
    en: { translation: enTranslations },
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'pt',
        supportedLngs: ['pt', 'en'],

        // Detection options
        detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage'],
            lookupLocalStorage: 'i18nextLng',
        },

        interpolation: {
            escapeValue: false, // React already handles XSS
        },

        // React options
        react: {
            useSuspense: false,
        },
    });

export default i18n;

// Export available languages
export const languages = [
    { code: 'pt', name: 'Português', flag: '🇲🇿' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
] as const;

export type LanguageCode = typeof languages[number]['code'];
