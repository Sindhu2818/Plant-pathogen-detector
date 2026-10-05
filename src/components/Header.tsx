import { Leaf, RefreshCw, Wifi, WifiOff, Database, Upload, Download, FolderOpen } from 'lucide-react';
import type { ConnectionState } from '../types';

interface HeaderProps {
  isDemo: boolean;
  toggleDemo: () => void;
  refresh: () => void;
  lastUpdated: Date | null;
  isLoading: boolean;
  connectionState: ConnectionState;
  onImportCsv: () => void;
  onExportCsv: () => void;
  onToggleDatasets: () => void;
  showDatasets: boolean;
}

export function Header({
  isDemo,
  toggleDemo,
  refresh,
  lastUpdated,
  isLoading,
  connectionState,
  onImportCsv,
  onExportCsv,
  onToggleDatasets,
  showDatasets,
}: HeaderProps) {
  return (
    <header className="mb-6">
      {/* ── Main bar ──────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-sage-200/40 shadow-soft p-5 sm:p-6 mb-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-sage-100 rounded-xl flex items-center justify-center shadow-sm">
              <Leaf className="w-7 h-7 text-sage-500" strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-gray-800 tracking-tight leading-tight">
                PlantSense
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 font-light tracking-wide">
                Multisensor Plant Monitoring
              </p>
            </div>
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Data-source badge */}
            {connectionState === 'live' ? (
              <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-600 text-xs font-medium px-3 py-1.5 rounded-full border border-green-200/50">
                <Wifi className="w-3.5 h-3.5" />
                ThingsBoard: Connected
              </span>
            ) : connectionState === 'offline' ? (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 text-xs font-medium px-3 py-1.5 rounded-full border border-amber-200/50">
                <WifiOff className="w-3.5 h-3.5" />
                Offline · Local data
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-500 text-xs font-medium px-3 py-1.5 rounded-full border border-red-200/50">
                <Database className="w-3.5 h-3.5" />
                No data
              </span>
            )}

            {/* Last updated */}
            {lastUpdated && (
              <span className="text-xs text-gray-400 whitespace-nowrap">
                Last updated:{' '}
                <span className="font-medium text-gray-500">
                  {lastUpdated.toLocaleTimeString()}
                </span>
              </span>
            )}

            {/* Import CSV */}
            <button
              onClick={onImportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium
                         bg-sage-50 text-sage-600 border border-sage-200/50
                         hover:bg-sage-100 active:scale-95 transition-all duration-200"
            >
              <Upload className="w-3.5 h-3.5" />
              Import CSV
            </button>

            {/* Export CSV */}
            <button
              onClick={onExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium
                         bg-sage-50 text-sage-600 border border-sage-200/50
                         hover:bg-sage-100 active:scale-95 transition-all duration-200"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            {/* Datasets toggle */}
            <button
              onClick={onToggleDatasets}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 active:scale-95
                ${showDatasets
                  ? 'bg-sage-100 text-sage-700 border-sage-300/60'
                  : 'bg-sage-50 text-sage-600 border-sage-200/50 hover:bg-sage-100'
                }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Datasets
            </button>

            {/* Demo toggle */}
            <button
              onClick={toggleDemo}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200
                ${
                  isDemo
                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                }`}
            >
              <span
                className={`w-2 h-2 rounded-full transition-colors ${
                  isDemo ? 'bg-amber-400' : 'bg-gray-300'
                }`}
              />
              Demo {isDemo ? 'ON' : 'OFF'}
            </button>

            {/* Refresh */}
            <button
              onClick={refresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium
                         bg-sage-100 text-sage-700 border border-sage-200/50
                         hover:bg-sage-200 active:scale-95 transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Demo banner ───────────────────────────────────── */}
      {isDemo && (
        <div className="bg-amber-50/80 border border-amber-200/50 rounded-xl px-4 py-2.5 text-center text-sm text-amber-700 font-medium tracking-wide">
          🔬 DEMO DATA — Sample values for UI testing
        </div>
      )}
    </header>
  );
}
