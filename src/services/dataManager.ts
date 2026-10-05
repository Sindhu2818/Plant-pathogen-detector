import type { SensorReading, DatasetInfo, ConnectionState, ImportProgress, ImportOptions } from '../types';
import { getReadingTime } from '../types';
import { fetchCsvHistory, parseCsvText } from './csvData';
import { fetchLatestFeed, fetchHistoricalFeeds } from './thingsboard';
import * as store from './localDataStore';

/* ── Types ────────────────────────────────────────────────── */

export interface DataManagerState {
  readings: SensorReading[];
  latestReading: SensorReading | null;
  connectionState: ConnectionState;
  datasets: DatasetInfo[];
  tbError: string | null;
}

/* ── Bundled CSV auto-import ──────────────────────────────── */

const BUNDLED_DATASET_ID = 'bundled-historical';

/**
 * Ensure the bundled public/esp32_sensor_data.csv is loaded into IndexedDB
 * on first use. Subsequent visits skip re-import.
 */
async function ensureBundledCsv(): Promise<void> {
  const existing = await store.getDataset(BUNDLED_DATASET_ID);
  if (existing) return; // already imported

  try {
    const readings = await fetchCsvHistory();
    if (readings.length === 0) return;

    const firstTimeMs = readings[0].timeMs;
    const lastTimeMs = readings[readings.length - 1].timeMs;

    await store.saveDataset({
      id: BUNDLED_DATASET_ID,
      name: 'Bundled Historical CSV',
      source: 'bundled',
      readingCount: readings.length,
      firstTimeMs,
      lastTimeMs,
      importedAt: new Date().toISOString(),
    });
    await store.saveReadings(readings, BUNDLED_DATASET_ID);
  } catch {
    // Bundled CSV might not exist — that's OK, just skip
    console.warn('Could not load bundled CSV; continuing without it.');
  }
}

/* ── ThingsBoard fetch (non-fatal) ────────────────────────── */

interface TbResult {
  latest: SensorReading | null;
  history: SensorReading[];
  online: boolean;
  error: string | null;
}

async function fetchThingsBoard(): Promise<TbResult> {
  try {
    const [latest, history] = await Promise.all([
      fetchLatestFeed().catch(() => null),
      fetchHistoricalFeeds().catch(() => [] as SensorReading[]),
    ]);

    // Tag ThingsBoard readings
    const taggedHistory = history.map((r) => ({ ...r, source: 'thingsboard' as const }));
    const taggedLatest = latest ? { ...latest, source: 'thingsboard' as const } : null;

    return {
      latest: taggedLatest,
      history: taggedHistory,
      online: taggedLatest !== null || taggedHistory.length > 0,
      error: null,
    };
  } catch (err) {
    return {
      latest: null,
      history: [],
      online: false,
      error: err instanceof Error ? err.message : 'ThingsBoard unavailable',
    };
  }
}

/* ── Load all data ────────────────────────────────────────── */

