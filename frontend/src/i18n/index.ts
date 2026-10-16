import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

export type UiLanguage = 'en' | 'hi';
const valid = (value: string | null | undefined): UiLanguage => value === 'hi' ? 'hi' : 'en';
const savedLanguage = valid(localStorage.getItem('evolix-language'));
void i18n.use(initReactI18next).init({
  resources: { en: { translation: {} } },
  lng: 'en', fallbackLng: 'en', supportedLngs: ['en', 'hi'],
  keySeparator: false, nsSeparator: false, initAsync: false,
  interpolation: { escapeValue: false, skipOnVariables: true },
  react: { useSuspense: false },
});
const applyLanguage = (language: string) => {
  const value = valid(language); localStorage.setItem('evolix-language', value);
  document.documentElement.lang = value; document.documentElement.dir = 'ltr';
};
let hindiReady: Promise<void> | undefined;
function loadHindi() {
  return hindiReady ??= import('./hi.json').then(({default: hindi}) => {
    i18n.addResourceBundle('hi', 'translation', hindi, true, true);
  }).catch(error => { hindiReady = undefined; throw error; });
}
i18n.on('languageChanged', applyLanguage);
// Keep a saved Hindi preference even if its first download fails; retry on selection.
export const uiLanguageReady = (savedLanguage === 'hi' ? loadHindi().then(() => i18n.changeLanguage('hi')) : Promise.resolve())
  .catch(() => { document.documentElement.lang = 'en'; })
  .then(() => { document.documentElement.lang = valid(i18n.language); document.documentElement.dir = 'ltr'; });
let languageSelection = 0;
export async function setUiLanguage(language: UiLanguage) {
  const selection = ++languageSelection, next = valid(language);
  if (next === 'hi') await loadHindi();
  if (selection === languageSelection) await i18n.changeLanguage(next);
}
export function useUiLanguage(): UiLanguage { useTranslation(); return valid(i18n.resolvedLanguage); }
// Only UI copy goes through this helper. Names, IDs, units, payload values and
// saved customer data retain their original values. Untranslated copy falls back to English.
export function ui(source: string): string { return String(i18n.t(source, { defaultValue: source })); }
export default i18n;
