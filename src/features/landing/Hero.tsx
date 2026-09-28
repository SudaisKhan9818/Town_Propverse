'use client';

// ═══════════════════════════════════════════════════════════════════
// Hero — eyebrow → two-line serif headline → full-bleed (88vw) golden-hour
// capture of Town 01 with scroll parallax → one-line sub-copy + CTAs.
// GSAP masked-rise entrance finishes in ~1.3s; prefers-reduced-motion
// shows everything instantly and disables parallax.
// ═══════════════════════════════════════════════════════════════════

import { useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight, Play } from 'lucide-react';
import { COLORS, FONTS, TYPE_SCALE } from '@/src/shared/theme/tokens';
import { fontVariables } from './fonts';
import FilmModal, { FILM_POSTER } from './FilmModal';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const HERO_IMAGE = FILM_POSTER;
const HERO_IMAGE_PORTRAIT = '/images/town/hero-aerial-portrait.jpg';

export default function Hero({ onExplore }: { onExplore: () => void }) {
  const root = useRef<HTMLElement>(null);
  const [filmOpen, setFilmOpen] = useState(false);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
      tl.from('[data-hero="eyebrow"]', { yPercent: 110, duration: 0.6 })
        .from('[data-hero="line"]', { yPercent: 112, duration: 0.85, stagger: 0.12 }, 0.08)
        .from('[data-hero="visual"]', { clipPath: 'inset(14% 6% 0% 6% round 28px)', y: 40, duration: 1.0, ease: 'power3.out' }, 0.3)
        .from('[data-hero="under"] > *', { y: 18, opacity: 0, duration: 0.6, stagger: 0.08 }, 0.7);

      gsap.fromTo('[data-hero="image"]', { yPercent: -6, scale: 1.12 }, {
        yPercent: 6,
        scale: 1.04,
        ease: 'none',
        scrollTrigger: { trigger: '[data-hero="visual"]', start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <section ref={root} id="top" className={`${fontVariables} relative overflow-hidden pb-14 pt-[7.5rem] sm:pb-20 sm:pt-[8.5rem]`} style={{ background: '#F3EEE6' }}>
      <div className="px-4 text-center sm:px-[5vw]">
        <div className="overflow-hidden">
          <p data-hero="eyebrow" className="text-[0.68rem] uppercase tracking-[0.22em]" style={{ fontFamily: FONTS.mono, color: COLORS.terracotta }}>
            3D Real Estate Intelligence · Town 01
          </p>
        </div>
        <h1
          className="mx-auto mt-5 max-w-[14ch] font-normal leading-[0.92] tracking-[-0.045em]"
          style={{ fontFamily: FONTS.serif, color: COLORS.ink, fontSize: TYPE_SCALE.display }}
        >
          <span className="block overflow-hidden pb-[0.08em]"><span data-hero="line" className="block">See the town</span></span>
          <span className="block overflow-hidden pb-[0.12em]">
            <span data-hero="line" className="block italic" style={{ color: COLORS.terracotta }}>before it exists.</span>
          </span>
        </h1>
      </div>

      <figure
        data-hero="visual"
        className="relative mx-auto mt-10 aspect-[4/5] w-[calc(100vw-32px)] overflow-hidden rounded-2xl sm:mt-14 sm:aspect-[16/7] sm:w-[88vw]"
        style={{ background: COLORS.cream, clipPath: 'inset(0% 0% 0% 0% round 16px)' }}
      >
        <picture>
          <source media="(max-width: 639px)" srcSet={HERO_IMAGE_PORTRAIT} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-hero="image"
            src={HERO_IMAGE}
            alt="Golden-hour aerial of PropVerse Town 01: two residential streets of bungalows, masjids and markets beside a civic block with school, hospital and park."
            className="absolute inset-0 h-full w-full object-cover will-change-transform"
            fetchPriority="high"
          />
        </picture>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(242,234,220,0) 55%, rgba(52,44,34,0.28) 100%)' }}
        />
        <figcaption
          className="absolute inset-x-4 bottom-4 flex flex-wrap items-center justify-between gap-2 text-[0.6rem] uppercase tracking-[0.16em] sm:inset-x-6 sm:bottom-5"
          style={{ fontFamily: FONTS.mono, color: COLORS.paper }}
        >
          <span>Live model · 25 plots · 10 civic blocks</span>
          <span className="hidden sm:inline">31.5°N 74.3°E</span>
        </figcaption>
      </figure>

      <div
        data-hero="under"
        className="mx-auto mt-8 flex w-[calc(100vw-32px)] flex-col items-start gap-6 sm:mt-10 sm:w-[88vw] sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="max-w-[34rem] text-[1rem] leading-relaxed" style={{ color: COLORS.inkSoft, fontFamily: FONTS.sans }}>
          Walk every street, open every plot and read the numbers — before you buy.
        </p>
        <div className="flex flex-wrap items-center gap-5">
          <button
            type="button"
            onClick={onExplore}
            className="inline-flex items-center gap-2.5 rounded-full px-6 py-3.5 transition-[filter,transform] hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0"
            style={{ background: COLORS.terracotta, color: COLORS.paper, fontSize: '0.8rem', letterSpacing: '0.04em', fontFamily: FONTS.sans, boxShadow: '0 16px 32px -16px rgba(169,92,67,0.8)' }}
          >
            Explore the 3D Town <ArrowRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => setFilmOpen(true)}
            className="inline-flex items-center gap-2 border-b pb-1 transition-opacity hover:opacity-70"
            style={{ borderColor: COLORS.ink, color: COLORS.ink, fontSize: '0.8rem', fontFamily: FONTS.sans, background: 'none' }}
          >
            <Play size={13} fill="currentColor" /> Watch the film
          </button>
        </div>
      </div>

      <FilmModal open={filmOpen} onClose={() => setFilmOpen(false)} />
    </section>
  );
}
