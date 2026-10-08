import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { SensorReading, ConnectionState, DatasetInfo, ImportProgress, ImportOptions } from '../types';
import { getReadingTime } from '../types';
import { loadAllData, importCsvFile, deleteDataset as deleteDs, exportCombinedCsv as exportCsv } from '../services/dataManager';
import { generateDemoReading, generateDemoHistory } from '../services/demoData';
import {
  saveDataset,
  getAllDatasets,
  getDataset,
  deleteDataset as dbDeleteDataset,
  exportDatasetAsCSV,
  normalizeToStoredDataset,
  datasetRowsToReadings,
  type StoredDataset,
} from '../db/datasetDB';

const REFRESH_INTERVAL = Number(import.meta.env.VITE_REFRESH_INTERVAL_MS || 10_000);
const INACTIVITY_TIMEOUT_MS = Number(import.meta.env.VITE_INACTIVITY_TIMEOUT_MS || 20 * 60 * 1000);

function newSessionId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function readingIdentity(r: SensorReading): string {
  return `${r.timestamp}|${r.timeMs ?? ''}`;
}

export function useSensorData() {
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [liveRecords, setLiveRecords] = useState<SensorReading[]>([]);
  const [activeDataset, setActiveDataset] = useState<StoredDataset | null>(null);
  const [storedDatasets, setStoredDatasets] = useState<StoredDataset[]>([]);

  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('offline');
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lastLiveActivityRef = useRef<number>(Date.now());
  const hasNewLiveRecordsRef = useRef<boolean>(false);
  const isFinalizingRef = useRef<boolean>(false);
  const liveRecordsRef = useRef<SensorReading[]>([]);
  const liveSessionIdRef = useRef<string>(newSessionId());
  const exportedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    liveRecordsRef.current = liveRecords;
  }, [liveRecords]);

  /* ── 1. Load Stored Datasets from IndexedDB (SmartFarmingDB) ── */

  const refreshStoredDatasets = useCallback(async () => {
    try {
      const all = await getAllDatasets();
      setStoredDatasets(all);
      return all;
    } catch (err) {
      console.error('Failed to load datasets from SmartFarmingDB:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load stored datasets from IndexedDB.',
      );
      return [];
    }
  }, []);

  useEffect(() => {
    void refreshStoredDatasets();
  }, [refreshStoredDatasets]);

  /* ── 2. Fetch Live / Unified Data ─────────────────────────── */

  const fetchData = useCallback(async () => {
    if (isDemo) return;
    setIsLoading(true);
    try {
      const result = await loadAllData();

      if (result.latestReading) {
        setLatestReading(result.latestReading);
      }

      setConnectionState(result.connectionState);
      setDatasets(result.datasets);

      // Live session is only the buffer of new telemetry since this dashboard session
      // started (or since the last finalize). Do not dump ThingsBoard/CSV history into it.
      setLiveRecords((prev) => {
        const incoming = result.latestReading;
        if (!incoming || incoming.source !== 'thingsboard') {
          return prev;
        }
        const lastItem = prev[prev.length - 1];
        if (lastItem && readingIdentity(lastItem) === readingIdentity(incoming)) {
          return prev;
        }
        if (lastItem && getReadingTime(incoming) <= getReadingTime(lastItem)) {
          return prev;
        }
        lastLiveActivityRef.current = Date.now();
        hasNewLiveRecordsRef.current = true;
        return [...prev, incoming];
      });

      if (result.connectionState === 'no-data') {
        setError((prev) => prev ?? 'No data available — import a CSV or connect ThingsBoard.');
      } else {
        setError(null);
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to retrieve sensor data.');
    } finally {
      setIsLoading(false);
    }
  }, [isDemo]);

  /* ── 3. Demo Mode ─────────────────────────────────────────── */

  const fetchDemoData = useCallback(() => {
    const demoReading = generateDemoReading();
    setLatestReading(demoReading);
    setLiveRecords((prev) => {
      const next = [...prev, demoReading];
      lastLiveActivityRef.current = Date.now();
      hasNewLiveRecordsRef.current = true;
      return next.slice(-200);
    });
    setConnectionState('offline');
    setError(null);
    setLastUpdated(new Date());
  }, []);

  /* ── 4. Automatic & Manual Session Finalization ───────────── */

  const beginNewLiveSession = useCallback(() => {
    setLiveRecords([]);
    liveRecordsRef.current = [];
    hasNewLiveRecordsRef.current = false;
    lastLiveActivityRef.current = Date.now();
    liveSessionIdRef.current = newSessionId();
  }, []);

  const finalizeLiveSession = useCallback(
    async (reason: 'inactivity' | 'manual' = 'manual', customName?: string) => {
      const records = liveRecordsRef.current;

      // Empty-session protection
      if (records.length === 0) {
        return;
      }

      const sessionId = liveSessionIdRef.current;

      // Prevent the same live session from being exported twice
      if (exportedSessionIdRef.current === sessionId || isFinalizingRef.current) {
        return;
      }
      isFinalizingRef.current = true;

      try {
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const name =
          customName ||
          (reason === 'inactivity'
            ? `Live Session (Auto-saved ${dateStr} ${timeStr})`
            : `Live Session (${dateStr} ${timeStr})`);

        const dataset = normalizeToStoredDataset(name, records);

        // IndexedDB first — never clear live data if this fails
        await saveDataset(dataset);
        exportedSessionIdRef.current = sessionId;

        let csvOk = true;
        try {
          exportDatasetAsCSV(dataset);
        } catch (csvErr) {
          csvOk = false;
          console.error('CSV download failed after IndexedDB save:', csvErr);
        }

        beginNewLiveSession();

        const updated = await refreshStoredDatasets();
        setStoredDatasets(updated);

        setSessionMessage(
          csvOk
            ? reason === 'inactivity'
              ? `Live session inactive for 20 minutes — saved ${dataset.recordCount.toLocaleString()} readings to IndexedDB and downloaded CSV.`
              : `Live session finalized — saved ${dataset.recordCount.toLocaleString()} readings to IndexedDB and downloaded CSV.`
            : `Saved ${dataset.recordCount.toLocaleString()} readings to IndexedDB, but CSV download failed. Use Download CSV in Stored Datasets.`,
        );
        setError(null);
      } catch (err) {
        console.error('Failed to finalize live session:', err);
        setError(
          err instanceof Error
            ? `Failed to save dataset to IndexedDB. Live data was kept. ${err.message}`
            : 'Failed to save dataset to IndexedDB. Live data was kept — you can still export CSV manually.',
        );
      } finally {
        isFinalizingRef.current = false;
      }
    },
    [beginNewLiveSession, refreshStoredDatasets],
  );

  /* ── 5. Inactivity Monitor Interval ───────────────────────── */

  useEffect(() => {
    if (isDemo) return;

    inactivityCheckRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastLiveActivityRef.current;

      if (
        elapsed >= INACTIVITY_TIMEOUT_MS &&
        liveRecordsRef.current.length > 0 &&
        hasNewLiveRecordsRef.current &&
        exportedSessionIdRef.current !== liveSessionIdRef.current &&
        !isFinalizingRef.current
      ) {
        void finalizeLiveSession('inactivity');
      }
    }, 15_000);

    return () => {
      if (inactivityCheckRef.current) clearInterval(inactivityCheckRef.current);
    };
  }, [isDemo, finalizeLiveSession]);

  /* ── 6. Initial Load + Telemetry Auto-Refresh ─────────────── */

  useEffect(() => {
    if (isDemo) {
      const demoHistory = generateDemoHistory(50);
      setLiveRecords(demoHistory);
      setLatestReading(demoHistory[demoHistory.length - 1]);
      intervalRef.current = setInterval(fetchDemoData, 3000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }

    void fetchData();

    intervalRef.current = setInterval(() => {
      void fetchData();
    }, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isDemo, fetchData, fetchDemoData]);

  /* ── 7. Stored Dataset Actions ────────────────────────────── */

  const loadStoredDataset = useCallback(async (id: string) => {
    try {
      const dataset = await getDataset(id);
      if (!dataset) {
        setError('Could not find the requested dataset in IndexedDB.');
        return;
      }
      if (!dataset.rows || dataset.rows.length === 0) {
        setError(`Dataset "${dataset.datasetName}" could not be loaded (no rows in IndexedDB).`);
        return;
      }
      setActiveDataset(dataset);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dataset from IndexedDB.');
    }
  }, []);

  const returnToLiveSession = useCallback(() => {
    setActiveDataset(null);
  }, []);

  const deleteStoredDataset = useCallback(
    async (id: string) => {
      try {
        await dbDeleteDataset(id);
        try {
          await deleteDs(id);
        } catch {
          // Legacy plantsense DB may not have this id — ignore
        }
        const updated = await refreshStoredDatasets();
        setStoredDatasets(updated);

        if (activeDataset?.id === id) {
          setActiveDataset(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete dataset from IndexedDB.');
      }
    },
    [activeDataset, refreshStoredDatasets],
  );

  const downloadStoredDataset = useCallback((id: string) => {
    void (async () => {
      try {
        const dataset = await getDataset(id);
        if (dataset) {
          exportDatasetAsCSV(dataset);
        } else {
          setError('Dataset not found in IndexedDB.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to download dataset.');
      }
    })();
  }, []);

  /* ── 8. General Actions ───────────────────────────────────── */

  const toggleDemo = useCallback(() => setIsDemo((prev) => !prev), []);

  const refresh = useCallback(() => {
    if (isDemo) {
      fetchDemoData();
    } else {
      void fetchData();
    }
  }, [isDemo, fetchData, fetchDemoData]);

  const importCsv = useCallback(
    async (file: File, options: ImportOptions) => {
      setImportProgress({ phase: 'reading', current: 0, total: 0, message: 'Starting…' });
      try {
        const result = await importCsvFile(file, options, setImportProgress);
        if (result.success) {
          const updated = await refreshStoredDatasets();
          setStoredDatasets(updated);

          const imported = await getDataset(result.datasetId);
          if (imported) {
            setActiveDataset(imported);
          }
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Import failed.';
        setImportProgress({ phase: 'error', current: 0, total: 0, message });
        return { success: false, datasetId: '', message };
      }
    },
    [refreshStoredDatasets],
  );

  const clearImportProgress = useCallback(() => setImportProgress(null), []);

  const history = useMemo(() => {
    if (activeDataset) {
      return datasetRowsToReadings(activeDataset);
    }
    return liveRecords;
  }, [activeDataset, liveRecords]);

  const exportCombinedCsv = useCallback(() => {
    if (activeDataset) {
      exportDatasetAsCSV(activeDataset);
      return;
    }
    if (liveRecords.length > 0) {
      const dataset = normalizeToStoredDataset('Live Session Export', liveRecords);
      exportDatasetAsCSV(dataset);
      return;
    }
    exportCsv(history);
  }, [activeDataset, liveRecords, history]);

  return {
    latestReading,
    history,
    liveRecords,
    activeDataset,
    storedDatasets,
    isDemo,
    toggleDemo,
    refresh,
    lastUpdated,
    error,
    sessionMessage,
    setSessionMessage,
    isLoading,
    connectionState,
    datasets,
    importCsv,
    importProgress,
    clearImportProgress,
    deleteCsvDataset: deleteStoredDataset,
    exportCombinedCsv,
    loadStoredDataset,
    returnToLiveSession,
    deleteStoredDataset,
    downloadStoredDataset,
    finalizeLiveSession,
    refreshStoredDatasets,
  };
}
