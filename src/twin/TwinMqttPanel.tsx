'use client';

import { useState } from 'react';
import type { TwinLog } from './useTwinIoT';

export type TwinMqttPanelProps = {
  logs: TwinLog[];
  onSelectPole: (poleId: string) => void;
};

type LogFilter = 'ALL' | 'WARN' | 'CRITICAL';

function extractPoleFromLog(log: string) {
  return log.match(/P-\d+/)?.[0] ?? null;
}

export default function TwinMqttPanel({ logs, onSelectPole }: TwinMqttPanelProps) {
  const [logFilter, setLogFilter] = useState<LogFilter>('ALL');
  const [logsPaused, setLogsPaused] = useState(false);
  const [pausedLogs, setPausedLogs] = useState<TwinLog[]>([]);
  const feedLogs = logsPaused ? pausedLogs : logs;
  const visibleLogs = feedLogs.filter((log) => logFilter === 'ALL' || (logFilter === 'WARN' && log.includes('WARN')) || (logFilter === 'CRITICAL' && log.includes('CRITICAL')));

  return (
    <section aria-label="Live MQTT sensor stream" className="pointer-events-auto absolute bottom-[72px] left-4 right-4 z-[220] flex h-[clamp(220px,28vh,340px)] w-auto flex-col overflow-hidden rounded-xl border border-cyan-200/20 bg-[#030812]/88 p-3 font-sans text-cyan-50 shadow-2xl backdrop-blur-2xl lg:bottom-4 lg:left-auto lg:right-[396px] lg:h-[clamp(220px,28vh,340px)] lg:w-[380px]">
      <div className="mb-2 flex shrink-0 items-center justify-between border-b border-white/10 pb-2 text-[10px] text-cyan-200">
        <span className="font-semibold uppercase tracking-[0.16em]">LIVE MQTT STREAM / 60 SENSORS</span>
        <button type="button" onClick={() => { if (!logsPaused) setPausedLogs(logs); setLogsPaused((paused) => !paused); }} className="rounded border border-white/15 bg-transparent px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-white/55 hover:border-cyan-200/50 hover:text-white">{logsPaused ? 'RESUME' : 'PAUSE'}</button>
      </div>
      <div className="mb-2 flex shrink-0 gap-1">
        {(['ALL', 'WARN', 'CRITICAL'] as LogFilter[]).map((filter) => <button key={filter} type="button" onClick={() => setLogFilter(filter)} className={`rounded border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] transition ${logFilter === filter ? 'border-cyan-200/75 bg-cyan-200/5 text-white' : 'border-white/10 bg-transparent text-white/45 hover:border-cyan-200/40 hover:text-white'}`}>{filter}</button>)}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto font-mono text-[9px] leading-4 text-cyan-100/75">
        {visibleLogs.slice(-40).reverse().map((log, index) => {
          const critical = log.includes('CRITICAL');
          const warn = log.includes('WARN');
          const poleId = extractPoleFromLog(log);
          return <button key={`${log}-${index}`} type="button" onClick={() => { if (poleId) onSelectPole(poleId); }} className={`block w-full cursor-pointer rounded py-0.5 text-left transition hover:bg-cyan-200/5 ${critical ? 'border-l-2 border-rose-300/70 bg-rose-300/5 px-1 font-semibold text-rose-200' : warn ? 'text-amber-200' : 'text-cyan-100/70'}`}>{log}</button>;
        })}
        {visibleLogs.length === 0 && <div className="py-4 text-center text-white/40">WAITING FOR SENSOR DATA</div>}
      </div>
    </section>
  );
}
