import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HiCheck } from 'react-icons/hi';
import { languages, type LanguageCode } from '../../i18n';

export default function LanguageSelector() {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const changeLanguage = (code: LanguageCode) => {
        i18n.changeLanguage(code);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ring-1 shadow-sm
                    ${isOpen 
                        ? 'bg-primary-50 text-primary-600 ring-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:ring-primary-800' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-800 ring-gray-200/50 dark:ring-dark-700/50 hover:shadow-md'}
                `}
                title="Change language"
            >
                <span className="text-base">{currentLang.flag}</span>
                <span className="hidden md:inline">{currentLang.name}</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-52 bg-white/95 dark:bg-dark-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-dark-700/50 py-2 z-50 animate-slide-up">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-dark-700 mb-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Selecionar Idioma</p>
                    </div>
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => changeLanguage(lang.code)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-all ${lang.code === i18n.language
                                    ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700/50'
                                }`}
                        >
                            <span className="text-xl">{lang.flag}</span>
                            <span className="flex-1">{lang.name}</span>
                            {lang.code === i18n.language && (
                                <HiCheck className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
