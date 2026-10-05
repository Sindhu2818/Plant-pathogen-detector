import { useState } from 'react';
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
    isDemo,
    toggleDemo,
    refresh,
    lastUpdated,
    error,
    isLoading,
    connectionState,
    datasets,
    importCsv,
    importProgress,
    clearImportProgress,
    deleteCsvDataset,
    exportCombinedCsv,
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
          onToggleDatasets={() => setShowDatasets((prev) => !prev)}
          showDatasets={showDatasets}
        />

        {/* Connection status / error banner */}
        <ConnectionStatus error={error} connectionState={connectionState} />

        {/* Dataset management panel */}
        <DatasetPanel
          datasets={datasets}
          onDelete={deleteCsvDataset}
          open={showDatasets}
        />

        {/* Sensor cards */}
        <SensorGrid reading={latestReading} />

        {/* Historical chart + table (shown once data exists) */}
        {history.length > 0 && (
          <>
            <HistoryChart history={history} />
            <ReadingsTable history={history} />
          </>
        )}

        {/* Footer */}
        <footer className="text-center pt-4 pb-8">
          <p className="text-xs text-gray-400">
            PlantSense · Multisensor Plant Monitoring Dashboard
          </p>
          <p className="text-[11px] text-gray-300 mt-1">
            ESP32 · Historical CSV · ThingsBoard · React
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
