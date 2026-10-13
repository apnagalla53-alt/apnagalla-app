import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import hindi from './hi.json';

export type UiLanguage = 'en' | 'hi';
const valid = (value: string | null | undefined): UiLanguage => value === 'hi' ? 'hi' : 'en';
const english = Object.fromEntries(Object.keys(hindi).map(key => [key, key]));
void i18n.use(initReactI18next).init({
  resources: { en: { translation: english }, hi: { translation: hindi } },
  lng: valid(localStorage.getItem('evolix-language')), fallbackLng: 'en', supportedLngs: ['en', 'hi'],
  keySeparator: false, nsSeparator: false, initAsync: false,
  interpolation: { escapeValue: false, skipOnVariables: true },
  react: { useSuspense: false },
});
const applyLanguage = (language: string) => {
  const value = valid(language); localStorage.setItem('evolix-language', value);
  document.documentElement.lang = value; document.documentElement.dir = 'ltr';
};
i18n.on('languageChanged', applyLanguage);
applyLanguage(i18n.language);
export function setUiLanguage(language: UiLanguage) { return i18n.changeLanguage(valid(language)); }
export function useUiLanguage(): UiLanguage { useTranslation(); return valid(i18n.resolvedLanguage); }
// Only UI copy goes through this helper. Names, IDs, units, payload values and
// saved customer data retain their original values. Untranslated copy falls back to English.
export function ui(source: string): string { return String(i18n.t(source, { defaultValue: source })); }
export default i18n;
