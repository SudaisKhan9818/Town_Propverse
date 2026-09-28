'use client';

// TownLoader — minimal bottom-left "Preparing town…" that tracks the
// progressive reveal and hides itself once houses are up.

import { AnimatePresence, motion } from 'framer-motion';
import { COLORS, FONTS } from '@/src/shared/theme/tokens';
import { useTownStore } from '../store/town-store';

const STEPS = ['Laying ground & roads', 'Raising civic blocks, markets & masjids', 'Building homes'];

export default function TownLoader() {
  const stage = useTownStore((s) => s.revealStage);
  const done = useTownStore((s) => s.readyStage >= 3);
  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6, transition: { delay: 0.6, duration: 0.4 } }}
          className="pointer-events-none absolute bottom-5 left-5 z-[202] flex items-center gap-3 rounded-full px-4 py-2"
          style={{ background: 'rgba(255,252,247,0.86)', border: `1px solid ${COLORS.border}`, backdropFilter: 'blur(12px)' }}
          role="status"
        >
          <span className="relative h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full" style={{ background: COLORS.clay, opacity: 0.5 }} />
            <span className="absolute inset-0 rounded-full" style={{ background: COLORS.terracotta }} />
          </span>
          <span className="text-[0.72rem]" style={{ color: COLORS.ink, fontFamily: FONTS.sans }}>Preparing town…</span>
          <span className="text-[0.62rem] uppercase tracking-[0.12em]" style={{ color: COLORS.muted, fontFamily: FONTS.mono }}>
            {STEPS[Math.max(0, Math.min(stage, STEPS.length) - 1)]}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
