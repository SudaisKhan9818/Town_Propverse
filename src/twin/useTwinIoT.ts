'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { twinMQTT, formatMqttLog, coolHotPole, type TwinReading } from './iotMqttMock';
import { persistInfluxHistory, writeInfluxPoint } from './influxMock';
import { isReadingOn, simulateAutoHeal } from './twinPredictor';
import { TWIN_POLES, type SectionName } from './TwinBlueprintView';

export type TwinLiveData = Map<string, TwinReading>;
export type TwinHistoryData = Record<string, TwinReading[]>;
export type TwinLog = string;
export type TwinBulkAction = 'ON' | 'OFF' | 'DIM70';
type PoleOverride = 'off' | 'on' | 'dim60' | 'dim70' | 'auto';

const HISTORY_STORAGE_KEY = 'twin_history';

function readStoredHistory(): TwinHistoryData {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) ?? '{}') as TwinHistoryData;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function makeReading(poleId: string, temp: number, watt: number): TwinReading {
  return {
    poleId,
    isLightOn: true,
    isOn: true,
    voltage: 220,
    temp,
    watt,
    baseWatt: watt,
    risk: temp >= 85 ? 0.92 : temp >= 65 ? 0.7 : 0.1,
    healthStatus: temp >= 85 ? 'FAIL' : temp >= 65 ? 'WARN' : 'OK',
    timestamp: Date.now(),
  };
}

function createInitialLiveData(): TwinLiveData {
  const data = new Map<string, TwinReading>();
  for (let index = 1; index <= 60; index += 1) {
    const poleId = `P-${String(index).padStart(2, '0')}`;
    const hot = poleId === 'P-12' || poleId === 'P-36' || poleId === 'P-49' || poleId === 'P-51';
    data.set(poleId, makeReading(poleId, hot ? 90 : 45, hot ? 150 : 85));
  }
  return data;
}

function withPower(reading: TwinReading, isLightOn: boolean, watt = reading.baseWatt): TwinReading {
  return { ...reading, isLightOn, isOn: isLightOn, watt: isLightOn ? watt : 0, timestamp: Date.now() };
}

