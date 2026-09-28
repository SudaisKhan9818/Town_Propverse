'use client';

// ═══════════════════════════════════════════════════════════════════
// PlotDetailsCard — reads the town store ONLY (selectedUnit).
// Desktop: 380px right panel. Mobile (<768px): bottom sheet, drag down
// to close. Data arrives through getUnitData(id) (data/units.ts), so
// when the RAG API replaces town-data.json this component is untouched.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { X, Phone, CalendarCheck, Eye } from 'lucide-react';
import { COLORS, FONTS } from '@/src/shared/theme/tokens';
import { isPlot, type CivicData, type Contact, type PlotData, type TimelineEvent, type UnitData } from '@/src/shared/types/town';
import { useTownStore } from '../store/town-store';
import { CIVIC_LABEL, SIZE_LABEL, STATUS, formatDate, formatPkr, initials, maskPhone } from './format';

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 32 } },
};

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile;
}

function Section({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <motion.div variants={item} className={className}>{children}</motion.div>;
}

function HeroImage({ src, alt }: { src?: string; alt: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(src ? 'loading' : 'error');
  useEffect(() => setState(src ? 'loading' : 'error'), [src]);
  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-xl" style={{ background: COLORS.cream }}>
      {state === 'loading' && <div className="pv-shimmer absolute inset-0" />}
      {src && state !== 'error' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
          className="h-full w-full object-cover transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.02]"
          style={{ opacity: state === 'ready' ? 1 : 0 }}
        />
      )}
      {state === 'error' && (
        <div className="absolute inset-0 grid place-items-center text-xs" style={{ color: COLORS.muted, fontFamily: FONTS.mono }}>
          Preview coming soon
        </div>
      )}
    </div>
  );
}

