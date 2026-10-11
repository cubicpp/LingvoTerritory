import { useAppStore, VIEWS, VIEW_GROUPS, BROAD_COLORS } from '@/store/useAppStore';

export function BottomNav() {
  const currentView = useAppStore((s) => s.currentView);
  const setView = useAppStore((s) => s.setView);
  const selectedDialect = useAppStore((s) => s.selectedDialect);

  const accentColor = selectedDialect
    ? BROAD_COLORS[selectedDialect.broad] || BROAD_COLORS['未分类']
    : undefined;

  return (
    <nav
      className="bottom-nav"
      style={
        accentColor
          ? {
              borderColor: accentColor + '40',
              background: `linear-gradient(135deg, var(--glass-2), ${accentColor}10)`,
            }
          : undefined
      }
    >
      <div className="bottom-nav__groups">
        {VIEW_GROUPS.map((group) => (
          <div key={group} className="bottom-nav__group">
            <span className="bottom-nav__group-label">{group}</span>
            <div className="bottom-nav__tabs">
              {VIEWS.filter((v) => v.group === group).map(({ id, labelZh, shortcut }) => (
                <button
                  key={id}
                  className={`bottom-nav__btn ${id === currentView ? 'bottom-nav__btn--active' : ''}`}
                  onClick={() => setView(id)}
                >
                  <span className="bottom-nav__shortcut">{shortcut}</span>
                  <span>{labelZh}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
