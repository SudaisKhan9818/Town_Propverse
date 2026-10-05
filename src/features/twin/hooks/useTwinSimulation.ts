'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import twinSchema from '@/src/data/twin_schema.json';

const SIMULATION_INTERVAL_MS = 5_000;
const HISTORY_LIMIT = 20;

type TwinStatus = 'ON' | 'OFF';
type GridId = 'GRID-A' | 'GRID-B' | 'GRID-C';
export type GridStatus = 'OK' | 'WARNING' | 'OVERHEAT';

export type TwinLight = {
  id: string;
  type: 'streetlight';
  grid_id: GridId;
  street_id: string;
  base_watt: number;
  live: {
    temp: number;
    watt: number;
    status: TwinStatus;
    risk: number;
  };
  limits: {
    max_temp: number;
    max_watt: number;
  };
};

export type TwinGridStation = {
  id: 'GRID-MAIN';
  type: 'grid_station';
  capacity_watt: number;
  live: {
    production: number;
    total_consumption: number;
    temp: number;
    status: GridStatus;
  };
  connected_grids: GridId[];
};

export type TwinData = {
  lights: TwinLight[];
  grid_station: TwinGridStation;
};

export type TwinHistoryPoint = {
  time: string;
  'GRID-A-watt': number;
  'GRID-B-watt': number;
  'GRID-C-watt': number;
  total: number;
};

export type TwinPowerOffTarget =
  | { type: 'grid'; id: GridId }
  | { type: 'road'; id: string };

function cloneSchema(): TwinData {
  return JSON.parse(JSON.stringify(twinSchema)) as TwinData;
}

function randomTemperatureIncrease(): number {
  return 0.5 + Math.random() * 2;
}

function calculateRisk(temp: number): number {
  if (temp > 70) return 0.9;
  if (temp > 60) return 0.6;
  return 0.1;
}

function createHistoryPoint(data: TwinData, time = new Date().toISOString()): TwinHistoryPoint {
  const gridWatts: Record<GridId, number> = {
    'GRID-A': 0,
    'GRID-B': 0,
    'GRID-C': 0,
  };

  for (const light of data.lights) {
    gridWatts[light.grid_id] += light.live.watt;
  }

  const total = gridWatts['GRID-A'] + gridWatts['GRID-B'] + gridWatts['GRID-C'];
  return {
    time,
    'GRID-A-watt': gridWatts['GRID-A'],
    'GRID-B-watt': gridWatts['GRID-B'],
    'GRID-C-watt': gridWatts['GRID-C'],
    total,
  };
}

function withGridMetrics(data: TwinData, lights: TwinLight[]): TwinData {
  const totalConsumption = lights.reduce((total, light) => total + light.live.watt, 0);
  const gridTemp = 40 + totalConsumption / 3000;
  const gridStatus: GridStatus = gridTemp > 80 ? 'OVERHEAT' : gridTemp > 55 ? 'WARNING' : 'OK';
  return {
    ...data,
    lights,
    grid_station: {
      ...data.grid_station,
      live: {
        ...data.grid_station.live,
        total_consumption: totalConsumption,
        production: totalConsumption * 1.12,
        temp: gridTemp,
        status: gridStatus,
      },
    },
  };
}

function simulateNext(data: TwinData): TwinData {
  const lights = data.lights.map((light) => {
    if (light.live.status === 'OFF') {
      return {
        ...light,
        live: { ...light.live, watt: 0 },
      };
    }
    const temp = light.live.temp + randomTemperatureIncrease();
    const watt = light.base_watt * (temp / 40);
    return {
      ...light,
      live: {
        ...light.live,
        temp,
        watt,
        risk: calculateRisk(temp),
      },
    };
  });

  return withGridMetrics(data, lights);
}

function powerOff(data: TwinData, target: TwinPowerOffTarget): TwinData {
  const lights = data.lights.map((light) => {
    const selected = target.type === 'grid'
      ? light.grid_id === target.id
      : light.street_id === target.id;
    return selected
      ? { ...light, live: { ...light.live, status: 'OFF' as const, watt: 0 } }
      : light;
  });
  return withGridMetrics(data, lights);
}

function powerOn(data: TwinData, target: TwinPowerOffTarget): TwinData {
  const lights = data.lights.map((light) => {
    const selected = target.type === 'grid'
      ? light.grid_id === target.id
      : light.street_id === target.id;
    return selected
      ? { ...light, live: { ...light.live, status: 'ON' as const, watt: light.base_watt * (light.live.temp / 40) } }
      : light;
  });
  return withGridMetrics(data, lights);
}

export function useTwinSimulation() {
  const initialData = useRef<TwinData | null>(null);
  if (!initialData.current) initialData.current = cloneSchema();

  const dataRef = useRef<TwinData>(initialData.current);
  const [twinData, setTwinData] = useState<TwinData>(initialData.current);
  const [history, setHistory] = useState<TwinHistoryPoint[]>(() => [
    createHistoryPoint(initialData.current!),
  ]);

  const updateTwinData = useCallback((target: TwinPowerOffTarget) => {
    const nextData = powerOff(dataRef.current, target);
    dataRef.current = nextData;
    setTwinData(nextData);
    setHistory((previous) => [
      ...previous,
      createHistoryPoint(nextData),
    ].slice(-HISTORY_LIMIT));
  }, []);

  const powerOnTwinData = useCallback((target: TwinPowerOffTarget) => {
    const nextData = powerOn(dataRef.current, target);
    dataRef.current = nextData;
    setTwinData(nextData);
    setHistory((previous) => [
      ...previous,
      createHistoryPoint(nextData),
    ].slice(-HISTORY_LIMIT));
  }, []);

  const boostTemp = useCallback((factor = 1) => {
    const nextLights = dataRef.current.lights.map((light) => {
      if (light.live.status === 'OFF') return light;
      const temp = light.live.temp + 15 * factor;
      return {
        ...light,
        live: {
          ...light.live,
          temp,
          watt: light.base_watt * (temp / 40),
          risk: calculateRisk(temp),
        },
      };
    });
    const nextData = withGridMetrics(dataRef.current, nextLights);
    dataRef.current = nextData;
    setTwinData(nextData);
    setHistory((previous) => [...previous, createHistoryPoint(nextData)].slice(-HISTORY_LIMIT));
  }, []);

  const resetTwinData = useCallback(() => {
    const reset = cloneSchema();
    const nextData = withGridMetrics(reset, reset.lights.map((light) => ({
      ...light,
      live: { ...light.live, temp: 40, watt: light.base_watt, risk: 0.1, status: 'ON' as const },
    })));
    dataRef.current = nextData;
    setTwinData(nextData);
    setHistory([createHistoryPoint(nextData)]);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextData = simulateNext(dataRef.current);
      dataRef.current = nextData;
      setTwinData(nextData);
      setHistory((previous) => [
        ...previous,
        createHistoryPoint(nextData),
      ].slice(-HISTORY_LIMIT));
    }, SIMULATION_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  return { twinData, history, updateTwinData, powerOnTwinData, boostTemp, resetTwinData };
}

export default useTwinSimulation;