export async function loadAllData(): Promise<DataManagerState> {
  // 1. Ensure bundled CSV is in IndexedDB
  await ensureBundledCsv();

  // 2. Try ThingsBoard (non-blocking on failure)
  const tb = await fetchThingsBoard();

  // 3. Load all locally stored readings (IndexedDB)
  const localReadings = await store.loadAllReadings();

  // 4. Merge: local readings + ThingsBoard history
  const allReadings = [...localReadings, ...tb.history];

  // 5. Sort chronologically using true timestamp/timeMs
  allReadings.sort((a, b) => getReadingTime(a) - getReadingTime(b));

  // 6. Deduplicate identical readings
  const seen = new Set<string>();
  const deduplicatedReadings: SensorReading[] = [];
  for (const r of allReadings) {
    const key = `${r.source ?? ''}_${r.timeMs ?? 0}_${r.timestamp}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicatedReadings.push(r);
    }
  }

  // 7. Determine latest reading (newest across all sources)
  let latestReading: SensorReading | null = null;
  if (deduplicatedReadings.length > 0) {
    latestReading = deduplicatedReadings[deduplicatedReadings.length - 1];
  }
  // ThingsBoard latest might be even newer
  if (tb.latest) {
    if (!latestReading || getReadingTime(tb.latest) >= getReadingTime(latestReading)) {
      latestReading = tb.latest;
    }
  }

  // 8. Determine connection state
  let connectionState: ConnectionState;
  if (tb.online) {
    connectionState = 'live';
  } else if (deduplicatedReadings.length > 0) {
    connectionState = 'offline';
  } else {
    connectionState = 'no-data';
  }

  // 9. Load dataset list
  const datasets = await store.listDatasets();

  return {
    readings: deduplicatedReadings,
    latestReading,
    connectionState,
    datasets,
    tbError: tb.error,
  };
}

/* ── CSV Import ───────────────────────────────────────────── */

export async function importCsvFile(
  file: File,
  options: ImportOptions,
  onProgress: (progress: ImportProgress) => void,
): Promise<{ success: boolean; datasetId: string; message: string }> {
  // Phase 1: Read file
  onProgress({ phase: 'reading', current: 0, total: 0, message: 'Reading CSV file…' });
  const text = await file.text();

  // Phase 2: Parse
  onProgress({ phase: 'parsing', current: 0, total: 0, message: 'Parsing rows…' });
  const datasetId =
    options.datasetName?.replace(/\s+/g, '_').toLowerCase() ||
    `csv_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '_')}`;

  const { readings, errors } = parseCsvText(text, {
    experimentStartTime: options.experimentStartTime,
    datasetId,
  });

  if (readings.length === 0) {
    const errorMsg = errors.length > 0 ? errors[0] : 'No valid readings found in CSV.';
    onProgress({ phase: 'error', current: 0, total: 0, message: errorMsg });
    return { success: false, datasetId, message: errorMsg };
  }

  // Phase 3: Duplicate check
  onProgress({ phase: 'checking', current: 0, total: readings.length, message: 'Checking for duplicates…' });
  const firstTimeMs = readings[0].timeMs;
  const lastTimeMs = readings[readings.length - 1].timeMs;

  if (!options.forceImport) {
    const duplicate = await store.checkDuplicateDataset(firstTimeMs, lastTimeMs, readings.length);
    if (duplicate) {
      const msg = `This dataset appears to match "${duplicate.name}" (${duplicate.readingCount.toLocaleString()} readings). It may have already been imported.`;
      onProgress({ phase: 'error', current: 0, total: readings.length, message: msg });
      return { success: false, datasetId, message: msg };
    }
  }

  // Phase 4: Import into IndexedDB
  await store.saveReadings(readings, datasetId, (saved, total) => {
    onProgress({
      phase: 'importing',
      current: saved,
      total,
      message: `Importing ${saved.toLocaleString()} / ${total.toLocaleString()}`,
    });
  });

  // Save dataset metadata
  await store.saveDataset({
    id: datasetId,
    name: options.datasetName || file.name.replace(/\.csv$/i, ''),
    source: 'csv',
    readingCount: readings.length,
    firstTimeMs,
    lastTimeMs,
    importedAt: new Date().toISOString(),
    experimentStartTime: options.experimentStartTime?.toISOString(),
  });

  const msg = `Successfully imported ${readings.length.toLocaleString()} readings.${
    errors.length > 0 ? ` ${errors.length} rows had parse warnings.` : ''
  }`;
  onProgress({ phase: 'complete', current: readings.length, total: readings.length, message: msg });

  return { success: true, datasetId, message: msg };
}

/* ── Dataset management ───────────────────────────────────── */

export async function deleteDataset(id: string): Promise<void> {
  await store.deleteDataset(id);
}

export async function listDatasets(): Promise<DatasetInfo[]> {
  return store.listDatasets();
}

/* ── CSV Export ────────────────────────────────────────────── */

const CSV_HEADER = [
  'Time_ms',
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

function valueOrEmpty(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? String(v) : 'NA';
}

export function exportCombinedCsv(readings: SensorReading[]): void {
  const rows = readings.map((r) =>
    [
      r.timeMs ?? 0,
      valueOrEmpty(r.temperature),
      valueOrEmpty(r.humidity),
      valueOrEmpty(r.ds18b20Temperature),
      valueOrEmpty(r.tvoc),
      valueOrEmpty(r.co2),
      valueOrEmpty(r.ambientLight),
      valueOrEmpty(r.soilRaw),
      valueOrEmpty(r.soilMoisture),
      valueOrEmpty(r.mq2Gas),
      valueOrEmpty(r.mq2Voltage),
    ].join(','),
  );

  const csvContent = [CSV_HEADER, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `plantsense_combined_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
