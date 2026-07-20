import { useEffect, useRef, useState } from 'react';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Renders a number that rolls from its previous value to the next whenever `value` changes.
 *
 * The first render shows `value` outright (no roll); later changes tween via requestAnimationFrame,
 * animating from whatever is currently displayed so rapid updates chain smoothly. `tabular-nums` keeps
 * the digits from shifting width as they change.
 */
export function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  // The latest rendered number, so a change mid-roll starts from what the user actually sees.
  const displayRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (from === to) return;

    // Scale the duration a little with the distance, capped so large jumps stay snappy.
    const duration = Math.min(600, 150 + Math.abs(to - from) * 80);
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const current = Math.round(from + (to - from) * easeOutCubic(progress));
      displayRef.current = current;
      setDisplay(current);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value]);

  return <span className="tabular-nums">{display}</span>;
}
