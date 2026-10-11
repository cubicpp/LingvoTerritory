import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ReactNode } from "react";
import { presentationSlides } from "@/lib/presentationSlides";
import type { PresentationSlide } from "@/lib/presentationSlides";
import { useAppStore } from "@/store/useAppStore";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GuideDrawer } from "@/components/GuideDrawer";
import { GuideModal } from "@/components/GuideModal";
import { InfoDrawer } from "@/components/InfoDrawer";

interface PresentationShellProps {
  renderView: () => ReactNode;
}

function slideText(text: string, _lang: string) {
  return text;
}

function resolveGuideId(view: string, tab: string, sub: string, treeMode: string) {
  if (view === "tree") return treeMode === "radial" ? "tree" : "treemap";
  if (tab === "matrix") return "phonology";
  if (tab === "coverage") return "coverage";
  if (tab === "charquery" && sub === "dict") return "dictcompare";
  if (tab === "history") return "history";
  if (tab === "sankey") return "sankey";
  if (tab === "parallel" && sub === "ridge") return "ridge";
  if (tab === "parallel") return "parallel";
  if (tab === "ridge") return "ridge";
  if (tab === "nushu") return "nushu";
  if (tab === "cjk") return "cjk";
  if (tab === "ime") return "ime";
  if (tab === "treemap") return "treemap";
  if (tab === "tonecurve") return "tonecurve";
  if (tab === "dialectchar") return "dialectchar";
  return view;
}

function applySlideState(slide: PresentationSlide) {
  const state = useAppStore.getState();
  state.setGuideOpen(slide.viewState?.guideOpen ?? false);
  state.selectDialect(null);
  state.setCompareDialect(null);
  state.hoverDialect(null);

  if (!slide.viewId) return;
  state.setView(slide.viewId);
  if (slide.tabId && slide.tabId !== slide.viewId) state.setTabView(slide.tabId);
  if (slide.viewState?.mdsSource) state.setMdsSource(slide.viewState.mdsSource);
  if (slide.viewState?.treeMode) state.setTreeMode(slide.viewState.treeMode);
  if (typeof slide.viewState?.subMode === "string") state.setSubMode(slide.viewState.subMode);

  if (slide.viewState?.selectedDialectId) {
    const point = state.dataCache.dialects?.points.find((p) => p.id === slide.viewState?.selectedDialectId);
    if (point) state.selectDialect(point);
  }
}

