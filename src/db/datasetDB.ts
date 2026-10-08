import { openDB, type IDBPDatabase } from 'idb';
import type { SensorReading } from '../types';

/* ── Types ────────────────────────────────────────────────── */

export interface StoredDatasetRow {
  date: string;
  time: string;
  timestamp: string;
  timeMs: number | null;
  // Specific CSV column names matching requirements
  DHT22_Temperature_C: number | null;
  DHT22_Humidity_percent: number | null;
  DS18B20_Temperature_C: number | null;
  SGP30_TVOC_ppb: number | null;
  SGP30_eCO2_ppm: number | null;
  BH1750_Lux: number | null;
  Soil_Raw: number | null;
  Soil_Moisture_percent: number | null;
  MQ2_Raw: number | null;
  MQ2_ADC_Voltage: number | null;
  // Dashboard camelCase keys for compatibility with UI components
  temperature: number | null;
  humidity: number | null;
  ds18b20Temperature: number | null;
  tvoc: number | null;
  co2: number | null;
  ambientLight: number | null;
  soilRaw: number | null;
  soilMoisture: number | null;
  mq2Gas: number | null;
  mq2Voltage: number | null;
  source?: 'thingsboard' | 'csv' | 'bundled';
  datasetId?: string;
}

export interface StoredDataset {
  id: string;
  datasetName: string;
  createdAt: string; // ISO date string
  startTime: string; // Formatted date/time
  endTime: string;   // Formatted date/time
  recordCount: number;
  columns: string[];
  rows: StoredDatasetRow[];
}

/* ── Database Constants ───────────────────────────────────── */

const DB_NAME = 'SmartFarmingDB';
const DB_VERSION = 1;
const DATASETS_STORE = 'datasets';

export const DATASET_COLUMNS = [
  'Time_ms',
  'Date',
  'Time',
  'DHT22_Temperature_C',
  'DHT22_Humidity_percent',
  'DS18B20_Temperature_C',
  'SGP30_TVOC_ppb',
  'SGP30_eCO2_ppm',
  'BH1750_Lux',
  'Soil_Raw',
  'Soil_Moisture_percent',
  'MQ2_Raw',
  'MQ2_ADC_Voltage',
];

