'use client';

// TownHud — overlay chrome for the 3D town: title chip, walk / close
// buttons, focus exit, control hints and the walk crosshair.

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Footprints, X, Undo2 } from 'lucide-react';
import { COLORS, FONTS } from '@/src/shared/theme/tokens';
import { useTownStore } from '../store/town-store';

const glass = {
  background: 'rgba(255,252,247,0.82)',
  border: `1px solid ${COLORS.border}`,
  backdropFilter: 'blur(14px) saturate(1.2)',
  WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
  boxShadow: '0 10px 30px -12px rgba(52,44,34,0.35)',
} as const;

function HudButton({ onClick, children, primary = false, label }: {
  onClick: () => void; children: React.ReactNode; primary?: boolean; label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 font-medium tracking-[0.04em] transition-[transform,filter] hover:brightness-105 active:scale-[0.97]"
      style={{
        // globals.css sets `button { font: inherit }` unlayered, which beats
        // Tailwind's layered text-* utilities — size fonts inline instead.
        fontSize: '0.74rem',
        fontFamily: FONTS.sans,
        ...(primary
          ? { background: COLORS.terracotta, color: COLORS.paper, boxShadow: '0 10px 24px -10px rgba(169,92,67,0.7)' }
          : { ...glass, color: COLORS.ink }),
      }}
    >
      {children}
    </button>
  );
}

export default function TownHud({ onClose }: { onClose: () => void }) {
  const mode = useTownStore((s) => s.cameraMode);
  const walkLocked = useTownStore((s) => s.walkLocked);
  const cardOpen = useTownStore((s) => !!s.selectedUnit);
  const setCameraMode = useTownStore((s) => s.setCameraMode);
  const deselect = useTownStore((s) => s.deselect);
  const revealed = useTownStore((s) => s.readyStage >= 3);
  const [showHint, setShowHint] = useState(true);
  const [desktop, setDesktop] = useState(true);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!revealed) return;
    const t = window.setTimeout(() => setShowHint(false), 6500);
    return () => window.clearTimeout(t);
  }, [revealed]);

  const walking = mode === 'walk';

  return (
    <>
      <div
        className="pointer-events-none absolute left-4 top-4 z-[201] flex items-center gap-2 rounded-full px-4 py-2"
        style={{ ...glass, color: COLORS.ink }}
      >
        <span className="text-[0.95rem] italic" style={{ fontFamily: FONTS.serif }}>PropVerse</span>
        <span className="h-3 w-px" style={{ background: COLORS.border }} />
        <span className="text-[0.62rem] uppercase tracking-[0.16em]" style={{ fontFamily: FONTS.mono, color: COLORS.muted }}>Town 01</span>
      </div>

      <div
        className="absolute top-4 z-[201] flex items-center gap-2 transition-[right] duration-300"
        style={desktop ? { right: cardOpen && !walking ? 412 : 16 } : { right: 16, top: 64 }}
      >
        {mode === 'focus' && (
          <HudButton label="Exit focus view" onClick={() => setCameraMode('orbit')}>
            <Undo2 size={14} /> Exit focus
          </HudButton>
        )}
        <HudButton
          label={walking ? 'Exit walk mode' : 'Enter walk mode'}
          onClick={() => {
            deselect();
            setCameraMode(walking ? 'orbit' : 'walk');
          }}
        >
          <Footprints size={14} /> {walking ? 'Exit walk' : 'Walk'}
        </HudButton>
        <HudButton primary label="Close 3D view" onClick={onClose}>
          <X size={14} /> Close
        </HudButton>
      </div>

      <AnimatePresence>
        {(walking || (showHint && revealed && !cardOpen)) && (
          <motion.div
            key={walking ? 'walk' : 'orbit'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-none absolute bottom-5 left-1/2 z-[201] -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-2 text-[0.7rem] tracking-[0.06em]"
            style={{ ...glass, color: COLORS.inkSoft, fontFamily: FONTS.mono }}
            aria-live="polite"
          >
            {walking
              ? (walkLocked ? 'WASD move · Shift sprint · Mouse look · Esc exit' : 'Click the town to start walking')
              : 'Drag to orbit · Scroll to zoom · Click for details · Double-click to focus'}
          </motion.div>
        )}
      </AnimatePresence>

      {walkLocked && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-[201] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: COLORS.paper, boxShadow: `0 0 0 1.5px ${COLORS.inkSoft}` }}
        />
      )}
    </>
  );
}
