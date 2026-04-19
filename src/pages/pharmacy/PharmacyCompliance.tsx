import { useState } from 'react';
import { cn } from '../../utils/helpers';
import PharmacyNarcoticRegister from './PharmacyNarcoticRegister';
import PharmacyRecalls from './PharmacyRecalls';
import PharmacyDrugInteractions from './PharmacyDrugInteractions';
import { HiOutlineClipboardDocumentList, HiOutlineExclamationCircle, HiOutlineBolt } from 'react-icons/hi2';

const TABS = [
    { id: 'narcotics', label: 'Registo de Narcóticos', icon: HiOutlineClipboardDocumentList },
    { id: 'recalls', label: 'Recalls', icon: HiOutlineExclamationCircle },
    { id: 'interactions', label: 'Interações', icon: HiOutlineBolt },
];

export default function PharmacyCompliance() {
    const [tab, setTab] = useState<'narcotics' | 'recalls' | 'interactions'>('narcotics');

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conformidade Regulatória</h1>
                    <p className="text-gray-500 dark:text-gray-400">Registo de narcóticos e gestão de recalls de medicamentos</p>
                </div>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1 w-fit">
                {TABS.map(t => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id as any)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                tab === t.id
                                    ? 'bg-white dark:bg-dark-800 text-primary-600 dark:text-primary-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Strip the sub-page headers since we already have the header above */}
            <div>
                {tab === 'narcotics' && <PharmacyNarcoticRegister />}
                {tab === 'recalls' && <PharmacyRecalls />}
                {tab === 'interactions' && <PharmacyDrugInteractions />}
            </div>
        </div>
    );
}
