'use client';

// ═══════════════════════════════════════════════════════════════════
// AgentWidget — floating Town Agent chat (bottom-right, ChatGPT-style).
// UI only: messages flow through agent-store's handler (see there).
// Unit / light ids in replies (P-12, civic-hospital, masjid-2 …) become
// chips that fly the 3D town to that unit via selectTownUnit().
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Flame, Lightbulb, MessageCircle, Thermometer, X, Zap } from 'lucide-react';
import { COLORS, FONTS } from '@/src/shared/theme/tokens';
import { selectTownUnit, useSelectedTownUnit } from '@/src/features/town';
import { setAgentHandler, useAgentStore, type ChatMessage } from '../store/agent-store';

const SUGGESTIONS = [
  { label: 'Ask about GRID', prompt: 'What is the WAPDA grid station status right now?', icon: Zap },
  { label: 'Ask about Light', prompt: 'How much energy are the streetlights using today?', icon: Lightbulb },
  { label: 'Ask about Fire', prompt: 'Are there any fire alerts in town?', icon: Flame },
] as const;

const UNIT_PATTERN = /\b(P-\d{1,3}|civic-(?:school|hospital|police|fire|wapda|park)|market-\d|masjid-\d)\b/g;

function Badge({ on, label, offLabel }: { on: boolean; label: string; offLabel?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5"
      style={{ borderColor: COLORS.border, color: COLORS.inkSoft, fontFamily: FONTS.mono, fontSize: '0.62rem', letterSpacing: '0.06em' }}
    >
      <span className="relative h-1.5 w-1.5">
        {on && <span className="absolute inset-0 animate-ping rounded-full" style={{ background: COLORS.statusFree, opacity: 0.5 }} />}
        <span className="absolute inset-0 rounded-full" style={{ background: on ? COLORS.statusFree : COLORS.muted }} />
      </span>
      {on ? label : offLabel ?? label}
    </span>
  );
}

function Reading({ icon, label, value, alert = false }: { icon: ReactNode; label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 py-2" style={{ borderColor: COLORS.border, background: alert ? '#F6E3DA' : COLORS.paper }}>
      <span style={{ color: alert ? COLORS.clay : COLORS.terracotta }}>{icon}</span>
      <span className="min-w-0">
        <span className="block uppercase" style={{ fontFamily: FONTS.mono, fontSize: '0.56rem', letterSpacing: '0.1em', color: COLORS.muted }}>{label}</span>
        <span className="block truncate font-medium" style={{ fontSize: '0.8rem', color: COLORS.ink }}>{value}</span>
      </span>
    </div>
  );
}

/** Message text with unit ids turned into "show in town" chips. */
function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(UNIT_PATTERN)) {
    const id = match[0];
    const at = match.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(
      <button
        key={`${id}-${at}`}
        type="button"
        onClick={() => { void selectTownUnit(id); }}
        className="mx-0.5 inline-flex items-center rounded-md px-1.5 align-baseline underline-offset-2 hover:underline"
        style={{ background: '#F2E4DC', color: COLORS.terracotta, fontFamily: FONTS.mono, fontSize: '0.78em' }}
        title="Show in the 3D town"
      >
        {id}
      </button>,
    );
    last = at + id.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === 'system') {
    return <p className="mx-auto max-w-[90%] text-center" style={{ fontSize: '0.72rem', color: COLORS.muted }}>{m.text}</p>;
  }
  const mine = m.role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 leading-relaxed"
        style={{
          fontSize: '0.84rem',
          background: mine ? COLORS.terracotta : COLORS.cream,
          color: mine ? COLORS.paper : COLORS.ink,
          borderBottomRightRadius: mine ? 6 : undefined,
          borderBottomLeftRadius: mine ? undefined : 6,
        }}
      >
        {mine ? m.text : <RichText text={m.text} />}
      </div>
    </div>
  );
}

