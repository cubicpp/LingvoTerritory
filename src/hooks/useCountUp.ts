import { useState, useEffect, useRef } from 'react';

export function useCountUp(target: number, duration = 800, start = true) {
  const [value, setValue] = useState(0);
  const raf = useRef(0);
  const startTime = useRef(0);

  useEffect(() => {
    if (!start || target === 0) { setValue(target); return; }

    function easeOutExpo(t: number) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

    function animate(timestamp: number) {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      setValue(Math.round(target * easeOutExpo(progress)));
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    }

    startTime.current = 0;
    setValue(0);
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, start]);

  return value;
}
