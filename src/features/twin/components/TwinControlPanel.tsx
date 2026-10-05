'use client';

import { useState } from 'react';
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { X } from 'lucide-react';
import type { TwinHistoryPoint, TwinPowerOffTarget } from '../hooks/useTwinSimulation';

export type TwinControlPanelProps = {
  history: TwinHistoryPoint[];
  onPowerOff: (target: TwinPowerOffTarget) => void;
  onPowerOn: (target: TwinPowerOffTarget) => void;
  onBoostTemperature: (factor?: number) => void;
  onReset: () => void;
  isGridOpen?: boolean;
  onGridOpenChange?: (open: boolean) => void;
};

const chartLines = [
  { dataKey: 'GRID-A-watt', name: 'GRID-A', color: '#06b6d4' },
  { dataKey: 'GRID-B-watt', name: 'GRID-B', color: '#8b5cf6' },
  { dataKey: 'GRID-C-watt', name: 'GRID-C', color: '#f59e0b' },
  { dataKey: 'total', name: 'Total', color: '#f8fafc' },
] as const;

export default function TwinControlPanel({ history, onPowerOff, onPowerOn, onBoostTemperature, onReset, isGridOpen: controlledGridOpen, onGridOpenChange }: TwinControlPanelProps) {
  const [internalGridOpen, setInternalGridOpen] = useState(true);
  const isGridOpen = controlledGridOpen ?? internalGridOpen;
  const setIsGridOpen = (open: boolean) => {
    onGridOpenChange?.(open);
    if (controlledGridOpen === undefined) setInternalGridOpen(open);
  };

  if (!isGridOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsGridOpen(true)}
        className="rounded-full border border-cyan-500/30 bg-black/80 px-4 py-2 text-[11px] font-medium text-cyan-100 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:bg-cyan-950/80"
        aria-label="Open Grid Monitor"
      >
        📊 GRID LIVE
      </button>
    );
  }

  return (
    <section className="max-h-[85vh] w-full overflow-y-auto rounded-2xl border border-cyan-500/20 bg-[#0a0a0f]/90 p-3 text-white shadow-[0_0_20px_rgba(6,182,212,0.2)] backdrop-blur-2xl transition-all duration-300">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300">GRID MONITOR</p>
          <h2 className="mt-1 text-sm font-semibold text-white">Energy and control</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-300"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />Live</span>
          <button type="button" onClick={() => setIsGridOpen(false)} className="grid h-7 w-7 place-items-center rounded-full border border-white/15 text-slate-300 transition-colors hover:border-cyan-300 hover:text-white" aria-label="Close Grid Monitor">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="mt-3 h-[130px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <XAxis dataKey="time" tickFormatter={(value: string) => value.slice(11, 19)} stroke="#94a3b8" fontSize={10} />
            <YAxis stroke="#94a3b8" fontSize={10} unit=" W" />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {chartLines.map((line) => <Line key={line.dataKey} type="monotone" dataKey={line.dataKey} name={line.name} stroke={line.color} dot={false} strokeWidth={line.name === 'Total' ? 2.5 : 1.5} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => onBoostTemperature(1)} className="rounded-full border border-red-300/35 bg-transparent px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-red-100 transition hover:bg-red-200/5 hover:border-red-200/70">TEST FIRE</button>
        <button type="button" onClick={onReset} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2.5 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-500/25">RESET</button>
        {(['GRID-A', 'GRID-B', 'GRID-C'] as const).map((id) => (
          <div key={id} className="contents">
            <button type="button" onClick={() => onPowerOff({ type: 'grid', id })} className="rounded-full border border-red-500/40 bg-red-500/20 px-3 py-2.5 text-[11px] font-medium text-red-100 transition hover:bg-red-500/35">OFF {id}</button>
            <button type="button" onClick={() => onPowerOn({ type: 'grid', id })} className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-2.5 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-500/30">ON {id}</button>
          </div>
        ))}
        {[1, 2, 3, 4, 5, 6].map((road) => (
          <div key={road} className="contents">
            <button type="button" onClick={() => onPowerOff({ type: 'road', id: `Road-${road}` })} className="rounded-full border border-red-500/40 bg-red-500/20 px-3 py-2.5 text-[11px] font-medium text-red-100 transition hover:bg-red-500/35">OFF ROAD-{road}</button>
            <button type="button" onClick={() => onPowerOn({ type: 'road', id: `Road-${road}` })} className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-2.5 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-500/30">ON ROAD-{road}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
