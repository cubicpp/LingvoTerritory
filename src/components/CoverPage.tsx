import { useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function CoverPage() {
  const bgRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wheelAccum = useRef(0);
  const setCoverPassed = useAppStore((s) => s.setCoverPassed);
  const coverPassed = useAppStore((s) => s.coverPassed);
  const theme = useAppStore((s) => s.theme);

  const exit = useCallback(() => {
    setCoverPassed();
  }, [setCoverPassed]);

  useEffect(() => {
    if (coverPassed) return;

    // Accumulate wheel delta to simulate scroll distance for parallax + exit
    function onWheel(e: Event) {
      const we = e as WheelEvent;
      e.preventDefault();
      const vh = window.innerHeight;
      wheelAccum.current += we.deltaY;
      // Clamp progress between 0 and 1
      const progress = Math.min(Math.max(wheelAccum.current / vh, 0), 1);

      if (progress >= 0.7) {
        exit();
        return;
      }

      if (contentRef.current) {
        contentRef.current.style.opacity = String(1 - progress * 1.2);
        contentRef.current.style.transform = `translateY(${-progress * 60}px)`;
      }
    }

    const coverEl = document.querySelector('.cover') as HTMLElement | null;
    if (coverEl) {
      coverEl.addEventListener('wheel', onWheel, { passive: false });
    }
    return () => {
      coverEl?.removeEventListener('wheel', onWheel);
    };
  }, [coverPassed, exit]);

  if (coverPassed) return null;

  return (
    <div className="cover" data-theme={theme} onClick={exit}>
      <div className="cover__bg" ref={bgRef} />
      <div className="cover__overlay" />
      <div className="cover__content" ref={contentRef}>
        <div className="cover__title">語疆</div>
        <div className="cover__subtitle">Lingvo Territory: Visualization of Chinese Dialects and Etymology of Chinese Characters</div>
      </div>

    </div>
  );
}
