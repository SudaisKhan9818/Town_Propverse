'use client';

// Navbar — transparent over the hero, eases (0.3s) into blurred bone once
// the page scrolls.

import { useEffect, useState } from 'react';
import { Menu, MoveUpRight, X } from 'lucide-react';
import { COLORS, FONTS } from '@/src/shared/theme/tokens';
import { fontVariables } from './fonts';

const NAV_ITEMS: Array<[string, string]> = [
  ['Towns', '#towns'],
  ['Intelligence', '#intelligence'],
  ['About', '#about'],
  ['Contact', '#contact'],
];

export default function Navbar({ onExplore }: { onExplore: () => void }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const solid = scrolled || open;

  return (
    <header
      className={`${fontVariables} fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300`}
      style={{
        background: solid ? 'rgba(243,238,230,0.82)' : 'transparent',
        borderColor: solid ? COLORS.border : 'transparent',
        backdropFilter: solid ? 'blur(14px) saturate(1.1)' : 'none',
        WebkitBackdropFilter: solid ? 'blur(14px) saturate(1.1)' : 'none',
      }}
    >
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-[5vw]">
        <a href="#top" aria-label="PropVerse home" className="text-[1.45rem] italic tracking-[-0.03em]" style={{ fontFamily: FONTS.serif, color: COLORS.ink }}>
          PropVerse
        </a>
        <nav aria-label="Primary navigation" className="ml-auto mr-8 hidden gap-8 md:flex">
          {NAV_ITEMS.map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="text-[0.7rem] uppercase tracking-[0.12em] transition-colors hover:opacity-100"
              style={{ fontFamily: FONTS.mono, color: COLORS.inkSoft, opacity: 0.75, textShadow: 'none' }}
            >
              {label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={onExplore}
          className="hidden items-center gap-2 rounded-full px-4 py-2.5 transition-[filter,transform] hover:brightness-110 active:scale-[0.97] md:inline-flex"
          style={{ background: COLORS.terracotta, color: COLORS.paper, fontSize: '0.72rem', letterSpacing: '0.06em', fontFamily: FONTS.sans }}
        >
          Visit the Town <MoveUpRight size={14} />
        </button>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          style={{ color: COLORS.ink }}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <nav aria-label="Mobile navigation" className="flex flex-col gap-5 border-t px-4 pb-8 pt-6 md:hidden" style={{ borderColor: COLORS.border }}>
          {NAV_ITEMS.map(([label, href]) => (
            <a key={label} href={href} onClick={() => setOpen(false)} className="text-[2rem]" style={{ fontFamily: FONTS.serif, color: COLORS.ink }}>
              {label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => { setOpen(false); onExplore(); }}
            className="mt-2 inline-flex w-max items-center gap-2 rounded-full px-5 py-3"
            style={{ background: COLORS.terracotta, color: COLORS.paper, fontSize: '0.75rem', fontFamily: FONTS.sans }}
          >
            Explore the 3D Town <MoveUpRight size={15} />
          </button>
        </nav>
      )}
    </header>
  );
}
