import { useAppStore } from '@/store/useAppStore';
import { t } from '@/lib/i18n';

export function ErrorScreen({ message }: { message: string }) {
  const lang = useAppStore((s) => s.lang);
  return (
    <div className="error-box">
      <div className="error-box__title">{t('loadError', lang)}</div>
      <div className="error-box__msg">{message}</div>
      <button className="error-box__retry btn-magnetic" onClick={() => window.location.reload()}>
        {t('retry', lang)}
      </button>
    </div>
  );
}
