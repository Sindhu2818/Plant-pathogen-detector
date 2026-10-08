import { useState } from 'react';
import { Database, Trash2, Download, Eye, CheckCircle2, Activity, Save } from 'lucide-react';
import type { StoredDataset } from '../db/datasetDB';

interface DatasetPanelProps {
  storedDatasets: StoredDataset[];
  activeDatasetId: string | null;
  onSelectDataset: (id: string) => void;
  onReturnToLive: () => void;
  onDeleteDataset: (id: string) => void;
  onDownloadCsv: (id: string) => void;
  onFinalizeLiveSession?: () => void;
  liveRecordsCount: number;
  open: boolean;
}

export function DatasetPanel({
  storedDatasets,
  activeDatasetId,
  onSelectDataset,
  onReturnToLive,
  onDeleteDataset,
  onDownloadCsv,
  onFinalizeLiveSession,
  liveRecordsCount,
  open,
}: DatasetPanelProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!open) return null;

  return (
    <section className="bg-white rounded-2xl border border-sage-200/40 shadow-soft p-5 sm:p-6 mb-8 animate-in">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 pb-4 border-b border-sage-100/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sage-100 rounded-xl flex items-center justify-center shadow-sm">
            <Database className="w-5 h-5 text-sage-600" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-gray-800">Stored Datasets</h2>
            <p className="text-xs text-gray-400 font-light">
              IndexedDB persistent storage (<span className="font-mono text-sage-600">SmartFarmingDB</span>) · {storedDatasets.length} dataset{storedDatasets.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Live Session Status & Manual Save Control */}
        <div className="flex items-center gap-2">
          {activeDatasetId ? (
            <button
              onClick={onReturnToLive}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-sage-50 text-sage-700 border border-sage-200 hover:bg-sage-100 transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-sage-600" />
              Return to Live Session ({liveRecordsCount} buffered)
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-sage-600 bg-sage-50 px-2.5 py-1 rounded-full border border-sage-200/50">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live Session Active ({liveRecordsCount} records)
              </span>
              {onFinalizeLiveSession && liveRecordsCount > 0 && (
                <button
                  onClick={onFinalizeLiveSession}
                  title="Manually finalize session, save to IndexedDB and download CSV"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-sage-500 text-white hover:bg-sage-600 transition-colors shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Session Now
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Dataset List (Requirement 16: Sorted newest first) ── */}
      {storedDatasets.length === 0 ? (
        <div className="text-center py-8 bg-sage-50/30 rounded-xl border border-dashed border-sage-200">
          <Database className="w-8 h-8 text-sage-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600">No stored datasets yet</p>
          <p className="text-xs text-gray-400 font-light mt-1">
            Historical datasets are saved when the 20-minute inactivity timer triggers, when you import a CSV, or when you click "Save Session Now".
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {storedDatasets.map((ds) => {
            const isActive = activeDatasetId === ds.id;
            const isConfirmingDelete = confirmDeleteId === ds.id;

            return (
              <div
                key={ds.id}
                className={`rounded-xl border transition-all duration-200 p-4 ${
                  isActive
                    ? 'border-sage-400 bg-sage-50/50 shadow-sm ring-1 ring-sage-300'
                    : 'border-sage-100 bg-white hover:border-sage-200 hover:bg-sage-50/20'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  {/* Info block */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800 text-sm truncate">
                        {ds.datasetName}
                      </span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-sage-200/70 text-sage-800 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-sage-600" />
                          Currently Viewing
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 font-light">
                      <span>
                        Records: <strong className="font-medium text-gray-700 tabular-nums">{ds.recordCount.toLocaleString()}</strong>
                      </span>
                      <span className="text-gray-300">·</span>
                      <span>
                        Date: <strong className="font-medium text-gray-700">{new Date(ds.createdAt).toLocaleDateString()}</strong>
                      </span>
                      <span className="text-gray-300">·</span>
                      <span>
                        Time: <strong className="font-medium text-gray-700">{ds.startTime}</strong> → <strong className="font-medium text-gray-700">{ds.endTime}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* View Button (Requirement 16) */}
                    <button
                      onClick={() => onSelectDataset(ds.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-sage-600 text-white shadow-sm'
                          : 'bg-sage-100 text-sage-700 hover:bg-sage-200'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {isActive ? 'Viewing' : 'View in Charts'}
                    </button>

                    {/* Download CSV Button (Requirement 18) */}
                    <button
                      onClick={() => onDownloadCsv(ds.id)}
                      title="Reconstruct and download CSV from IndexedDB"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-gray-500" />
                      Download CSV
                    </button>

                    {/* Delete with Confirmation (Requirement 17) */}
                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-lg border border-red-200">
                        <span className="text-[11px] text-red-600 px-1 font-medium max-w-[180px] leading-tight">
                          Delete this stored dataset? This cannot be undone.
                        </span>
                        <button
                          onClick={() => {
                            onDeleteDataset(ds.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 text-[11px] font-semibold bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 text-[11px] font-medium bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(ds.id)}
                        title="Delete this stored dataset"
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
