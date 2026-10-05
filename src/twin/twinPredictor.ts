import type { TwinHealthStatus, TwinReading } from './iotMqttMock';

export type TwinTicketPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type TwinTicket = {
  id: string;
  poleId: string;
  priority: TwinTicketPriority;
  risk: number;
  daysLeft: number;
  createdAt: number;
};

export type AutoHealResult = {
  readings: TwinReading[];
  fixedPoles: TwinReading[];
  savedPkr: number;
  logs: string[];
};

type RiskReading = Pick<TwinReading, 'temp' | 'watt' | 'voltage'> &
  Partial<Pick<TwinReading, 'risk' | 'healthStatus'>>;

/** Health risk is deliberately independent of isLightOn/isOn. */
export function calculateRisk(reading: RiskReading): number {
  if (typeof reading.risk === 'number') return reading.risk;
  if (reading.temp >= 85) return 0.92;
  if (reading.temp >= 65) return 0.7;
  return 0.1;
}

export function getHealthStatus(reading: RiskReading): TwinHealthStatus {
  if (reading.healthStatus) return reading.healthStatus;
  const risk = calculateRisk(reading);
  if (reading.temp >= 85 || risk > 0.8) return 'FAIL';
  if (reading.temp >= 65 || risk >= 0.7) return 'WARN';
  return 'OK';
}

export function isReadingOn(reading: Pick<TwinReading, 'isLightOn' | 'isOn' | 'watt'>) {
  return reading.isLightOn ?? reading.isOn ?? reading.watt > 0;
}

export function getRecommendation(risk: number, temp: number, watt: number, voltage: number) {
  if (temp > 85 || risk > 0.8) return 'Replace driver now - protect circuit';
  if (watt > 110) return 'Dim light to 70% - reduce overload';
  if (voltage < 210) return 'Check WAPDA line - loose connection';
  return 'No action required';
}

export function simulateAutoHeal(poles: Iterable<TwinReading> | Map<string, TwinReading>): AutoHealResult {
  const readings = poles instanceof Map ? [...poles.values()] : [...poles];
  const fixedPoles: TwinReading[] = [];
  const logs: string[] = [];

  const healedReadings = readings.map((reading) => {
    if (calculateRisk(reading) <= 0.8) return reading;
    const healed = {
      ...reading,
      isLightOn: true,
      isOn: true,
      watt: Number(((reading.baseWatt ?? Math.max(reading.watt, 85)) * 0.3).toFixed(1)),
    };
    const message = `Auto-protection: ${reading.poleId} dimmed to 30% while sensor health remains ${reading.healthStatus}`;
    fixedPoles.push(healed);
    logs.push(message);
    return healed;
  });

  return { readings: healedReadings, fixedPoles, savedPkr: fixedPoles.length * 15000, logs };
}

export function getDaysLeft(risk: number) {
  if (risk >= 0.9) return 1;
  if (risk >= 0.8) return 2;
  if (risk >= 0.7) return 3;
  if (risk >= 0.45) return 14;
  return 30;
}

export function generateTicket(reading: TwinReading): TwinTicket {
  const risk = calculateRisk(reading);
  return {
    id: `TICKET-${reading.poleId}-${reading.timestamp}`,
    poleId: reading.poleId,
    priority: risk >= 0.9 ? 'HIGH' : risk >= 0.7 ? 'MEDIUM' : 'LOW',
    risk,
    daysLeft: getDaysLeft(risk),
    createdAt: Date.now(),
  };
}
