import { useAppStore } from '@/store/useAppStore';
import { t } from '@/lib/i18n';

export function LoadingScreen() {
  const lang = useAppStore((s) => s.lang);
  return (
    <div className="loading">
      <div className="loading-blob" />
      <span className="loading-label">{t('loading', lang)}</span>
    </div>
  );
}
