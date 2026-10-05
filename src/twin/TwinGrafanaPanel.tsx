'use client';

import { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import type { TwinHealthStatus, TwinReading } from './iotMqttMock';
import { calculateRisk, generateTicket, getHealthStatus, isReadingOn } from './twinPredictor';
import type { TwinBulkAction, TwinHistoryData, TwinLiveData, TwinLog } from './useTwinIoT';
import { TWIN_POLES, type SectionName } from './TwinBlueprintView';

const POLE_IDS = TWIN_POLES.map((pole) => pole.id);
const FALLBACK_READING = (poleId: string): TwinReading => ({
  poleId,
  isLightOn: true,
  isOn: true,
  voltage: 220,
  temp: 45,
  watt: 85,
  baseWatt: 85,
  risk: 0.1,
  healthStatus: 'OK',
  timestamp: 0,
});

type StatusFilter = 'ALL' | 'ON' | 'OFF' | 'FAILING';

export function getPoleSection(poleId: string): SectionName {
  return TWIN_POLES.find((pole) => pole.id === poleId)?.section ?? 'R-1';
}

export type TwinGrafanaPanelProps = {
  liveData: TwinLiveData;
  historyData?: TwinHistoryData;
  logs: TwinLog[];
  selectedPole: string | null;
  sectionFilter?: SectionName;
  onSectionChange?: (section: SectionName) => void;
  onSelectPole: (poleId: string) => void;
  onBulkControl: (poleIds: string[], action: TwinBulkAction) => void;
  onFixPole?: (poleId: string) => void;
  onAutoHeal?: () => { savedPkr: number; fixedPoles: TwinReading[] };
  onCapture?: () => boolean;
};

function MiniTrend({ values, color = '#00E5FF' }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="h-8" />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 96 + 2},${28 - ((value - min) / Math.max(1, max - min)) * 23}`).join(' ');
  return <svg viewBox="0 0 100 30" className="h-9 w-full" aria-label="load trend"><polyline points={points} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" /></svg>;
}

function healthTone(status: TwinHealthStatus) {
  if (status === 'FAIL') return 'text-rose-300 border-rose-300/40';
  if (status === 'WARN') return 'text-amber-200 border-amber-200/35';
  return 'text-cyan-200 border-cyan-300/30';
}

export default function TwinGrafanaPanel({
  liveData,
  historyData,
  logs: _logs,
  selectedPole,
  sectionFilter: parentSectionFilter,
  onSectionChange,
  onSelectPole,
  onBulkControl,
  onFixPole,
  onAutoHeal,
  onCapture,
}: TwinGrafanaPanelProps) {
  const [internalSectionFilter, setInternalSectionFilter] = useState<SectionName>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [ticketMessage, setTicketMessage] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const sectionFilter = parentSectionFilter ?? internalSectionFilter;

  const readings = useMemo(() => POLE_IDS.map((poleId) => liveData.get(poleId) ?? FALLBACK_READING(poleId)), [liveData]);
  const rankedReadings = useMemo(() => [...readings].sort((a, b) => calculateRisk(b) - calculateRisk(a)), [readings]);
  const totalWatt = readings.reduce((sum, reading) => sum + (isReadingOn(reading) ? reading.watt : 0), 0);
  const baselineWatt = readings.reduce((sum, reading) => sum + reading.baseWatt, 0);
  const totalLoadKw = totalWatt / 1000;
  const savedPercent = Math.min(99, Math.max(0, Math.round((1 - totalWatt / Math.max(1, baselineWatt)) * 100)));
  const failingPoles = useMemo(() => rankedReadings.filter((reading) => getHealthStatus(reading) === 'FAIL' || calculateRisk(reading) > 0.8), [rankedReadings]);
  const topFailingPole = failingPoles[0] ?? null;

  const loadTrend = useMemo(() => {
    const byTimestamp = new Map<number, number>();
    Object.values(historyData ?? {}).forEach((history) => history.forEach((reading) => {
      byTimestamp.set(reading.timestamp, (byTimestamp.get(reading.timestamp) ?? 0) + (isReadingOn(reading) ? reading.watt : 0));
    }));
    return [...byTimestamp.entries()].sort(([a], [b]) => a - b).slice(-30).map(([, value]) => value);
  }, [historyData]);
  const lastSensorTimestamp = useMemo(() => Math.max(0, ...readings.map((reading) => reading.timestamp)), [readings]);
  const syncAge = lastSensorTimestamp ? Math.max(0, Math.round((Date.now() - lastSensorTimestamp) / 1000)) : 0;

  const visibleReadings = useMemo(() => rankedReadings.filter((reading) => {
    const on = isReadingOn(reading);
    const health = getHealthStatus(reading);
    const sectionMatches = sectionFilter === 'ALL' || getPoleSection(reading.poleId) === sectionFilter;
    const statusMatches = statusFilter === 'ALL'
      || (statusFilter === 'ON' && on)
      || (statusFilter === 'OFF' && !on)
      || (statusFilter === 'FAILING' && health === 'FAIL');
    return sectionMatches && statusMatches;
  }), [rankedReadings, sectionFilter, statusFilter]);

  const targetPoleIds = useMemo(() => sectionFilter === 'ALL' ? POLE_IDS : POLE_IDS.filter((id) => getPoleSection(id) === sectionFilter), [sectionFilter]);

  const handleSectionChange = (section: SectionName) => {
    setInternalSectionFilter(section);
    onSectionChange?.(section);
  };

  const handleFixPole = (poleId: string) => {
    onFixPole?.(poleId);
    const ticket = generateTicket(liveData.get(poleId) ?? FALLBACK_READING(poleId));
    setTicketMessage(`${poleId} repaired and cooled. Ticket ${ticket.id}`);
    window.setTimeout(() => setTicketMessage(''), 4000);
  };

  const handleAutoProtection = () => {
    const result = onAutoHeal?.();
    setReportMessage(result ? `${result.fixedPoles.length} poles protected. Estimated saving PKR ${result.savedPkr.toLocaleString()}.` : 'Automatic protection is active from sensor risk.');
    window.setTimeout(() => setReportMessage(''), 5000);
  };

  const handleMaintenanceReport = () => {
    const date = new Date().toISOString().slice(0, 10);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFillColor(3, 8, 18);
    doc.rect(0, 0, 595, 842, 'F');
    doc.setTextColor(0, 229, 255);
    doc.setFontSize(18);
    doc.text('PROPVERSE TOWN / PREDICTIVE TWIN REPORT', 32, 42);
    doc.setFontSize(9);
    doc.setTextColor(155, 190, 205);
    doc.text(`Generated ${date}   |   Sensor coverage ${readings.length}/${POLE_IDS.length}`, 32, 60);
    doc.setDrawColor(0, 229, 255);
    doc.line(32, 72, 563, 72);
    doc.setFontSize(11);
    doc.setTextColor(238, 247, 250);
    doc.text(`Total load: ${totalLoadKw.toFixed(2)} kW`, 32, 105);
    doc.text(`Energy saved: ${savedPercent}%`, 32, 124);
    doc.text(`Predicted daily cost: PKR ${((totalWatt * 12 * 25) / 1000).toFixed(0)}`, 32, 143);
    doc.text(`Failing poles: ${failingPoles.length}`, 32, 162);
    const chartX = 32;
    const chartY = 210;
    const chartW = 531;
    const chartH = 100;
    doc.setDrawColor(45, 75, 90);
    doc.rect(chartX, chartY, chartW, chartH);
    if (loadTrend.length > 1) {
      const max = Math.max(...loadTrend, 1);
      doc.setDrawColor(0, 229, 255);
      for (let index = 1; index < loadTrend.length; index += 1) {
        const x1 = chartX + ((index - 1) / (loadTrend.length - 1)) * chartW;
        const x2 = chartX + (index / (loadTrend.length - 1)) * chartW;
        const y1 = chartY + chartH - (loadTrend[index - 1] / max) * chartH;
        const y2 = chartY + chartH - (loadTrend[index] / max) * chartH;
        doc.line(x1, y1, x2, y2);
      }
    }
    doc.setTextColor(155, 190, 205);
    doc.setFontSize(9);
    doc.text('TOTAL LOAD TREND / LAST 60 SECONDS', chartX, chartY - 10);
    let y = 352;
    doc.setTextColor(238, 247, 250);
    doc.setFontSize(10);
    doc.text('FAILURE REGISTER', 32, y);
    y += 20;
    failingPoles.forEach((reading) => {
      if (y > 790) return;
      doc.setTextColor(255, 130, 145);
      doc.text(`${reading.poleId}   ${reading.temp.toFixed(1)}C   risk ${(calculateRisk(reading) * 100).toFixed(0)}%   ${getHealthStatus(reading)}   ${isReadingOn(reading) ? 'POWER ON' : 'POWER OFF'}`, 32, y);
      y += 16;
    });
    doc.save(`PropVerse_Twin_Report_${date}.pdf`);
    setReportMessage('Dark-theme maintenance report downloaded.');
    window.setTimeout(() => setReportMessage(''), 4000);
  };

  const premiumButton = 'rounded border border-cyan-200/35 bg-transparent px-2.5 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-100 transition hover:border-cyan-200/75 hover:bg-cyan-200/5 active:scale-[0.98]';
  const subtleButton = 'rounded border border-white/15 bg-transparent px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/60 transition hover:border-cyan-200/50 hover:text-cyan-100';

  return (
    <aside className="pointer-events-auto relative flex h-full w-full flex-col overflow-y-auto border-l border-cyan-200/20 bg-[#030812]/88 p-4 font-sans text-white shadow-2xl backdrop-blur-2xl">
      <header className="mb-3 flex items-start justify-between border-b border-white/10 pb-3">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-300">PROPVERSE TOWN</div>
          <h2 className="mt-1 text-[15px] font-semibold uppercase tracking-[0.14em] text-white">TWIN CONTROL</h2>
        </div>
        <div className="text-right text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-300">LIVE / {readings.length} OF {POLE_IDS.length}</div>
      </header>

      {topFailingPole && (
        <section className="mb-3 rounded-lg border border-rose-300/50 bg-rose-950/10 p-3 shadow-[0_0_22px_rgba(255,77,90,.14)]">
          <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-300">
            <span>PREDICTED FAILURE / {topFailingPole.poleId}</span>
            <span className="rounded border border-rose-300/45 px-1.5 py-0.5 text-[8px]">CRITICAL</span>
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.08em] text-white/70">{topFailingPole.temp.toFixed(1)}C sensor overheat / driver protection required</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-rose-200">RISK {(calculateRisk(topFailingPole) * 100).toFixed(0)}% / HEALTH FAIL</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => handleFixPole(topFailingPole.poleId)} className={`${premiumButton} border-emerald-200/50 text-emerald-200 hover:border-emerald-100`}>FIX NOW</button>
            <button type="button" onClick={() => onBulkControl([topFailingPole.poleId], 'OFF')} className={`${premiumButton} border-rose-200/50 text-rose-200 hover:border-rose-100`}>OFF LIGHT</button>
          </div>
        </section>
      )}

      <section className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-cyan-200/25 bg-cyan-950/10 p-2"><div className="text-[8px] uppercase tracking-[0.14em] text-cyan-300">TOTAL LOAD</div><div className="mt-1 text-sm font-semibold">{totalLoadKw.toFixed(2)} KW</div><div className="text-[8px] text-white/45">/ {(baselineWatt / 1000).toFixed(1)} KW</div></div>
        <div className="rounded-lg border border-rose-200/25 bg-rose-950/10 p-2"><div className="text-[8px] uppercase tracking-[0.14em] text-rose-200">FAILING</div><div className="mt-1 text-sm font-semibold text-rose-200">{failingPoles.length}</div><div className="text-[8px] text-white/45">HEALTH STATE</div></div>
        <div className="rounded-lg border border-emerald-200/25 bg-emerald-950/10 p-2"><div className="text-[8px] uppercase tracking-[0.14em] text-emerald-200">SAVED</div><div className="mt-1 text-sm font-semibold text-emerald-200">{savedPercent}%</div><div className="text-[8px] text-white/45">ENERGY</div></div>
      </section>
      <div className="mt-2 rounded-lg border border-white/10 bg-black/15 px-2 py-1"><div className="mb-1 flex justify-between text-[8px] uppercase tracking-[0.12em] text-white/45"><span>LOAD TREND / 60 SEC</span><span>{((totalWatt * 12 * 25) / 1000).toFixed(0)} PKR / DAY</span></div><MiniTrend values={loadTrend} /></div>

      <section className="mt-3 rounded-lg border border-cyan-200/15 bg-cyan-950/5 p-2.5">
        <div className="mb-2 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-300"><span>EDGE DATA PIPELINE</span><span className="text-emerald-200">SYNCED {syncAge}S AGO</span></div>
        <div className="grid grid-cols-4 gap-1 text-center text-[8px] uppercase tracking-[0.08em] text-white/60">
          <div className="rounded border border-white/10 px-1 py-1.5"><div className="text-cyan-200">SENSOR</div><div className="mt-0.5">60/60</div></div>
          <div className="rounded border border-white/10 px-1 py-1.5"><div className="text-cyan-200">EDGE</div><div className="mt-0.5">RULES ON</div></div>
          <div className="rounded border border-white/10 px-1 py-1.5"><div className="text-cyan-200">MQTT</div><div className="mt-0.5">LIVE</div></div>
          <div className="rounded border border-white/10 px-1 py-1.5"><div className="text-cyan-200">TWIN</div><div className="mt-0.5">SYNCED</div></div>
        </div>
      </section>

      <section className="mt-3 rounded-lg border border-white/10 bg-black/15 p-2.5">
        <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-300">SECTION FOCUS</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {(['ALL', 'R-1', 'R-2', 'R-3', 'R-4', 'Main'] as SectionName[]).map((section) => <button key={section} type="button" onClick={() => handleSectionChange(section)} className={`${subtleButton} ${sectionFilter === section ? 'border-cyan-200/75 text-cyan-100' : ''}`}>{section}</button>)}
        </div>
        <div className="mt-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-300">STATUS FILTER</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {(['ALL', 'ON', 'OFF', 'FAILING'] as StatusFilter[]).map((status) => <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`${subtleButton} ${statusFilter === status ? 'border-emerald-200/70 text-emerald-100' : ''}`}>{status}</button>)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onBulkControl(targetPoleIds, 'ON')} className={premiumButton}>ON {sectionFilter} LIGHTS</button>
          <button type="button" onClick={() => onBulkControl(targetPoleIds, 'OFF')} className={`${premiumButton} border-rose-200/35 text-rose-200`}>OFF {sectionFilter} LIGHTS</button>
          <button type="button" onClick={() => onBulkControl(targetPoleIds, 'DIM70')} className={premiumButton}>DIM {sectionFilter} TO 70%</button>
          <button type="button" onClick={() => onBulkControl(failingPoles.map((pole) => pole.poleId), 'OFF')} className={`${premiumButton} border-amber-200/35 text-amber-100`}>ISOLATE FAILING</button>
        </div>
      </section>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={handleAutoProtection} className={premiumButton}>AUTO PROTECTION</button>
        <button type="button" onClick={handleMaintenanceReport} className={premiumButton}>GENERATE REPORT</button>
        {onCapture && <button type="button" onClick={() => onCapture()} className={`${premiumButton} col-span-2`}>CAPTURE TWIN VIEW</button>}
      </div>
      {reportMessage && <div className="mt-2 border-l border-emerald-200/60 px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-emerald-200">{reportMessage}</div>}

      <div className="mt-4 flex items-center justify-between text-[9px] uppercase tracking-[0.16em] text-cyan-300"><span>POLE INVENTORY</span><span className="text-white/45">{visibleReadings.length}/{readings.length}</span></div>
      <div className="mt-1 min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-black/15">
        <table className="w-full text-left text-[9px]"><thead className="sticky top-0 z-10 border-b border-white/10 bg-[#030812] text-cyan-300"><tr><th className="px-2 py-2">ID</th><th>TEMP</th><th>LOAD</th><th>STATE</th><th className="px-2 text-right">ACTION</th></tr></thead>
          <tbody className="divide-y divide-white/5">{visibleReadings.map((reading) => {
            const on = isReadingOn(reading);
            const status = getHealthStatus(reading);
            const failing = status === 'FAIL' || calculateRisk(reading) > 0.8;
            return <tr key={reading.poleId} onClick={() => onSelectPole(reading.poleId)} className={`cursor-pointer transition hover:bg-cyan-200/5 ${selectedPole === reading.poleId ? 'bg-cyan-200/10' : ''}`}>
              <td className="px-2 py-1.5 font-semibold text-cyan-200">{reading.poleId}</td><td className={failing ? 'text-rose-200' : 'text-white/75'}>{reading.temp.toFixed(0)}C</td><td className="text-white/65">{reading.watt.toFixed(0)}W</td><td className={healthTone(status)}><span className="font-semibold">{failing ? 'FAIL' : on ? 'ON' : 'OFF'}</span></td><td className="px-2 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); handleFixPole(reading.poleId); }} className="rounded border border-cyan-200/30 bg-transparent px-2 py-1 text-[8px] uppercase tracking-[0.08em] text-cyan-100 hover:border-cyan-100/70">FIX</button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {ticketMessage && <div className="mt-2 border-l border-emerald-200/60 px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-emerald-200">{ticketMessage}</div>}
    </aside>
  );
}