export default function AgentWidget() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const messages = useAgentStore((s) => s.messages);
  const pending = useAgentStore((s) => s.pending);
  const online = useAgentStore((s) => !!s.handler);
  const monitoring = useAgentStore((s) => s.monitoring);
  const twin = useAgentStore((s) => s.twin);
  const send = useAgentStore((s) => s.send);
  const cardOpen = !!useSelectedTownUnit();
  const [desktop, setDesktop] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setAgentHandler(async (message, history) => {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: message, history }),
      });
      const body = await response.json() as {
        answer?: string;
        error?: string;
        action?: { type?: string; target?: string | null };
      };
      if (!response.ok) throw new Error(body.error ?? 'The Town Agent request failed.');
      if (body.action?.type === 'FOCUS' && body.action.target) {
        await selectTownUnit(body.action.target);
      }
      return body.answer ?? 'I could not generate an answer.';
    });
    return () => setAgentHandler(null);
  }, []);

  useEffect(() => {
    const q = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktop(q.matches);
    update();
    q.addEventListener('change', update);
    return () => q.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  useEffect(() => {
    document.documentElement.dataset.townAgentOpen = String(open);
    window.dispatchEvent(new CustomEvent('propverse-agent-toggle', { detail: { open } }));
  }, [open]);

  useEffect(() => {
    const closeFromTownLayout = () => setOpen(false);
    window.addEventListener('propverse-agent-close', closeFromTownLayout);
    return () => window.removeEventListener('propverse-agent-close', closeFromTownLayout);
  }, []);

  // QA hook (dev, or ?townDebug in any build): window.__propverseAgent.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && !window.location.search.includes('townDebug')) return;
    (window as unknown as { __propverseAgent?: typeof useAgentStore }).__propverseAgent = useAgentStore;
    return () => { delete (window as unknown as { __propverseAgent?: typeof useAgentStore }).__propverseAgent; };
  }, []);

  const submit = (text = draft) => {
    if (!text.trim()) return;
    void send(text);
    setDraft('');
  };

  if (!desktop && cardOpen) return null;

  return (
    <div id="ask-town-agent-container" className="pointer-events-auto fixed bottom-4 left-12 z-[250] flex flex-col items-start gap-3 transition-all duration-300 md:bottom-6 md:left-[clamp(48px,6vw,72px)]" style={{ fontFamily: FONTS.sans }}>
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="Town Agent chat"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="flex h-[min(560px,calc(100dvh-7rem))] w-[min(380px,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl"
            style={{ background: COLORS.paper, borderColor: COLORS.border }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3 border-b px-4 pb-3 pt-4" style={{ borderColor: COLORS.border }}>
              <div>
                <p className="uppercase" style={{ fontFamily: FONTS.mono, fontSize: '0.6rem', letterSpacing: '0.16em', color: COLORS.terracotta }}>PropVerse Town</p>
                <h2 className="mt-0.5" style={{ fontFamily: FONTS.serif, fontSize: '1.3rem', color: COLORS.ink }}>Ask Town Agent</h2>
                <div className="mt-2 flex gap-1.5">
                  <Badge on={online} label="Online" offLabel="Offline" />
                  <Badge on={monitoring} label="Monitoring" offLabel="Monitoring off" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border"
                style={{ borderColor: COLORS.border, color: COLORS.inkSoft }}
              >
                <X size={16} />
              </button>
            </header>

            <div className="flex gap-1.5 px-3 pt-3">
              <Reading icon={<Thermometer size={15} />} label="Grid temp" value={twin.gridTemp === null ? '—' : `${twin.gridTemp.toFixed(1)} °C`} />
              <Reading icon={<Lightbulb size={15} />} label="Light energy" value={twin.lightEnergy === null ? '—' : `${twin.lightEnergy.toFixed(1)} kWh`} />
              <Reading
                icon={<Flame size={15} />}
                label="Fire"
                value={twin.fireAlert === null ? '—' : twin.fireAlert ? 'ALERT' : 'Clear'}
                alert={twin.fireAlert === true}
              />
            </div>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              {messages.length === 0 && (
                <div className="pt-2">
                  <p style={{ fontSize: '0.86rem', color: COLORS.inkSoft }}>
                    Ask about houses, owners, streetlights, utilities, or anything in PropVerse Town.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SUGGESTIONS.map(({ label, prompt, icon: Icon }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => submit(prompt)}
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors hover:bg-[#F2EADC]"
                        style={{ borderColor: COLORS.clayTrim, color: COLORS.terracotta, fontSize: '0.74rem', fontFamily: FONTS.sans }}
                      >
                        <Icon size={13} /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => <Bubble key={m.id} m={m} />)}
              {pending && (
                <div className="flex gap-1 px-1" aria-label="Agent is typing">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: COLORS.clayTrim, animationDelay: `${i * 120}ms` }} />
                  ))}
                </div>
              )}
            </div>

            <form
              className="flex items-end gap-2 border-t p-3"
              style={{ borderColor: COLORS.border }}
              onSubmit={(e) => { e.preventDefault(); submit(); }}
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
                }}
                placeholder="Ask Town Agent..."
                aria-label="Message the Town Agent"
                className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border px-3 py-2.5 outline-none focus:ring-2"
                style={{ borderColor: COLORS.border, background: '#FFFFFF', color: COLORS.ink, fontSize: '0.86rem', fontFamily: FONTS.sans }}
              />
              <button
                type="submit"
                disabled={!draft.trim() || pending}
                aria-label="Send"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-opacity disabled:opacity-40"
                style={{ background: COLORS.terracotta, color: COLORS.paper }}
              >
                <ArrowUp size={17} />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Close Town Agent' : 'Open Town Agent'}
        className="inline-flex items-center gap-2 rounded-full px-4 py-3 shadow-xl transition-transform hover:-translate-y-0.5"
        style={{ background: open ? COLORS.ink : COLORS.terracotta, color: COLORS.paper, fontSize: '0.8rem', fontFamily: FONTS.sans }}
      >
        {open ? <X size={16} /> : <MessageCircle size={16} />}
        {open ? 'Close' : 'Ask the Town'}
        {!online && !open && <span className="h-1.5 w-1.5 rounded-full" style={{ background: COLORS.sand }} aria-hidden />}
      </button>
    </div>
  );
}
