import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// PT é o idioma por defeito e o fallback — carregado eagerly.
// EN é carregado dinamicamente quando o utilizador troca para inglês,
// poupando ~27KB no bundle inicial (ver performance-and-caching §4).
import ptTranslations from './locales/pt.json';

const loadedLngs = new Set<string>(['pt']);

async function loadLanguage(lng: string): Promise<void> {
    if (loadedLngs.has(lng)) return;
    if (lng === 'en') {
        const { default: enTranslations } = await import('./locales/en.json');
        i18n.addResourceBundle('en', 'translation', enTranslations, true, true);
        loadedLngs.add('en');
    }
}

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            pt: { translation: ptTranslations },
        },
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

// Se o idioma detectado for diferente de PT (ex.: EN), carrega-o de imediato.
const detected = i18n.language?.split('-')[0];
if (detected && detected !== 'pt') {
    loadLanguage(detected).then(() => i18n.changeLanguage(detected)).catch(() => {});
}

// Intercepta mudanças de idioma para carregar o bundle on-demand.
i18n.on('languageChanged', (lng) => {
    const base = lng?.split('-')[0];
    if (base) loadLanguage(base).catch(() => {});
});

export default i18n;

// Export available languages
export const languages = [
    { code: 'pt', name: 'Português', flag: '🇲🇿' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
] as const;

export type LanguageCode = typeof languages[number]['code'];
