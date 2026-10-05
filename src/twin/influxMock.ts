import type { TwinReading } from './iotMqttMock';

export type InfluxRange = number | '1h';

const INFLUX_STORAGE_KEY = 'twin_influx_history';
const MAX_POINTS_PER_POLE = 3600;
let loaded = false;
let store: Record<string, TwinReading[]> = {};

function ensureLoaded() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const saved = window.localStorage.getItem(INFLUX_STORAGE_KEY);
    if (saved) store = JSON.parse(saved) as Record<string, TwinReading[]>;
  } catch {
    store = {};
  }
}

export function writeInfluxPoint(reading: TwinReading) {
  ensureLoaded();
  const history = store[reading.poleId] ?? [];
  store[reading.poleId] = [...history, reading].slice(-MAX_POINTS_PER_POLE);
}

export function persistInfluxHistory() {
  ensureLoaded();
  if (typeof window === 'undefined') return;
  try {
    const compactStore: Record<string, TwinReading[]> = {};
    for (const [k, v] of Object.entries(store)) {
      compactStore[k] = v.slice(-15);
    }
    window.localStorage.setItem(INFLUX_STORAGE_KEY, JSON.stringify(compactStore));
  } catch {
    try {
      window.localStorage.removeItem(INFLUX_STORAGE_KEY);
    } catch {}
  }
}

export function queryHistory(poleId: string, range: InfluxRange = '1h') {
  ensureLoaded();
  const duration = range === '1h' ? 60 * 60 * 1000 : range;
  const since = Date.now() - duration;
  return (store[poleId] ?? []).filter((point) => point.timestamp >= since);
}
