/**
 * EVOLIX Trade ERP — i18n Foundation.
 *
 * Translation key system ready for English and Hindi.
 * No hardcoded translatable strings in components.
 */

type LocaleKey = 'en' | 'hi';

interface Translations {
  [key: string]: string;
}

const translations: Record<LocaleKey, Translations> = {
  en: {
    'app.name': 'EVOLIX Trade ERP',
    'app.tagline': 'Local-First Hybrid ERP',
    'health.title': 'System Health',
    'health.status.healthy': 'Healthy',
    'health.status.degraded': 'Degraded',
    'health.status.loading': 'Checking...',
    'health.status.error': 'Error',
    'health.backend': 'Backend',
    'health.database': 'Database',
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.retry': 'Retry',
    'common.refresh': 'Refresh',
    'foundation.title': 'Foundation',
    'foundation.description': 'Module 00 — System foundation is ready.',
  },
  hi: {
    'app.name': 'EVOLIX Trade ERP',
    'app.tagline': 'लोकल-फर्स्ट हाइब्रिड ERP',
    'health.title': 'सिस्टम स्थिति',
    'health.status.healthy': 'स्वस्थ',
    'health.status.degraded': 'अवनत',
    'health.status.loading': 'जाँच हो रही है...',
    'health.status.error': 'त्रुटि',
    'health.backend': 'बैकेंड',
    'health.database': 'डेटाबेस',
    'common.loading': 'लोड हो रहा है...',
    'common.error': 'एक त्रुटि हुई',
    'common.retry': 'पुनः प्रयास करें',
    'common.refresh': 'रिफ्रेश',
    'foundation.title': 'फाउंडेशन',
    'foundation.description': 'मॉड्यूल 00 — सिस्टम फाउंडेशन तैयार है।',
  },
};

let currentLocale: LocaleKey = 'en';

export function setLocale(locale: LocaleKey): void {
  currentLocale = locale;
}

export function getLocale(): LocaleKey {
  return currentLocale;
}

export function t(key: string): string {
  return translations[currentLocale][key] ?? translations['en'][key] ?? key;
}

export type { LocaleKey };
