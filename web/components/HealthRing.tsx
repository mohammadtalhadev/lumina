'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';

const RING = 15.9155; // circumference for r=... path used below (100 units)

/**
 * Animated health ring (0–100). Color follows the score; the stroke
 * animates on mount unless the user prefers reduced motion.
 */
export default function HealthRing({
  score,
  size = 64,
  className,
}: {
  score: number;
  size?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const color =
    clamped >= 85 ? '#10b981' : clamped >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div
      className={cn('relative grid place-items-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Health score ${clamped} out of 100`}
    >
      <svg viewBox="0 0 42 42" width={size} height={size} aria-hidden>
        <circle cx="21" cy="21" r={RING} fill="none" strokeWidth="4.5" className="stroke-ink/10" />
        <motion.circle
          cx="21"
          cy="21"
          r={RING}
          fill="none"
          stroke={color}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={`${clamped} ${100 - clamped}`}
          transform="rotate(-90 21 21)"
          initial={reduce ? false : { strokeDasharray: `0 100` }}
          animate={{ strokeDasharray: `${clamped} ${100 - clamped}` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute font-display text-sm font-bold tabular-nums" style={{ color }}>
        {clamped}
      </span>
    </div>
  );
}
