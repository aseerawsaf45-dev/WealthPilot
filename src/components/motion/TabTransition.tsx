'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

/**
 * Directional page transition between tabs (slides the way the nav moved).
 * Only opacity and x are animated: both end at identity, so motion writes `transform: none` and the
 * wrapper never becomes the containing block of fixed modals (a leftover transform or filter would).
 */
export function TabTransition({ tabKey, index, children }: { tabKey: string; index: number; children: React.ReactNode }) {
  // Direction from the previous index, derived during render (no ref reads, no effect).
  const [state, setState] = useState({ index, dir: 1 });
  if (state.index !== index) setState({ index, dir: index > state.index ? 1 : -1 });
  const dir = state.index !== index ? (index > state.index ? 1 : -1) : state.dir;

  return (
    <AnimatePresence mode="wait" initial={false} custom={dir}>
      <motion.div
        key={tabKey}
        custom={dir}
        variants={{
          enter: (d: number) => ({ opacity: 0, x: 28 * d }),
          center: { opacity: 1, x: 0 },
          exit: (d: number) => ({ opacity: 0, x: -18 * d }),
        }}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ x: { type: 'spring', stiffness: 420, damping: 38, mass: 0.7 }, opacity: { duration: 0.18 } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