export function PresentationShell({ renderView }: PresentationShellProps) {
  const lang = useAppStore((s) => s.lang);
  const currentSlideIndex = useAppStore((s) => s.currentSlideIndex);
  const currentView = useAppStore((s) => s.currentView);
  const tabView = useAppStore((s) => s.tabView);
  const subMode = useAppStore((s) => s.subMode);
  const treeMode = useAppStore((s) => s.treeMode);
  const goToSlide = useAppStore((s) => s.goToSlide);
  const exitPresentation = useAppStore((s) => s.exitPresentation);
  const selectedDialect = useAppStore((s) => s.selectedDialect);
  const guideOpen = useAppStore((s) => s.guideOpen);
  const setGuideOpen = useAppStore((s) => s.setGuideOpen);
  const selectDialect = useAppStore((s) => s.selectDialect);
  const toolbarPosition = useAppStore((s) => s.presentationToolbarPosition);
  const setToolbarPosition = useAppStore((s) => s.setPresentationToolbarPosition);
  const shellRef = useRef<HTMLElement | null>(null);
  const slide = presentationSlides[Math.min(Math.max(currentSlideIndex, 0), presentationSlides.length - 1)];
  const progress = ((currentSlideIndex + 1) / presentationSlides.length) * 100;
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ offsetX: number; offsetY: number; dragging: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    applySlideState(slide);
  }, [slide]);

  useEffect(() => {
    const runTypeset = async () => {
      const mj = (window as Window & {
        MathJax?: {
          typesetPromise?: (elements?: Element[]) => Promise<void>;
          startup?: { promise?: Promise<void> };
        };
      }).MathJax;
      if (!mj?.typesetPromise || !shellRef.current) return;
      try {
        if (mj.startup?.promise) await mj.startup.promise;
        await mj.typesetPromise([shellRef.current]);
      } catch {
        // Keep presentation usable even if MathJax fails to load.
      }
    };
    const id = window.setTimeout(() => { void runTypeset(); }, 0);
    return () => window.clearTimeout(id);
  }, [currentSlideIndex, lang, slide.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        goToSlide(Math.min(currentSlideIndex + 1, presentationSlides.length - 1));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToSlide(Math.max(currentSlideIndex - 1, 0));
      } else if (event.key === "Escape") {
        event.preventDefault();
        if (guideOpen) {
          setGuideOpen(false);
          return;
        }
        if (useAppStore.getState().selectedDialect) {
          useAppStore.getState().selectDialect(null);
          return;
        }
        exitPresentation();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [currentSlideIndex, exitPresentation, goToSlide, guideOpen, setGuideOpen]);

  const goPrev = () => goToSlide(Math.max(currentSlideIndex - 1, 0));
  const goNext = () => goToSlide(Math.min(currentSlideIndex + 1, presentationSlides.length - 1));
  const isCoverSlide = slide.id === "cover";
  const isStructuredTextSlide = slide.id === "overview" || slide.id === "data-flow" || slide.id === "closing";
  const isViewSlide = slide.kind === "view_slide";
  const toolbarStyle = useMemo(() => ({
    left: `${toolbarPosition.x}px`,
    top: `${toolbarPosition.y}px`,
  }), [toolbarPosition.x, toolbarPosition.y]);

  useEffect(() => {
    const clampToolbar = () => {
      const el = toolbarRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const maxX = Math.max(12, window.innerWidth - rect.width - 12);
      const maxY = Math.max(12, window.innerHeight - rect.height - 12);
      const next = {
        x: Math.min(Math.max(12, toolbarPosition.x), maxX),
        y: Math.min(Math.max(12, toolbarPosition.y), maxY),
      };
      if (next.x !== toolbarPosition.x || next.y !== toolbarPosition.y) setToolbarPosition(next);
    };
    window.addEventListener("resize", clampToolbar);
    return () => window.removeEventListener("resize", clampToolbar);
  }, [setToolbarPosition, toolbarPosition.x, toolbarPosition.y]);

  const onToolbarPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const el = toolbarRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragStateRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      dragging: false,
    };
    const onMove = (moveEvent: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      dragState.dragging = true;
      const nextRect = toolbarRef.current?.getBoundingClientRect();
      const width = nextRect?.width ?? rect.width;
      const height = nextRect?.height ?? rect.height;
      const maxX = Math.max(12, window.innerWidth - width - 12);
      const maxY = Math.max(12, window.innerHeight - height - 12);
      const next = {
        x: Math.min(Math.max(12, moveEvent.clientX - dragState.offsetX), maxX),
        y: Math.min(Math.max(12, moveEvent.clientY - dragState.offsetY), maxY),
      };
      setToolbarPosition(next);
      setDragging(true);
    };
    const onUp = () => {
      dragStateRef.current = null;
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const renderDetailBlocks = () => {
    if (slide.detailBlocks?.length) {
      return (
        <div className="presentation-detailblocks">
          {slide.detailBlocks.map((block) => (
            <section key={block.heading} className="presentation-detailblock">
              <h2>{slideText(block.heading, lang)}</h2>
              <ul className="presentation-detailblock__items">
                <li>{slideText(block.body, lang)}</li>
                {block.items?.map((item) => <li key={item}>{slideText(item, lang)}</li>)}
              </ul>
            </section>
          ))}
        </div>
      );
    }
    return (
      <ul>
        {slide.notes.map((note) => <li key={note}>{slideText(note, lang)}</li>)}
      </ul>
    );
  };
  const renderStructuredTextSlide = () => {
    const blocks = slide.detailBlocks ?? [];
    return (
      <main className={`presentation-structured-sheet presentation-structured-sheet--${slide.id}`}>
        <header className="presentation-structured-sheet__head">
          <div className="presentation-structured-sheet__title">
            <p className="presentation-kicker">{slideText(slide.section, lang)} · {String(currentSlideIndex + 1).padStart(2, "0")}</p>
            <h1>{slideText(slide.title, lang)}</h1>
          </div>
          {slide.claim ? <p className="presentation-structured-sheet__claim">{slideText(slide.claim, lang)}</p> : null}
        </header>
        <section className={`presentation-structured-sheet__grid presentation-structured-sheet__grid--${slide.id}`}>
          {blocks.map((block) => (
            <article key={block.heading} className="presentation-structured-sheet__card">
              <h2>{slideText(block.heading, lang)}</h2>
              <p className="presentation-structured-sheet__bodycopy">{slideText(block.body, lang)}</p>
              {block.items && (
                <div className="presentation-structured-sheet__points">
                  {block.items.map((item) => <p key={item}>{slideText(item, lang)}</p>)}
                </div>
              )}
            </article>
          ))}
        </section>
      </main>
    );
  };
  const renderViewRail = () => {
    const blocks = slide.detailBlocks ?? [];
    return (
      <aside className="presentation-rail presentation-rail--view">
        <div className="presentation-detailblocks">
          {blocks.map((block) => (
            <section key={block.heading} className="presentation-detailblock">
              <h2>{slideText(block.heading, lang)}</h2>
              <p className="presentation-detailblock__lead">{slideText(block.body, lang)}</p>
              {block.items?.length ? (
                <ul className="presentation-detailblock__items">
                  {block.items.map((item) => <li key={item}>{slideText(item, lang)}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </aside>
    );
  };

  return (
    <section ref={shellRef} className={`presentation-shell presentation-shell--${slide.kind} ${isCoverSlide ? " presentation-shell--cover" : ""}${selectedDialect ? " presentation-shell--drawer-open" : ""}`} aria-label="Presentation">
      <div className="presentation-bg" />
      <div className="presentation-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div
        ref={toolbarRef}
        className={`presentation-toolbar${dragging ? " is-dragging" : ""}`}
        style={toolbarStyle}
        onPointerDown={onToolbarPointerDown}
      >
        <div className="presentation-toolbar__url">lingvoterritory.netlify.app</div>
        <div className="presentation-toolbar__actions" aria-label="Presentation controls">
          <button onClick={goPrev} disabled={currentSlideIndex === 0} aria-label="Previous slide">‹</button>
          <button onClick={goNext} disabled={currentSlideIndex === presentationSlides.length - 1} aria-label="Next slide">›</button>
          <button onClick={exitPresentation} aria-label="Exit presentation">退出</button>
        </div>
      </div>

      {slide.kind === "view_slide" ? (
        <div className="presentation-view-layout">
          <section className="presentation-view-head">
            <p className="presentation-kicker">{slideText(slide.section, lang)} · {String(currentSlideIndex + 1).padStart(2, "0")}</p>
            <h1>{slideText(slide.title, lang)}</h1>
            <p className="presentation-view-question">{slideText(slide.question, lang)}</p>
          </section>
          <main className="presentation-stage">
            <div className="presentation-stage__canvas">
              {renderView()}
              {slide.kind === "view_slide" && (
                <>
                  <GuideModal guideId={resolveGuideId(currentView, tabView, subMode, treeMode)} />
                  {guideOpen && (
                    <ErrorBoundary>
                      <GuideDrawer guideId={resolveGuideId(currentView, tabView, subMode, treeMode)} />
                    </ErrorBoundary>
                  )}
                </>
              )}
              {selectedDialect && <button className="presentation-drawer-scrim" onClick={() => selectDialect(null)} aria-label="Close detail drawer" />}
              <ErrorBoundary>
                <InfoDrawer />
              </ErrorBoundary>
            </div>
          </main>
          {renderViewRail()}
        </div>
      ) : isCoverSlide ? (
        <main className="presentation-cover-layout">
          <div className="presentation-cover-card">
            <h1 className="presentation-cover-title">{slideText(slide.title, lang)}</h1>
            <p className="presentation-cover-subtitle">{slideText(slide.claim, lang)}</p>
            {slide.metrics && (
              <div className="presentation-cover-meta">
                {slide.metrics.map((metric) => (
                  <div key={`${metric.label}-${metric.value}`}>
                    <span>{slideText(metric.label, lang)}</span>
                    <strong>{slideText(metric.value, lang)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      ) : isStructuredTextSlide ? (
        renderStructuredTextSlide()
      ) : (
        <main className="presentation-text-layout">
          <div className="presentation-statement">
            {slide.claim ? <p className="presentation-claim">{slideText(slide.claim, lang)}</p> : null}
            {slide.metrics && (
              <div className="presentation-metrics presentation-metrics--hero">
                {slide.metrics.map((metric) => (
                  <div key={`${metric.label}-${metric.value}`}>
                    <span>{slideText(metric.label, lang)}</span>
                    <strong>{slideText(metric.value, lang)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
          <aside className="presentation-rail presentation-rail--text">
            {renderDetailBlocks()}
          </aside>
        </main>
      )}

      <footer className="presentation-footer">
        <span>{currentSlideIndex + 1} / {presentationSlides.length}</span>
      </footer>
      {slide.kind !== "view_slide" && selectedDialect && <button className="presentation-drawer-scrim" onClick={() => selectDialect(null)} aria-label="Close detail drawer" />}
      {slide.kind !== "view_slide" && (
        <ErrorBoundary>
          <InfoDrawer />
        </ErrorBoundary>
      )}
    </section>
  );
}