/* ── DB Singleton ─────────────────────────────────────────── */

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(DATASETS_STORE)) {
          const store = db.createObjectStore(DATASETS_STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('datasetName', 'datasetName', { unique: false });
        }
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/* ── Helpers ──────────────────────────────────────────────── */

function formatElapsed(ms: number | null | undefined): string {
  if (ms == null) return '00:00:00';
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days ? `${days}d ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function extractDateAndTime(timestamp: string, timeMs: number | null): { date: string; time: string; displayStr: string } {
  const d = new Date(timestamp);
  if (!Number.isNaN(d.getTime()) && d.getFullYear() > 2000) {
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return {
      date: dateStr,
      time: timeStr,
      displayStr: `${dateStr} ${timeStr}`,
    };
  }
  const elapsedStr = formatElapsed(timeMs);
  return {
    date: 'Elapsed Time',
    time: elapsedStr,
    displayStr: elapsedStr,
  };
}

function valueOrNA(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? String(v) : 'NA';
}

/* ── Public API ───────────────────────────────────────────── */

/** Map a stored dataset's rows back to dashboard SensorReading objects for charts/tables. */
export function datasetRowsToReadings(dataset: StoredDataset): SensorReading[] {
  return dataset.rows.map((r) => ({
    timestamp: r.timestamp,
    timeMs: r.timeMs,
    temperature: r.temperature ?? r.DHT22_Temperature_C,
    humidity: r.humidity ?? r.DHT22_Humidity_percent,
    ds18b20Temperature: r.ds18b20Temperature ?? r.DS18B20_Temperature_C,
    tvoc: r.tvoc ?? r.SGP30_TVOC_ppb,
    co2: r.co2 ?? r.SGP30_eCO2_ppm,
    ambientLight: r.ambientLight ?? r.BH1750_Lux,
    soilRaw: r.soilRaw ?? r.Soil_Raw,
    soilMoisture: r.soilMoisture ?? r.Soil_Moisture_percent,
    mq2Gas: r.mq2Gas ?? r.MQ2_Raw,
    mq2Voltage: r.mq2Voltage ?? r.MQ2_ADC_Voltage,
    source: r.source,
    datasetId: r.datasetId ?? dataset.id,
  }));
}

export function normalizeToStoredDataset(name: string, readings: SensorReading[]): StoredDataset {
  const now = new Date();
  const id = `dataset_${now.getTime()}_${Math.random().toString(36).substring(2, 9)}`;

  const rows: StoredDatasetRow[] = readings.map((r) => {
    const { date, time } = extractDateAndTime(r.timestamp, r.timeMs);
    return {
      date,
      time,
      timestamp: r.timestamp,
      timeMs: r.timeMs,
      // Field names matching specific telemetry columns
      DHT22_Temperature_C: r.temperature,
      DHT22_Humidity_percent: r.humidity,
      DS18B20_Temperature_C: r.ds18b20Temperature,
      SGP30_TVOC_ppb: r.tvoc,
      SGP30_eCO2_ppm: r.co2,
      BH1750_Lux: r.ambientLight,
      Soil_Raw: r.soilRaw,
      Soil_Moisture_percent: r.soilMoisture,
      MQ2_Raw: r.mq2Gas,
      MQ2_ADC_Voltage: r.mq2Voltage,
      // Dashboard camelCase keys
      temperature: r.temperature,
      humidity: r.humidity,
      ds18b20Temperature: r.ds18b20Temperature,
      tvoc: r.tvoc,
      co2: r.co2,
      ambientLight: r.ambientLight,
      soilRaw: r.soilRaw,
      soilMoisture: r.soilMoisture,
      mq2Gas: r.mq2Gas,
      mq2Voltage: r.mq2Voltage,
      source: r.source,
      datasetId: id,
    };
  });

  const firstReading = readings[0];
  const lastReading = readings[readings.length - 1];

  const startTimeInfo = firstReading
    ? extractDateAndTime(firstReading.timestamp, firstReading.timeMs).displayStr
    : '—';
  const endTimeInfo = lastReading
    ? extractDateAndTime(lastReading.timestamp, lastReading.timeMs).displayStr
    : '—';

  return {
    id,
    datasetName: name.trim() || `Session ${now.toLocaleDateString()}`,
    createdAt: now.toISOString(),
    startTime: startTimeInfo,
    endTime: endTimeInfo,
    recordCount: rows.length,
    columns: DATASET_COLUMNS,
    rows,
  };
}

/**
 * Save a dataset to IndexedDB.
 */
function indexedDbError(action: string, err: unknown): Error {
  const detail = err instanceof Error ? err.message : 'Unknown IndexedDB error';
  return new Error(`IndexedDB ${action} failed: ${detail}`);
}

export async function saveDataset(dataset: StoredDataset): Promise<void> {
  try {
    const db = await getDb();
    await db.put(DATASETS_STORE, dataset);
  } catch (err) {
    throw indexedDbError('save', err);
  }
}

/**
 * Read all datasets from IndexedDB, sorted newest first.
 */
export async function getAllDatasets(): Promise<StoredDataset[]> {
  try {
    const db = await getDb();
    const all = await db.getAll(DATASETS_STORE);
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    throw indexedDbError('list', err);
  }
}

/**
 * Retrieve a single dataset by ID from IndexedDB.
 */
export async function getDataset(id: string): Promise<StoredDataset | undefined> {
  try {
    const db = await getDb();
    return db.get(DATASETS_STORE, id);
  } catch (err) {
    throw indexedDbError('load', err);
  }
}

/**
 * Delete a dataset from IndexedDB.
 */
export async function deleteDataset(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(DATASETS_STORE, id);
  } catch (err) {
    throw indexedDbError('delete', err);
  }
}

/**
 * Export / download a StoredDataset as a standard CSV file.
 * Both automatic 20-min inactivity downloads and manual re-downloads use this function,
 * ensuring consistency between CSV and IndexedDB.
 */
export function exportDatasetAsCSV(dataset: StoredDataset): void {
  const header = [
    'Time_ms',
    'Date',
    'Time',
    'DHT22_Temperature_C',
    'DHT22_Humidity_percent',
    'DS18B20_Temperature_C',
    'SGP30_TVOC_ppb',
    'SGP30_eCO2_ppm',
    'BH1750_Lux',
    'Soil_Raw',
    'Soil_Moisture_percent',
    'MQ2_Raw',
    'MQ2_ADC_Voltage',
  ].join(',');

  const rows = dataset.rows.map((r) => [
    r.timeMs ?? 0,
    `"${r.date}"`,
    `"${r.time}"`,
    valueOrNA(r.DHT22_Temperature_C ?? r.temperature),
    valueOrNA(r.DHT22_Humidity_percent ?? r.humidity),
    valueOrNA(r.DS18B20_Temperature_C ?? r.ds18b20Temperature),
    valueOrNA(r.SGP30_TVOC_ppb ?? r.tvoc),
    valueOrNA(r.SGP30_eCO2_ppm ?? r.co2),
    valueOrNA(r.BH1750_Lux ?? r.ambientLight),
    valueOrNA(r.Soil_Raw ?? r.soilRaw),
    valueOrNA(r.Soil_Moisture_percent ?? r.soilMoisture),
    valueOrNA(r.MQ2_Raw ?? r.mq2Gas),
    valueOrNA(r.MQ2_ADC_Voltage ?? r.mq2Voltage),
  ].join(','));

  const csvContent = [header, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = dataset.datasetName.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `${safeName}_${dataset.createdAt.slice(0, 10)}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