function Facts({ rows }: { rows: Array<[string, string | undefined]> }) {
  const visible = rows.filter(([, v]) => v);
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border" style={{ borderColor: COLORS.border }}>
      {visible.map(([label, value], i) => (
        <div
          key={label}
          className="px-4 py-3"
          style={{
            borderTop: i > 1 ? `1px solid ${COLORS.border}` : undefined,
            borderLeft: i % 2 === 1 ? `1px solid ${COLORS.border}` : undefined,
          }}
        >
          <dt className="text-[0.66rem] uppercase tracking-[0.12em]" style={{ color: COLORS.muted, fontFamily: FONTS.mono }}>{label}</dt>
          <dd className="mt-1 text-[0.9rem] font-medium leading-snug" style={{ color: COLORS.ink }}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PriceBlock({ plot }: { plot: PlotData }) {
  const total = plot.price?.totalPkr;
  const paid = plot.price?.paidPkr ?? 0;
  if (!total) return null;
  const pct = Math.min(100, Math.round((paid / total) * 100));
  return (
    <div>
      <p className="text-[0.66rem] uppercase tracking-[0.12em]" style={{ color: COLORS.muted, fontFamily: FONTS.mono }}>
        {plot.status === 'free' ? 'Asking price' : 'Total price'}
      </p>
      <p className="mt-1 text-[2.1rem] leading-none" style={{ fontFamily: FONTS.serif, color: COLORS.ink, letterSpacing: '-0.02em' }}>
        {formatPkr(total)}
      </p>
      {plot.status !== 'free' && (
        <>
          <div className="mt-4 flex justify-between text-[0.78rem]" style={{ color: COLORS.inkSoft }}>
            <span>Paid <strong className="font-semibold">{formatPkr(paid)}</strong></span>
            <span>Remaining <strong className="font-semibold">{formatPkr(total - paid)}</strong></span>
          </div>
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full" style={{ background: COLORS.border }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: COLORS.terracotta }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            />
          </div>
          <p className="mt-1.5 text-[0.7rem]" style={{ color: COLORS.muted }}>{pct}% of the price paid</p>
        </>
      )}
    </div>
  );
}

function PersonBlock({ title, person, unitId }: { title: string; person?: Contact; unitId: string }) {
  const [revealed, setRevealed] = useState(false);
  const [visitRequested, setVisitRequested] = useState(false);
  useEffect(() => { setRevealed(false); setVisitRequested(false); }, [unitId]);
  const phone = person?.phone;
  return (
    <div>
      <p className="text-[0.66rem] uppercase tracking-[0.12em]" style={{ color: COLORS.muted, fontFamily: FONTS.mono }}>{title}</p>
      <div className="mt-2 flex items-center gap-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold uppercase"
          style={{ background: COLORS.cream, color: COLORS.terracotta, border: `1px solid ${COLORS.border}` }}
          aria-hidden
        >
          {initials(person?.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[0.95rem] font-medium" style={{ color: COLORS.ink }}>{person?.name ?? 'Not listed yet'}</p>
          {phone && (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="mt-0.5 inline-flex items-center gap-1.5 tabular-nums"
              style={{ color: COLORS.inkSoft, fontFamily: FONTS.mono, fontSize: '0.8rem' }}
              aria-label={revealed ? `Phone ${phone}` : 'Tap to reveal phone number'}
            >
              {revealed ? phone : maskPhone(phone)}
              {!revealed && <Eye size={13} style={{ color: COLORS.terracotta }} />}
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a
          href={phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : undefined}
          onClick={() => setRevealed(true)}
          className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 font-medium transition-[filter,transform] hover:brightness-110 active:scale-[0.98]"
          style={{ background: COLORS.terracotta, color: COLORS.paper, fontSize: '0.8rem' }}
        >
          <Phone size={14} /> Contact
        </a>
        <button
          type="button"
          onClick={() => setVisitRequested(true)}
          className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 font-medium transition-colors"
          style={{
            fontSize: '0.8rem',
            fontFamily: FONTS.sans,
            borderColor: COLORS.terracotta,
            color: visitRequested ? COLORS.paper : COLORS.terracotta,
            background: visitRequested ? COLORS.statusFree : 'transparent',
          }}
        >
          <CalendarCheck size={14} /> {visitRequested ? 'Visit requested' : 'Schedule Visit'}
        </button>
      </div>
      {visitRequested && (
        <p className="mt-2 text-[0.74rem]" style={{ color: COLORS.muted }}>
          Thanks — our team will call to confirm a time.
        </p>
      )}
    </div>
  );
}

function Timeline({ events }: { events?: TimelineEvent[] }) {
  if (!events?.length) return null;
  return (
    <div>
      <p className="text-[0.66rem] uppercase tracking-[0.12em]" style={{ color: COLORS.muted, fontFamily: FONTS.mono }}>Timeline</p>
      <ol className="mt-3 flex items-start">
        {events.map((e, i) => (
          <li key={`${e.label}-${i}`} className="relative flex-1 pr-2">
            <div className="flex items-center">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: i === events.length - 1 ? COLORS.terracotta : COLORS.clayTrim }} />
              {i < events.length - 1 && <span className="ml-1 h-px flex-1" style={{ background: COLORS.border }} />}
            </div>
            <p className="mt-2 text-[0.78rem] font-medium" style={{ color: COLORS.ink }}>{e.label}</p>
            <p className="text-[0.72rem]" style={{ color: COLORS.muted }}>{formatDate(e.date)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

const Divider = () => <div className="h-px w-full" style={{ background: COLORS.border }} />;

function PlotBody({ plot }: { plot: PlotData }) {
  return (
    <>
      <Section>
        <Facts rows={[
          ['Plot no.', plot.id],
          ['Status', plot.status ? STATUS[plot.status].label : undefined],
          ['Size', plot.size ? SIZE_LABEL[plot.size] : undefined],
          ['Bedrooms', plot.bedrooms ? `${plot.bedrooms} bedrooms` : undefined],
          ['Facing', plot.facing],
          ['Road', plot.road],
          ['Possession', plot.possession],
          ['Type', plot.houseType],
        ]}
        />
      </Section>
      <Section><PriceBlock plot={plot} /></Section>
      <Section><Divider /></Section>
      <Section>
        <PersonBlock title={plot.status === 'free' ? 'Sales contact' : 'Owner'} person={plot.owner} unitId={plot.id} />
      </Section>
      <Section><Timeline events={plot.timeline} /></Section>
    </>
  );
}

function CivicBody({ civic }: { civic: CivicData }) {
  return (
    <>
      {civic.description && (
        <Section>
          <p className="text-[0.9rem] leading-relaxed" style={{ color: COLORS.inkSoft }}>{civic.description}</p>
        </Section>
      )}
      <Section>
        <Facts rows={[
          ['Department', civic.department],
          ['Incharge', civic.incharge?.name],
          ['Timings', civic.timings],
          ['Address', civic.address],
        ]}
        />
      </Section>
      <Section><Divider /></Section>
      <Section><PersonBlock title="Incharge" person={civic.incharge} unitId={civic.id} /></Section>
    </>
  );
}

function Header({ unit, onClose }: { unit: UnitData; onClose: () => void }) {
  const status = isPlot(unit) && unit.status ? STATUS[unit.status] : null;
  const kind = !isPlot(unit) && unit.kind ? CIVIC_LABEL[unit.kind] : null;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[0.78rem] tracking-[0.08em]" style={{ color: COLORS.inkSoft, fontFamily: FONTS.mono }}>{unit.id.toUpperCase()}</span>
          {status && (
            <span className="rounded-full px-2.5 py-0.5 text-[0.68rem] font-medium" style={{ background: status.color, color: COLORS.paper }}>
              {status.label}
            </span>
          )}
          {kind && (
            <span className="rounded-full border px-2.5 py-0.5 text-[0.68rem] font-medium" style={{ borderColor: COLORS.clayTrim, color: COLORS.terracotta }}>
              {kind}
            </span>
          )}
        </div>
        <h2 className="mt-1.5 truncate text-[1.5rem] leading-tight" style={{ fontFamily: FONTS.serif, color: COLORS.ink }}>
          {unit.name ?? unit.id}
        </h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close details"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors hover:bg-[#F2EADC]"
        style={{ borderColor: COLORS.border, color: COLORS.inkSoft }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default function PlotDetailsCard() {
  const unit = useTownStore((s) => s.selectedUnit);
  const deselect = useTownStore((s) => s.deselect);
  const mobile = useIsMobile();

  const panelStyle = {
    background: COLORS.paper,
    borderColor: COLORS.border,
    fontFamily: FONTS.sans,
  };

  return (
    <AnimatePresence>
      {unit && (
        <motion.aside
          key={mobile ? 'sheet' : 'panel'}
          role="dialog"
          aria-label={`${unit.name ?? unit.id} details`}
          className={mobile
            ? 'fixed inset-x-0 bottom-0 z-[210] max-h-[78vh] overflow-y-auto rounded-t-2xl border-t shadow-2xl'
            : 'fixed right-4 top-4 z-[210] max-h-[calc(100dvh-2rem)] w-[380px] overflow-y-auto rounded-2xl border shadow-2xl'}
          style={panelStyle}
          initial={mobile ? { y: '100%' } : { x: 420, opacity: 0.6 }}
          animate={mobile ? { y: 0 } : { x: 0, opacity: 1 }}
          exit={mobile ? { y: '100%' } : { x: 420, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          drag={mobile ? 'y' : false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.7 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 120 || info.velocity.y > 600) deselect();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {mobile && <div className="mx-auto mt-2.5 h-1 w-10 rounded-full" style={{ background: COLORS.border }} aria-hidden />}
          <motion.div key={unit.id} className="flex flex-col gap-5 p-5" variants={list} initial="hidden" animate="show">
            <Section><Header unit={unit} onClose={deselect} /></Section>
            <Section><HeroImage src={unit.imageUrl} alt={`${unit.name ?? unit.id} in PropVerse Town 01`} /></Section>
            {isPlot(unit) ? <PlotBody plot={unit} /> : <CivicBody civic={unit} />}
          </motion.div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
