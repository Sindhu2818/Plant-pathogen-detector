export interface SensorReading {
  timestamp: string;
  timeMs: number | null;
  temperature: number | null;
  humidity: number | null;
  ambientLight: number | null;
  co2: number | null;
  soilMoisture: number | null;
  soilRaw: number | null;
  tvoc: number | null;
  mq2Gas: number | null;
  mq2Voltage: number | null;
  ds18b20Temperature: number | null;
  /** Data source – optional so existing code that doesn't set it keeps working. */
  source?: 'thingsboard' | 'csv' | 'bundled';
  /** Identifies the dataset this reading belongs to. */
  datasetId?: string;
}

export type SensorKey = keyof Omit<SensorReading, 'timestamp' | 'timeMs' | 'source' | 'datasetId'>;

export interface SensorConfig {
  key: SensorKey;
  telemetryKey: string;
  displayName: string;
  unit: string;
  color: string;
  bgColor: string;
  borderColor: string;
  chartColor: string;
}

/** Metadata for one imported / auto-loaded dataset. */
export interface DatasetInfo {
  id: string;
  name: string;
  source: 'csv' | 'bundled' | 'thingsboard';
  readingCount: number;
  firstTimeMs: number | null;
  lastTimeMs: number | null;
  importedAt: string;
  experimentStartTime?: string;
}

/** Dashboard connection state with ThingsBoard. */
export type ConnectionState = 'live' | 'offline' | 'no-data';

/** Progress information during CSV import. */
export interface ImportProgress {
  phase: 'reading' | 'parsing' | 'checking' | 'importing' | 'complete' | 'error';
  current: number;
  total: number;
  message: string;
}

/** Options for CSV import. */
export interface ImportOptions {
  experimentStartTime?: Date;
  datasetName?: string;
  /** When true, import even if a duplicate dataset is detected. */
  forceImport?: boolean;
}

export type { StoredDataset, StoredDatasetRow } from '../db/datasetDB';

export type TimeRangeKey = '1H' | '3H' | '6H' | '12H' | '24H' | '3D' | 'ALL';

/** Extract numeric time in ms from reading (using timestamp or timeMs). */
export function getReadingTime(r: SensorReading): number {
  if (r.timestamp) {
    const t = new Date(r.timestamp).getTime();
    if (!Number.isNaN(t) && t > 0) return t;
  }
  return r.timeMs ?? 0;
}

export const SENSOR_CONFIGS: SensorConfig[] = [
  { key: 'temperature', telemetryKey: 'temperature', displayName: 'DHT22 Temperature', unit: '°C', color: '#7A8F5C', bgColor: '#f0f4e8', borderColor: '#C1CFA1', chartColor: '#8aa35e' },
  { key: 'humidity', telemetryKey: 'humidity', displayName: 'DHT22 Humidity', unit: '%', color: '#C48A5A', bgColor: '#fff3e6', borderColor: '#FFDAB9', chartColor: '#e8a76c' },
  { key: 'ds18b20Temperature', telemetryKey: 'ds18b20Temperature', displayName: 'DS18B20 Temperature', unit: '°C', color: '#9A765A', bgColor: '#f7eee8', borderColor: '#E5CDBD', chartColor: '#b58a6d' },
  { key: 'ambientLight', telemetryKey: 'ambientLight', displayName: 'Ambient Light', unit: 'lux', color: '#5A8FA8', bgColor: '#eaf3f8', borderColor: '#B8D4E3', chartColor: '#6da3bc' },
  { key: 'co2', telemetryKey: 'co2', displayName: 'CO₂', unit: 'ppm', color: '#8B6FA8', bgColor: '#f0ebf5', borderColor: '#D5C6E0', chartColor: '#a084bf' },
  { key: 'soilMoisture', telemetryKey: 'soilMoisture', displayName: 'Soil Moisture', unit: '%', color: '#B07080', bgColor: '#fdf0f2', borderColor: '#F8E1E4', chartColor: '#c7899a' },
  { key: 'soilRaw', telemetryKey: 'soilRaw', displayName: 'Soil Raw', unit: 'ADC', color: '#8B7058', bgColor: '#f5eee8', borderColor: '#E2D1C3', chartColor: '#a9876d' },
  { key: 'tvoc', telemetryKey: 'tvoc', displayName: 'TVOC', unit: 'ppb', color: '#7A6B99', bgColor: '#eeebf5', borderColor: '#D0C4E0', chartColor: '#9585b3' },
  { key: 'mq2Gas', telemetryKey: 'mq2Gas', displayName: 'MQ-2 Raw', unit: 'ADC', color: '#5A7FA0', bgColor: '#eaf0f6', borderColor: '#B8CCE0', chartColor: '#6d95b5' },
  { key: 'mq2Voltage', telemetryKey: 'mq2Voltage', displayName: 'MQ-2 Voltage', unit: 'V', color: '#6A8A75', bgColor: '#edf4ef', borderColor: '#C8D9CD', chartColor: '#789a83' },
];
