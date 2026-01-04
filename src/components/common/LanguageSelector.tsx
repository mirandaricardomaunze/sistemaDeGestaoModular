import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HiOutlineGlobeAlt, HiCheck } from 'react-icons/hi';
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
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                title="Change language"
            >
                <HiOutlineGlobeAlt className="w-5 h-5" />
                <span className="hidden sm:inline">{currentLang.flag}</span>
                <span className="hidden md:inline">{currentLang.name}</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-gray-200 dark:border-dark-700 py-1 z-50 animate-fade-in">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => changeLanguage(lang.code)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors ${lang.code === i18n.language
                                    ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            <span className="text-lg">{lang.flag}</span>
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
