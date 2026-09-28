'use client';

// FilmModal — plays the town flythrough (rendered from this very scene).

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { COLORS } from '@/src/shared/theme/tokens';

const FILM_SRC = '/film/propverse-town-01.mp4';
export const FILM_POSTER = '/images/town/hero-aerial.jpg';

export default function FilmModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] grid place-items-center p-4"
          style={{ background: 'rgba(28,26,23,0.72)', backdropFilter: 'blur(10px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="PropVerse Town 01 film"
        >
          <motion.div
            className="relative w-full max-w-[1100px] overflow-hidden rounded-2xl shadow-2xl"
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 8 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{ background: COLORS.ink }}
          >
            <video className="block aspect-video w-full" src={FILM_SRC} poster={FILM_POSTER} controls autoPlay muted playsInline />
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close film"
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full"
              style={{ background: 'rgba(255,252,247,0.9)', color: COLORS.ink }}
            >
              <X size={18} />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
