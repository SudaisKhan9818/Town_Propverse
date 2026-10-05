export type TwinHealthStatus = 'OK' | 'WARN' | 'FAIL';

export type TwinReading = {
  poleId: string;
  /** Canonical lamp power state. isOn remains as a compatibility alias. */
  isLightOn: boolean;
  isOn: boolean;
  voltage: number;
  temp: number;
  watt: number;
  baseWatt: number;
  /** Sensor health is independent from the lamp power state. */
  risk: number;
  healthStatus: TwinHealthStatus;
  timestamp: number;
};

type TwinReadingListener = (reading: TwinReading) => void;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function getSensorHealth(temp: number): Pick<TwinReading, 'risk' | 'healthStatus'> {
  if (temp >= 85) {
    return { risk: clamp(0.92 + (temp - 85) * 0.01, 0.92, 0.99), healthStatus: 'FAIL' };
  }
  if (temp >= 65) {
    return { risk: clamp(0.7 + (temp - 65) * 0.009, 0.7, 0.89), healthStatus: 'WARN' };
  }
  return { risk: clamp(0.1 + Math.max(0, temp - 55) * 0.01, 0.1, 0.69), healthStatus: 'OK' };
}

/** Four poles start hot so the predictive layer is visible immediately. */
const HOT_POLES = new Map<string, number>([
  ['P-12', 90],
  ['P-36', 91],
  ['P-49', 89],
  ['P-51', 93],
]);

export function coolHotPole(poleId: string) {
  HOT_POLES.delete(poleId);
}

function createSensorReading(poleId: string, temp: number, baseWatt: number, timestamp: number): TwinReading {
  return {
    poleId,
    isLightOn: true,
    isOn: true,
    voltage: Number((220 + (Math.random() * 4 - 2)).toFixed(1)),
    temp: Number(temp.toFixed(1)),
    watt: baseWatt,
    baseWatt,
    ...getSensorHealth(temp),
    timestamp,
  };
}

/** Browser-only MQTT-shaped source. It publishes all 60 sensor readings every 2 seconds. */
export class TwinMQTT {
  private interval: ReturnType<typeof setInterval> | null = null;
  private riskCycleInterval: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<TwinReadingListener>();

  connect() {
    if (this.interval) return;
    this.emitReadings();
    this.interval = setInterval(() => this.emitReadings(), 2000);
    this.riskCycleInterval = setInterval(() => this.randomizeHotPoles(), 10000);
  }

  private randomizeHotPoles() {
    const picked = new Set<number>();
    while (picked.size < 5) picked.add(Math.floor(Math.random() * 60) + 1);
    HOT_POLES.clear();
    picked.forEach((index) => {
      const poleId = `P-${String(index).padStart(2, '0')}`;
      HOT_POLES.set(poleId, 88 + Math.random() * 9);
    });
  }

  subscribe(listener: TwinReadingListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  disconnect() {
    if (this.interval) clearInterval(this.interval);
    if (this.riskCycleInterval) clearInterval(this.riskCycleInterval);
    this.interval = null;
    this.riskCycleInterval = null;
    this.listeners.clear();
  }

  private emitReadings() {
    const timestamp = Date.now();
    for (let index = 1; index <= 60; index += 1) {
      const poleId = `P-${String(index).padStart(2, '0')}`;
      const hotTemp = HOT_POLES.get(poleId);
      const temp = hotTemp === undefined ? 42 + Math.random() * 13 : hotTemp;
      const reading = createSensorReading(poleId, temp, hotTemp === undefined ? 85 : 150, timestamp);
      this.listeners.forEach((listener) => listener(reading));
    }
  }
}

export function formatMqttLog(reading: TwinReading): string {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  if (!reading.isLightOn && reading.healthStatus === 'FAIL') {
    return `[${time}] ${reading.poleId} | OFF | 0W | CRITICAL - Sensor health FAIL - Power isolated`;
  }
  if (!reading.isLightOn) return `[${time}] ${reading.poleId} | OFF | 0W | SENSOR ${reading.healthStatus}`;
  if (reading.healthStatus === 'FAIL') {
    return `[${time}] ${reading.poleId} | ${reading.temp.toFixed(0)}C | ${reading.watt.toFixed(0)}W | CRITICAL - Overheat - Edge Triggered`;
  }
  if (reading.healthStatus === 'WARN') {
    return `[${time}] ${reading.poleId} | ${reading.temp.toFixed(0)}C | ${reading.watt.toFixed(0)}W | WARN`;
  }
  return `[${time}] ${reading.poleId} | ${reading.temp.toFixed(0)}C | ${reading.watt.toFixed(0)}W | OK`;
}

export const twinMQTT = new TwinMQTT();
