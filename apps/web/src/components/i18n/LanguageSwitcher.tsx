import { Languages } from 'lucide-react';

import { useI18n } from '@/i18n/I18nProvider';

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-small font-medium text-ink-secondary shadow-sm">
      <Languages className="h-4 w-4" aria-hidden />
      <span className="sr-only">{t('common.language')}</span>
      <select
        aria-label={t('common.language')}
        value={language}
        onChange={(event) => setLanguage(event.target.value as 'en' | 'am')}
        className="cursor-pointer bg-transparent outline-none"
      >
        <option value="en">{t('common.english')}</option>
        <option value="am">{t('common.amharic')}</option>
      </select>
    </label>
  );
}