export function useTwinIoT() {
  const [liveData, setLiveData] = useState<TwinLiveData>(() => createInitialLiveData());
  const [historyData, setHistoryData] = useState<TwinHistoryData>({});
  const [logs, setLogs] = useState<TwinLog[]>([]);
  const liveDataRef = useRef<TwinLiveData>(createInitialLiveData());
  const historyRef = useRef<TwinHistoryData>({});
  const logsRef = useRef<TwinLog[]>([]);
  const overridesRef = useRef(new Map<string, PoleOverride>());

  const pushLog = useCallback((message: string) => {
    logsRef.current = [...logsRef.current, message].slice(-150);
    setLogs(logsRef.current);
  }, []);

  const commitReadings = useCallback((readings: TwinReading[], logLines: string[] = []) => {
    if (readings.length === 0) return;
    const nextLiveData = new Map(liveDataRef.current);
    const nextHistoryData: TwinHistoryData = { ...historyRef.current };
    readings.forEach((reading) => {
      nextLiveData.set(reading.poleId, reading);
      writeInfluxPoint(reading);
      const previous = nextHistoryData[reading.poleId] ?? [];
      nextHistoryData[reading.poleId] = [...previous, reading].slice(-100);
    });
    liveDataRef.current = nextLiveData;
    historyRef.current = nextHistoryData;
    setLiveData(nextLiveData);
    setHistoryData(nextHistoryData);
    if (logLines.length) {
      logsRef.current = [...logsRef.current, ...logLines].slice(-150);
      setLogs(logsRef.current);
    }
  }, []);

  const commitReading = useCallback((reading: TwinReading, logLine?: string) => {
    commitReadings([reading], logLine ? [logLine] : []);
  }, [commitReadings]);

  const setPoleOverride = useCallback((poleId: string, override: PoleOverride) => {
    overridesRef.current.set(poleId, override);
  }, []);

  const fixPole = useCallback((poleId: string) => {
    coolHotPole(poleId);
    setPoleOverride(poleId, 'on');
    const current = liveDataRef.current.get(poleId);
    if (!current) return;
    const repaired = makeReading(poleId, 45, current.baseWatt || 85);
    commitReading(repaired, `[${new Date().toLocaleTimeString([], { hour12: false })}] ${poleId} REPAIRED AND COOLED | 45C | ${repaired.watt.toFixed(0)}W | OK`);
    persistInfluxHistory();
  }, [commitReading, setPoleOverride]);

  const togglePole = useCallback((poleId: string) => {
    const current = liveDataRef.current.get(poleId);
    if (!current) return;
    const nextIsOn = !isReadingOn(current);
    setPoleOverride(poleId, nextIsOn ? 'on' : 'off');
    const next = withPower(current, nextIsOn, current.baseWatt || 85);
    commitReading(next, formatMqttLog(next));
  }, [commitReading, setPoleOverride]);

  const dimPole = useCallback((poleId: string) => {
    const current = liveDataRef.current.get(poleId);
    if (!current) return;
    setPoleOverride(poleId, 'dim60');
    const next = withPower(current, true, Number((current.baseWatt * 0.6).toFixed(1)));
    commitReading(next, formatMqttLog(next));
  }, [commitReading, setPoleOverride]);

  const bulkControl = useCallback((poleIds: string[], action: TwinBulkAction) => {
    const nextReadings: TwinReading[] = [];
    const nextLogs: string[] = [];
    poleIds.forEach((poleId) => {
      const current = liveDataRef.current.get(poleId);
      if (!current) return;
      const override: PoleOverride = action === 'OFF' ? 'off' : action === 'ON' ? 'on' : 'dim70';
      setPoleOverride(poleId, override);
      const watt = action === 'OFF' ? 0 : action === 'ON' ? current.baseWatt : Number((current.baseWatt * 0.7).toFixed(1));
      const next = withPower(current, action !== 'OFF', watt);
      nextReadings.push(next);
      nextLogs.push(formatMqttLog(next));
    });
    commitReadings(nextReadings, nextLogs);
  }, [commitReadings, setPoleOverride]);

  const getPolesBySection = useCallback((section: SectionName | string) => (
    section === 'ALL' ? TWIN_POLES.map((pole) => pole.id) : TWIN_POLES.filter((pole) => pole.section === section).map((pole) => pole.id)
  ), []);

  const turnOnSection = useCallback((section: SectionName | string = 'ALL') => bulkControl(getPolesBySection(section), 'ON'), [bulkControl, getPolesBySection]);
  const turnOffSection = useCallback((section: SectionName | string = 'ALL') => bulkControl(getPolesBySection(section), 'OFF'), [bulkControl, getPolesBySection]);
  const dimSection = useCallback((section: SectionName | string = 'ALL') => bulkControl(getPolesBySection(section), 'DIM70'), [bulkControl, getPolesBySection]);

  const applyAutoHeal = useCallback(() => {
    const result = simulateAutoHeal(liveDataRef.current);
    result.fixedPoles.forEach((reading) => setPoleOverride(reading.poleId, 'auto'));
    commitReadings(result.fixedPoles, result.logs);
    persistInfluxHistory();
    return result;
  }, [commitReadings, setPoleOverride]);

  useEffect(() => {
    historyRef.current = readStoredHistory();
    setHistoryData(historyRef.current);
    let lastPersistedAt = 0;
    const persistHistory = () => {
      try {
        const compact: TwinHistoryData = {};
        Object.entries(historyRef.current).forEach(([key, values]) => { compact[key] = values.slice(-10); });
        window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(compact));
        lastPersistedAt = Date.now();
      } catch {
        window.localStorage.removeItem(HISTORY_STORAGE_KEY);
      }
    };

    const applyOverride = (reading: TwinReading) => {
      const override = overridesRef.current.get(reading.poleId);
      if (reading.risk >= 0.92 && override !== 'off') {
        overridesRef.current.set(reading.poleId, 'auto');
      }
      const activeOverride = overridesRef.current.get(reading.poleId);
      const base = reading.baseWatt || reading.watt || 85;
      if (activeOverride === 'off') return withPower(reading, false, 0);
      if (activeOverride === 'dim60') return withPower(reading, true, Number((base * 0.6).toFixed(1)));
      if (activeOverride === 'dim70') return withPower(reading, true, Number((base * 0.7).toFixed(1)));
      if (activeOverride === 'auto') return withPower(reading, true, Number((base * 0.3).toFixed(1)));
      if (activeOverride === 'on') return withPower(reading, true, base);
      return withPower(reading, reading.isLightOn, reading.watt);
    };

    const pendingReadings = new Map<string, TwinReading>();
    const pendingLogs: TwinLog[] = [];
    let flushFrame: number | null = null;
    const flushPending = () => {
      flushFrame = null;
      if (pendingReadings.size === 0) return;
      const readings = [...pendingReadings.values()];
      const logsForCycle = [...pendingLogs];
      pendingReadings.clear();
      pendingLogs.length = 0;
      commitReadings(readings, logsForCycle);
    };
    const queueReading = (reading: TwinReading) => {
      const nextReading = applyOverride(reading);
      pendingReadings.set(nextReading.poleId, nextReading);
      pendingLogs.push(formatMqttLog(nextReading));
      if (flushFrame === null) flushFrame = window.requestAnimationFrame(flushPending);
    };

    const unsubscribe = twinMQTT.subscribe(queueReading);
    twinMQTT.connect();
    const persistTimer = window.setInterval(() => {
      if (Date.now() - lastPersistedAt >= 10000) {
        persistHistory();
        persistInfluxHistory();
      }
    }, 10000);

    return () => {
      unsubscribe();
      if (flushFrame !== null) window.cancelAnimationFrame(flushFrame);
      flushPending();
      window.clearInterval(persistTimer);
      persistHistory();
      persistInfluxHistory();
      twinMQTT.disconnect();
    };
  }, [commitReadings]);

  return {
    liveData,
    historyData,
    logs,
    applyAutoHeal,
    fixPole,
    togglePole,
    dimPole,
    bulkControl,
    turnOnSection,
    turnOffSection,
    dimSection,
  };
}

export default useTwinIoT;
