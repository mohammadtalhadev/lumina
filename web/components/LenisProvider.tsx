'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Lenis smooth scrolling for the whole app.
 * Honors prefers-reduced-motion: no smoothing when the user asked for less motion.
 */
export default function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
