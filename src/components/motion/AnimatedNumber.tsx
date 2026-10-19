'use client';

import React, { useEffect, useRef, useState } from 'react';
import { animate } from 'motion';
import { prefersReducedMotion } from './reducedMotion';

interface Props {
  /** Integer minor units (or any integer). Intermediate frames are rounded, so no float is ever shown. */
  value: number;
  format: (n: number) => string;
  className?: string;
  durationSec?: number;
}

/** Counts from the previous value to the new one; renders the final value directly under reduced motion. */
export function AnimatedNumber({ value, format, className, durationSec = 0.9 }: Props) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const first = useRef(true);

  useEffect(() => {
    // First render counts up from zero once; later changes animate from the last value.
    const start = first.current ? 0 : from.current;
    first.current = false;
    if (prefersReducedMotion() || start === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const controls = animate(start, value, {
      duration: durationSec,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(Math.round(v)),
      onComplete: () => setShown(value),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, durationSec]);

  return (
    <span className={className} aria-label={format(value)}>
      <span aria-hidden>{format(shown)}</span>
    </span>
  );
}
