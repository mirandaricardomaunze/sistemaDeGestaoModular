import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HiCheck, HiOutlineLanguage } from 'react-icons/hi2';
import { languages, type LanguageCode } from '../../i18n';
import { Button } from '../ui/Button';

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
            <Button variant="ghost"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-300
                    ${isOpen
                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                        : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-dark-800'}
                `}
                title={`Idioma: ${currentLang.name}`}
                aria-label="Change language"
            >
                <HiOutlineLanguage className="w-5 h-5" />
            </Button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-52 bg-white dark:bg-dark-800/95 backdrop-blur-xl rounded-2xl shadow-card-hover border border-slate-300/70 dark:border-dark-700/50 py-2 z-50 animate-slide-up">
                    <div className="px-4 py-2 border-b border-slate-200 dark:border-dark-700 mb-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Selecionar Idioma</p>
                    </div>
                    {languages.map((lang) => (
                        <Button variant="ghost"
                            key={lang.code}
                            onClick={() => changeLanguage(lang.code)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-all ${lang.code === i18n.language
                                    ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                                    : 'text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-dark-700/50'
                                }`}
                        >
                            <span className="text-xl">{lang.flag}</span>
                            <span className="flex-1">{lang.name}</span>
                            {lang.code === i18n.language && (
                                <HiCheck className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            )}
                        </Button>
                    ))}
                </div>
            )}
        </div>
    );
}
