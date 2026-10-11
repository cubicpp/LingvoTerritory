import { useAppStore } from '@/store/useAppStore';

export function ShareCard() {
  const open = useAppStore((s) => s.shareOpen);
  const close = useAppStore((s) => s.closeShare);
  const lang = useAppStore((s) => s.lang);

  if (!open) return null;

  return (
    <div className={`share-overlay ${open ? 'share-overlay--open' : ''}`} onClick={close}>
      <div className="share-card" onClick={(e) => e.stopPropagation()}>
        <p style={{ fontSize: 'var(--fs-md)', fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>
          {lang === 'zh-CN' ? '分享数据卡片' : '分享資料卡片'}
        </p>
        <div style={{ width: '100%', aspectRatio: '1', background: 'var(--bg-overlay)', borderRadius: 'var(--radius-md)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
          截图预览区域
        </div>
        <div className="share-card__btns">
          <button className="share-card__btn">{lang === 'zh-CN' ? '下载 PNG' : '下載 PNG'}</button>
          <button className="share-card__btn share-card__btn--secondary" onClick={close}>{lang === 'zh-CN' ? '关闭' : '關閉'}</button>
        </div>
      </div>
    </div>
  );
}
