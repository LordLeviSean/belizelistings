import { useEffect, useRef, useState } from "react";

/**
 * Smoothly animates a displayed integer toward `target` (operational stat cards).
 */
export function useCountUp(target, durationMs = 480) {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(display);
  displayRef.current = display;

  useEffect(() => {
    const startVal = displayRef.current;
    if (startVal === target) return undefined;
    let startTime = null;
    let raf = 0;
    const step = (time) => {
      if (startTime == null) startTime = time;
      const p = Math.min(1, (time - startTime) / durationMs);
      const eased = 1 - (1 - p) ** 2;
      setDisplay(Math.round(startVal + (target - startVal) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return display;
}
