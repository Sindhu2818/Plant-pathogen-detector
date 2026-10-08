import { useState } from 'react';
import { Database, Activity, X, CheckCircle2 } from 'lucide-react';
import { Header } from './components/Header';
import { SensorGrid } from './components/SensorGrid';
import { HistoryChart } from './components/HistoryChart';
import { ReadingsTable } from './components/ReadingsTable';
import { ConnectionStatus } from './components/ConnectionStatus';
import { CsvImportDialog } from './components/CsvImportDialog';
import { DatasetPanel } from './components/DatasetPanel';
import { useSensorData } from './hooks/useSensorData';

export default function App() {
  const {
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
    importCsv,
    importProgress,
    clearImportProgress,
    exportCombinedCsv,
    loadStoredDataset,
    returnToLiveSession,
    deleteStoredDataset,
    downloadStoredDataset,
    finalizeLiveSession,
    refreshStoredDatasets,
  } = useSensorData();

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDatasets, setShowDatasets] = useState(false);

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header with title, badges, controls */}
        <Header
          isDemo={isDemo}
          toggleDemo={toggleDemo}
          refresh={refresh}
          lastUpdated={lastUpdated}
          isLoading={isLoading}
          connectionState={connectionState}
          onImportCsv={() => setShowImportDialog(true)}
          onExportCsv={exportCombinedCsv}
          onToggleDatasets={() =>
            setShowDatasets((prev) => {
              const next = !prev;
              if (next) void refreshStoredDatasets();
              return next;
            })
          }
          showDatasets={showDatasets}
        />

        {/* Connection status / error banner */}
        <ConnectionStatus error={error} connectionState={connectionState} />

        {/* Session Inactivity / Persistence Notification Banner */}
        {sessionMessage && (
          <div className="bg-sage-50 border border-sage-200/80 rounded-2xl p-4 mb-6 flex items-start justify-between gap-3 shadow-soft animate-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0" />
              <p className="text-sm font-medium text-sage-800">{sessionMessage}</p>
            </div>
            <button
              onClick={() => setSessionMessage(null)}
              className="p-1 rounded-lg hover:bg-sage-100 text-sage-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Dataset management panel (IndexedDB SmartFarmingDB) */}
        <DatasetPanel
          storedDatasets={storedDatasets}
          activeDatasetId={activeDataset?.id ?? null}
          onSelectDataset={loadStoredDataset}
          onReturnToLive={returnToLiveSession}
          onDeleteDataset={deleteStoredDataset}
          onDownloadCsv={downloadStoredDataset}
          onFinalizeLiveSession={() => finalizeLiveSession('manual')}
          liveRecordsCount={liveRecords.length}
          open={showDatasets}
        />

        {/* Active Historical Dataset Viewing Banner */}
        {activeDataset && (
          <div className="bg-sage-50/90 border border-sage-200/70 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-soft">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-sage-100 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <Database className="w-5 h-5 text-sage-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  Viewing Historical Dataset: <span className="text-sage-700">{activeDataset.datasetName}</span>
                </p>
                <p className="text-xs text-gray-500 font-light">
                  {activeDataset.recordCount.toLocaleString()} records · {activeDataset.startTime} → {activeDataset.endTime}
                </p>
              </div>
            </div>
            <button
              onClick={returnToLiveSession}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-sage-600 text-white hover:bg-sage-700 active:scale-95 transition-all shadow-sm whitespace-nowrap"
            >
              <Activity className="w-3.5 h-3.5" />
              Return to Live Session
            </button>
          </div>
        )}

        {/* Live sensor cards (always displays real-time telemetry) */}
        <SensorGrid reading={latestReading} />

        {/* Historical chart + table (live buffer or selected IndexedDB dataset) */}
        {history.length > 0 ? (
          <>
            <HistoryChart history={history} />
            <ReadingsTable history={history} />
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-sage-200/80 p-8 mb-8 text-center">
            <p className="text-sm font-medium text-gray-600">
              {activeDataset ? 'This dataset could not be displayed.' : 'No live-session records yet.'}
            </p>
            <p className="text-xs text-gray-400 font-light mt-1">
              Sensor cards stay live. Open Stored Datasets to load a historical graph and table from IndexedDB.
            </p>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center pt-4 pb-8">
          <p className="text-xs text-gray-400">
            PlantSense · Multisensor Plant Monitoring Dashboard
          </p>
          <p className="text-[11px] text-gray-300 mt-1">
            ESP32 · SmartFarmingDB (IndexedDB) · ThingsBoard · React
          </p>
        </footer>
      </div>

      {/* CSV Import Dialog (modal) */}
      <CsvImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImport={importCsv}
        importProgress={importProgress}
        clearProgress={clearImportProgress}
      />
    </div>
  );
}
