import { useState, useEffect, useCallback, useRef } from 'react';
import type { SensorReading, ConnectionState, DatasetInfo, ImportProgress, ImportOptions } from '../types';
import { loadAllData, importCsvFile, deleteDataset as deleteDs, exportCombinedCsv as exportCsv } from '../services/dataManager';
import { generateDemoReading, generateDemoHistory } from '../services/demoData';

const REFRESH_INTERVAL = Number(import.meta.env.VITE_REFRESH_INTERVAL_MS || 10_000);

export function useSensorData() {
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('offline');
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Fetch unified data ─────────────────────────────────── */

  const fetchData = useCallback(async () => {
    if (isDemo) return; // demo mode handles its own data
    setIsLoading(true);
    try {
      const result = await loadAllData();
      setHistory(result.readings);
      setLatestReading(result.latestReading);
      setConnectionState(result.connectionState);
      setDatasets(result.datasets);

      // Only show ThingsBoard errors as warnings, not fatal errors
      if (result.connectionState === 'offline' && result.readings.length > 0) {
        setError(null); // We have data — don't alarm the user
      } else if (result.connectionState === 'no-data') {
        setError('No data available — import a CSV or connect ThingsBoard.');
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

  /* ── Demo mode ──────────────────────────────────────────── */

  const fetchDemoData = useCallback(() => {
    const demoHistory = generateDemoHistory(50);
    setHistory(demoHistory);
    setLatestReading(generateDemoReading());
    setConnectionState('offline');
    setDatasets([]);
    setError(null);
    setLastUpdated(new Date());
  }, []);

  /* ── Initial load + auto-refresh ────────────────────────── */

  useEffect(() => {
    if (isDemo) {
      fetchDemoData();
      return;
    }

    void fetchData();

    // Auto-refresh ThingsBoard every REFRESH_INTERVAL
    intervalRef.current = setInterval(() => {
      void fetchData();
    }, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isDemo, fetchData, fetchDemoData]);

  /* ── Actions ────────────────────────────────────────────── */

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
          // Reload data to include the newly imported dataset
          await fetchData();
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Import failed.';
        setImportProgress({ phase: 'error', current: 0, total: 0, message });
        return { success: false, datasetId: '', message };
      }
    },
    [fetchData],
  );

  const deleteCsvDataset = useCallback(
    async (id: string) => {
      await deleteDs(id);
      await fetchData();
    },
    [fetchData],
  );

  const exportCombinedCsv = useCallback(() => {
    exportCsv(history);
  }, [history]);

  const clearImportProgress = useCallback(() => setImportProgress(null), []);

  return {
    // Existing API (preserved)
    latestReading,
    history,
    isDemo,
    toggleDemo,
    refresh,
    lastUpdated,
    error,
    isLoading,
    // New API (additive)
    connectionState,
    datasets,
    importCsv,
    importProgress,
    clearImportProgress,
    deleteCsvDataset,
    exportCombinedCsv,
  };
}
