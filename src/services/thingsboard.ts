import type { SensorKey, SensorReading } from '../types';

const TB_URL = (import.meta.env.VITE_THINGSBOARD_URL || 'http://localhost:8080').replace(/\/$/, '');
const DEVICE_ID = import.meta.env.VITE_THINGSBOARD_DEVICE_ID;
const API_KEY = import.meta.env.VITE_THINGSBOARD_API_KEY;

const TELEMETRY_KEYS: Record<SensorKey, string> = {
  temperature: 'temperature',
  humidity: 'humidity',
  ambientLight: 'ambientLight',
  co2: 'co2',
  soilMoisture: 'soilMoisture',
  tvoc: 'tvoc',
  mq2Gas: 'mq2Gas',
  mq2Voltage: 'mq2Voltage',
  soilRaw: 'soilRaw',
  ds18b20Temperature: 'ds18b20Temperature',
};

interface TimeSeriesPoint {
  ts: number;
  value: string | number | null;
}

type TimeSeriesResponse = Record<string, TimeSeriesPoint[]>;

function requireConfig() {
  if (!DEVICE_ID) {
    throw new Error('ThingsBoard Device ID is not configured. Set VITE_THINGSBOARD_DEVICE_ID in your .env file.');
  }
  if (!API_KEY) {
    throw new Error('ThingsBoard API key is not configured. Set VITE_THINGSBOARD_API_KEY in your .env file.');
  }
}

function parseValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function requestHeaders(): HeadersInit {
  return {
    Accept: 'application/json',
    'X-Authorization': `ApiKey ${API_KEY}`,
  };
}

function keyList() {
  return Object.values(TELEMETRY_KEYS).join(',');
}

function responseToReadings(data: TimeSeriesResponse): SensorReading[] {
  const byTimestamp = new Map<number, SensorReading>();

  (Object.keys(TELEMETRY_KEYS) as SensorKey[]).forEach((sensorKey) => {
    const telemetryKey = TELEMETRY_KEYS[sensorKey];
    for (const point of data[telemetryKey] ?? []) {
      if (!byTimestamp.has(point.ts)) {
        byTimestamp.set(point.ts, {
          timestamp: new Date(point.ts).toISOString(),
          timeMs: point.ts,
          temperature: null,
          humidity: null,
          ambientLight: null,
          co2: null,
          soilMoisture: null,
          soilRaw: null,
          tvoc: null,
          mq2Gas: null,
          mq2Voltage: null,
          ds18b20Temperature: null,
        });
      }
      byTimestamp.get(point.ts)![sensorKey] = parseValue(point.value);
    }
  });

  return [...byTimestamp.values()].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

/** Fetch the newest telemetry value for every configured sensor key. */
export async function fetchLatestFeed(): Promise<SensorReading> {
  requireConfig();

  const url = new URL(`${TB_URL}/api/plugins/telemetry/DEVICE/${DEVICE_ID}/values/timeseries`);
  url.searchParams.set('keys', keyList());

  const response = await fetch(url, { headers: requestHeaders() });
  if (!response.ok) {
    throw new Error(`ThingsBoard telemetry request failed (${response.status}). Check the Device ID and API key.`);
  }

  const readings = responseToReadings(await response.json() as TimeSeriesResponse);
  if (readings.length === 0) {
    throw new Error('ThingsBoard is reachable, but this device has no telemetry yet. Send data from the ESP32 first.');
  }

  return readings[readings.length - 1];
}

/**
 * Fetch historical telemetry. The default is deliberately small for the UI.
 * Increase VITE_THINGSBOARD_HISTORY_LIMIT when you are ready to load more data.
 */
export async function fetchHistoricalFeeds(
  results = Number(import.meta.env.VITE_THINGSBOARD_HISTORY_LIMIT || 500),
): Promise<SensorReading[]> {
  requireConfig();

  const endTs = Date.now();
  const startTs = endTs - Number(import.meta.env.VITE_THINGSBOARD_HISTORY_WINDOW_MS || 7 * 24 * 60 * 60 * 1000);

  const url = new URL(`${TB_URL}/api/plugins/telemetry/DEVICE/${DEVICE_ID}/values/timeseries`);
  url.searchParams.set('keys', keyList());
  url.searchParams.set('startTs', String(startTs));
  url.searchParams.set('endTs', String(endTs));
  url.searchParams.set('limit', String(results));
  url.searchParams.set('agg', 'NONE');
  url.searchParams.set('orderBy', 'ASC');

  const response = await fetch(url, { headers: requestHeaders() });
  if (!response.ok) {
    throw new Error(`ThingsBoard history request failed (${response.status}).`);
  }

  return responseToReadings(await response.json() as TimeSeriesResponse);
}
