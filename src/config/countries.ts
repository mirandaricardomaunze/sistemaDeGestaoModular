/**
 * Countries List for International Guest Support
 * Optimized for Mozambique hotel industry with common visitor countries first
 */

export interface Country {
    code: string;      // ISO 3166-1 alpha-2
    name: string;      // Country name in Portuguese
    nameEn: string;    // Country name in English
    dialCode: string;  // International dialing code
    flag: string;      // Emoji flag
}

// Priority countries (most common visitors to Mozambique hotels)
const PRIORITY_COUNTRIES: Country[] = [
    { code: 'MZ', name: 'Moçambique', nameEn: 'Mozambique', dialCode: '+258', flag: '🇲🇿' },
    { code: 'ZA', name: 'África do Sul', nameEn: 'South Africa', dialCode: '+27', flag: '🇿🇦' },
    { code: 'ZW', name: 'Zimbábue', nameEn: 'Zimbabwe', dialCode: '+263', flag: '🇿🇼' },
    { code: 'PT', name: 'Portugal', nameEn: 'Portugal', dialCode: '+351', flag: '🇵🇹' },
    { code: 'BR', name: 'Brasil', nameEn: 'Brazil', dialCode: '+55', flag: '🇧🇷' },
    { code: 'MW', name: 'Malawi', nameEn: 'Malawi', dialCode: '+265', flag: '🇲🇼' },
    { code: 'TZ', name: 'Tanzânia', nameEn: 'Tanzania', dialCode: '+255', flag: '🇹🇿' },
    { code: 'SZ', name: 'Eswatini', nameEn: 'Eswatini', dialCode: '+268', flag: '🇸🇿' },
    { code: 'GB', name: 'Reino Unido', nameEn: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
    { code: 'US', name: 'Estados Unidos', nameEn: 'United States', dialCode: '+1', flag: '🇺🇸' },
    { code: 'DE', name: 'Alemanha', nameEn: 'Germany', dialCode: '+49', flag: '🇩🇪' },
    { code: 'FR', name: 'França', nameEn: 'France', dialCode: '+33', flag: '🇫🇷' },
    { code: 'NL', name: 'Países Baixos', nameEn: 'Netherlands', dialCode: '+31', flag: '🇳🇱' },
    { code: 'IT', name: 'Itália', nameEn: 'Italy', dialCode: '+39', flag: '🇮🇹' },
    { code: 'ES', name: 'Espanha', nameEn: 'Spain', dialCode: '+34', flag: '🇪🇸' },
    { code: 'CN', name: 'China', nameEn: 'China', dialCode: '+86', flag: '🇨🇳' },
    { code: 'IN', name: 'Índia', nameEn: 'India', dialCode: '+91', flag: '🇮🇳' },
    { code: 'AE', name: 'Emirados Árabes', nameEn: 'UAE', dialCode: '+971', flag: '🇦🇪' },
];

// Other African countries
const AFRICAN_COUNTRIES: Country[] = [
    { code: 'AO', name: 'Angola', nameEn: 'Angola', dialCode: '+244', flag: '🇦🇴' },
    { code: 'BW', name: 'Botsuana', nameEn: 'Botswana', dialCode: '+267', flag: '🇧🇼' },
    { code: 'ZM', name: 'Zâmbia', nameEn: 'Zambia', dialCode: '+260', flag: '🇿🇲' },
    { code: 'NA', name: 'Namíbia', nameEn: 'Namibia', dialCode: '+264', flag: '🇳🇦' },
    { code: 'KE', name: 'Quénia', nameEn: 'Kenya', dialCode: '+254', flag: '🇰🇪' },
    { code: 'UG', name: 'Uganda', nameEn: 'Uganda', dialCode: '+256', flag: '🇺🇬' },
    { code: 'RW', name: 'Ruanda', nameEn: 'Rwanda', dialCode: '+250', flag: '🇷🇼' },
    { code: 'ET', name: 'Etiópia', nameEn: 'Ethiopia', dialCode: '+251', flag: '🇪🇹' },
    { code: 'NG', name: 'Nigéria', nameEn: 'Nigeria', dialCode: '+234', flag: '🇳🇬' },
    { code: 'GH', name: 'Gana', nameEn: 'Ghana', dialCode: '+233', flag: '🇬🇭' },
    { code: 'EG', name: 'Egipto', nameEn: 'Egypt', dialCode: '+20', flag: '🇪🇬' },
    { code: 'MA', name: 'Marrocos', nameEn: 'Morocco', dialCode: '+212', flag: '🇲🇦' },
    { code: 'DZ', name: 'Argélia', nameEn: 'Algeria', dialCode: '+213', flag: '🇩🇿' },
    { code: 'TN', name: 'Tunísia', nameEn: 'Tunisia', dialCode: '+216', flag: '🇹🇳' },
    { code: 'SN', name: 'Senegal', nameEn: 'Senegal', dialCode: '+221', flag: '🇸🇳' },
    { code: 'CI', name: 'Costa do Marfim', nameEn: 'Ivory Coast', dialCode: '+225', flag: '🇨🇮' },
    { code: 'MU', name: 'Maurícias', nameEn: 'Mauritius', dialCode: '+230', flag: '🇲🇺' },
    { code: 'SC', name: 'Seicheles', nameEn: 'Seychelles', dialCode: '+248', flag: '🇸🇨' },
    { code: 'MG', name: 'Madagáscar', nameEn: 'Madagascar', dialCode: '+261', flag: '🇲🇬' },
    { code: 'CD', name: 'R.D. Congo', nameEn: 'DR Congo', dialCode: '+243', flag: '🇨🇩' },
];

// Other international countries
const OTHER_COUNTRIES: Country[] = [
    { code: 'AU', name: 'Austrália', nameEn: 'Australia', dialCode: '+61', flag: '🇦🇺' },
    { code: 'NZ', name: 'Nova Zelândia', nameEn: 'New Zealand', dialCode: '+64', flag: '🇳🇿' },
    { code: 'CA', name: 'Canadá', nameEn: 'Canada', dialCode: '+1', flag: '🇨🇦' },
    { code: 'MX', name: 'México', nameEn: 'Mexico', dialCode: '+52', flag: '🇲🇽' },
    { code: 'AR', name: 'Argentina', nameEn: 'Argentina', dialCode: '+54', flag: '🇦🇷' },
    { code: 'CL', name: 'Chile', nameEn: 'Chile', dialCode: '+56', flag: '🇨🇱' },
    { code: 'CO', name: 'Colômbia', nameEn: 'Colombia', dialCode: '+57', flag: '🇨🇴' },
    { code: 'JP', name: 'Japão', nameEn: 'Japan', dialCode: '+81', flag: '🇯🇵' },
    { code: 'KR', name: 'Coreia do Sul', nameEn: 'South Korea', dialCode: '+82', flag: '🇰🇷' },
    { code: 'SG', name: 'Singapura', nameEn: 'Singapore', dialCode: '+65', flag: '🇸🇬' },
    { code: 'MY', name: 'Malásia', nameEn: 'Malaysia', dialCode: '+60', flag: '🇲🇾' },
    { code: 'TH', name: 'Tailândia', nameEn: 'Thailand', dialCode: '+66', flag: '🇹🇭' },
    { code: 'ID', name: 'Indonésia', nameEn: 'Indonesia', dialCode: '+62', flag: '🇮🇩' },
    { code: 'PH', name: 'Filipinas', nameEn: 'Philippines', dialCode: '+63', flag: '🇵🇭' },
    { code: 'VN', name: 'Vietname', nameEn: 'Vietnam', dialCode: '+84', flag: '🇻🇳' },
    { code: 'RU', name: 'Rússia', nameEn: 'Russia', dialCode: '+7', flag: '🇷🇺' },
    { code: 'UA', name: 'Ucrânia', nameEn: 'Ukraine', dialCode: '+380', flag: '🇺🇦' },
    { code: 'PL', name: 'Polónia', nameEn: 'Poland', dialCode: '+48', flag: '🇵🇱' },
    { code: 'SE', name: 'Suécia', nameEn: 'Sweden', dialCode: '+46', flag: '🇸🇪' },
    { code: 'NO', name: 'Noruega', nameEn: 'Norway', dialCode: '+47', flag: '🇳🇴' },
    { code: 'DK', name: 'Dinamarca', nameEn: 'Denmark', dialCode: '+45', flag: '🇩🇰' },
    { code: 'FI', name: 'Finlândia', nameEn: 'Finland', dialCode: '+358', flag: '🇫🇮' },
    { code: 'AT', name: 'Áustria', nameEn: 'Austria', dialCode: '+43', flag: '🇦🇹' },
    { code: 'CH', name: 'Suíça', nameEn: 'Switzerland', dialCode: '+41', flag: '🇨🇭' },
    { code: 'BE', name: 'Bélgica', nameEn: 'Belgium', dialCode: '+32', flag: '🇧🇪' },
    { code: 'IE', name: 'Irlanda', nameEn: 'Ireland', dialCode: '+353', flag: '🇮🇪' },
    { code: 'GR', name: 'Grécia', nameEn: 'Greece', dialCode: '+30', flag: '🇬🇷' },
    { code: 'TR', name: 'Turquia', nameEn: 'Turkey', dialCode: '+90', flag: '🇹🇷' },
    { code: 'IL', name: 'Israel', nameEn: 'Israel', dialCode: '+972', flag: '🇮🇱' },
    { code: 'SA', name: 'Arábia Saudita', nameEn: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦' },
    { code: 'QA', name: 'Qatar', nameEn: 'Qatar', dialCode: '+974', flag: '🇶🇦' },
    { code: 'PK', name: 'Paquistão', nameEn: 'Pakistan', dialCode: '+92', flag: '🇵🇰' },
    { code: 'BD', name: 'Bangladesh', nameEn: 'Bangladesh', dialCode: '+880', flag: '🇧🇩' },
];

// All countries combined
export const COUNTRIES: Country[] = [
    ...PRIORITY_COUNTRIES,
    ...AFRICAN_COUNTRIES.sort((a, b) => a.name.localeCompare(b.name)),
    ...OTHER_COUNTRIES.sort((a, b) => a.name.localeCompare(b.name)),
];

// Helper functions
export const getCountryByCode = (code: string): Country | undefined =>
    COUNTRIES.find(c => c.code === code);

export const getCountryByDialCode = (dialCode: string): Country | undefined =>
    COUNTRIES.find(c => c.dialCode === dialCode);

export const getDialCodeFromPhone = (phone: string): string => {
    const match = phone.match(/^\+\d{1,4}/);
    return match ? match[0] : '+258';
};

export const formatPhoneWithCode = (phone: string, countryCode: string): string => {
    const country = getCountryByCode(countryCode);
    if (!country) return phone;

    // Remove existing dial code if present
    const cleanPhone = phone.replace(/^\+\d{1,4}\s*/, '').replace(/\D/g, '');
    return `${country.dialCode} ${cleanPhone}`;
};

// Document types for different nationalities
export const DOCUMENT_TYPES = [
    { value: 'BI', label: 'Bilhete de Identidade (BI)', forLocal: true },
    { value: 'passport', label: 'Passaporte', forLocal: true },
    { value: 'DIRE', label: 'DIRE (Documento de Residente)', forLocal: false },
    { value: 'visa', label: 'Visto', forLocal: false },
    { value: 'driving_license', label: 'Carta de Condução', forLocal: true },
    { value: 'other', label: 'Outro Documento', forLocal: true },
];

export const getDocumentTypesForCountry = (countryCode: string) => {
    const isLocal = countryCode === 'MZ';
    if (isLocal) {
        return DOCUMENT_TYPES.filter(d => d.forLocal);
    }
    return DOCUMENT_TYPES.filter(d => d.value === 'passport' || d.value === 'visa' || d.value === 'DIRE');
};

export default COUNTRIES;
