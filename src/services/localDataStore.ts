import { openDB, type IDBPDatabase } from 'idb';
import type { SensorReading, DatasetInfo } from '../types';

/* ── Constants ────────────────────────────────────────────── */

const DB_NAME = 'plantsense';
const DB_VERSION = 1;
const READINGS_STORE = 'readings';
const DATASETS_STORE = 'datasets';
const CHUNK_SIZE = 500;

/* ── DB singleton ─────────────────────────────────────────── */

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(READINGS_STORE)) {
          const store = db.createObjectStore(READINGS_STORE, { autoIncrement: true });
          store.createIndex('datasetId', 'datasetId', { unique: false });
          store.createIndex('timeMs', 'timeMs', { unique: false });
          store.createIndex('datasetId_timeMs', ['datasetId', 'timeMs'], { unique: false });
        }
        if (!db.objectStoreNames.contains(DATASETS_STORE)) {
          db.createObjectStore(DATASETS_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

/* ── Dataset operations ───────────────────────────────────── */

export async function saveDataset(info: DatasetInfo): Promise<void> {
  const db = await getDb();
  await db.put(DATASETS_STORE, info);
}

export async function listDatasets(): Promise<DatasetInfo[]> {
  const db = await getDb();
  return db.getAll(DATASETS_STORE);
}

export async function getDataset(id: string): Promise<DatasetInfo | undefined> {
  const db = await getDb();
  return db.get(DATASETS_STORE, id);
}

export async function deleteDataset(id: string): Promise<void> {
  const db = await getDb();

  // Delete all readings belonging to this dataset
  const tx = db.transaction(READINGS_STORE, 'readwrite');
  const index = tx.store.index('datasetId');
  let cursor = await index.openCursor(IDBKeyRange.only(id));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;

  // Delete the dataset metadata
  await db.delete(DATASETS_STORE, id);
}

/* ── Reading operations ───────────────────────────────────── */

/**
 * Save readings in chunks to avoid blocking the main thread.
 * Calls `onProgress` after each chunk so the UI can update.
 */
export async function saveReadings(
  readings: SensorReading[],
  datasetId: string,
  onProgress?: (saved: number, total: number) => void,
): Promise<void> {
  const db = await getDb();
  const total = readings.length;

  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunk = readings.slice(i, i + CHUNK_SIZE);
    const tx = db.transaction(READINGS_STORE, 'readwrite');
    for (const reading of chunk) {
      await tx.store.add({ ...reading, datasetId });
    }
    await tx.done;

    // Yield to the event loop so the UI stays responsive
    if (onProgress) {
      const saved = Math.min(i + CHUNK_SIZE, total);
      onProgress(saved, total);
    }
    await yieldToMain();
  }
}

/** Load every reading across all datasets. */
export async function loadAllReadings(): Promise<SensorReading[]> {
  const db = await getDb();
  return db.getAll(READINGS_STORE);
}

/** Load readings belonging to a specific dataset. */
export async function loadReadingsByDataset(datasetId: string): Promise<SensorReading[]> {
  const db = await getDb();
  return db.getAllFromIndex(READINGS_STORE, 'datasetId', datasetId);
}

/* ── Duplicate detection ──────────────────────────────────── */

/**
 * Check whether a dataset with the same fingerprint already exists.
 * Fingerprint = (readingCount, firstTimeMs, lastTimeMs).
 */
export async function checkDuplicateDataset(
  firstTimeMs: number | null,
  lastTimeMs: number | null,
  readingCount: number,
): Promise<DatasetInfo | null> {
  const datasets = await listDatasets();
  return (
    datasets.find(
      (ds) =>
        ds.readingCount === readingCount &&
        ds.firstTimeMs === firstTimeMs &&
        ds.lastTimeMs === lastTimeMs,
    ) ?? null
  );
}

/* ── Bulk clear ───────────────────────────────────────────── */

export async function clearAllImportedData(): Promise<void> {
  const db = await getDb();
  await db.clear(READINGS_STORE);
  await db.clear(DATASETS_STORE);
}

/* ── Helpers ──────────────────────────────────────────────── */

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
