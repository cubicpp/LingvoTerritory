import React, { Suspense, type ComponentType } from 'react';
import { useAppStore, VIEWS } from '@/store/useAppStore';
import { BottomNav } from '@/components/BottomNav';
import { RadialMenu } from '@/components/RadialMenu';
import { InfoDrawer } from '@/components/InfoDrawer';
import { ShareCard } from '@/components/ShareCard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { ViewName } from '@/types';

const MapView = React.lazy(() => import('@/components/MapView').then((m) => ({ default: m.MapView })));
const ScatterView = React.lazy(() => import('@/components/ScatterView').then((m) => ({ default: m.ScatterView })));
const TreeView = React.lazy(() => import('@/components/TreeView').then((m) => ({ default: m.TreeView })));
const MatrixView = React.lazy(() => import('@/components/MatrixView').then((m) => ({ default: m.MatrixView })));
const CharQueryView = React.lazy(() => import('@/components/views/CharQueryView').then((m) => ({ default: m.CharQueryView })));
const FeatureView = React.lazy(() => import('@/components/views/FeatureView').then((m) => ({ default: m.FeatureView })));

const VIEW_COMPONENTS: Record<ViewName, ComponentType> = {
  map: MapView,
  scatter: ScatterView,
  tree: TreeView,
  matrix: MatrixView,
  charquery: CharQueryView,
  features: FeatureView,
};

export function DataPage() {
  const currentView = useAppStore((s) => s.currentView);
  const toggleRadial = useAppStore((s) => s.toggleRadial);
  const lang = useAppStore((s) => s.lang);

  return (
    <div className="data-page">
      <div className="data-glass">
        <div className="data-glass__header">
          <button className="bottom-nav__gear" onClick={toggleRadial} aria-label={lang === 'zh-CN' ? '设置' : '設定'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
        <div className="view-container">
          {VIEWS.map(({ id }) => {
            const Comp = VIEW_COMPONENTS[id];
            return (
              <div key={id} className={`view ${id === currentView ? 'view--visible' : 'view--hidden'}`}>
                <ErrorBoundary>
                  <Suspense fallback={null}>
                    <Comp />
                  </Suspense>
                </ErrorBoundary>
              </div>
            );
          })}
        </div>
        <InfoDrawer />
        <RadialMenu />
      </div>
      <BottomNav />
      <ShareCard />
    </div>
  );
}
