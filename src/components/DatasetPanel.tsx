import { Database, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { DatasetInfo } from '../types';
import { useState } from 'react';

function formatTimeMs(ms: number | null): string {
  if (ms == null) return '—';
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

interface DatasetPanelProps {
  datasets: DatasetInfo[];
  onDelete: (id: string) => void;
  open: boolean;
}

export function DatasetPanel({ datasets, onDelete, open }: DatasetPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (!open) return null;

  return (
    <section className="bg-white rounded-2xl border border-sage-200/30 shadow-soft p-5 sm:p-6 mb-8 animate-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-sage-100 rounded-lg flex items-center justify-center">
          <Database className="w-4 h-4 text-sage-500" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-gray-800">Datasets</h2>
          <p className="text-xs text-gray-400 font-light">{datasets.length} dataset{datasets.length !== 1 ? 's' : ''} loaded</p>
        </div>
      </div>

      {datasets.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4 font-light">
          No datasets imported yet. Use "Import CSV" to add sensor data.
        </p>
      ) : (
        <div className="space-y-2">
          {datasets.map((ds) => (
            <div
              key={ds.id}
              className="border border-sage-100/60 rounded-xl overflow-hidden"
            >
              {/* Summary row */}
              <button
                onClick={() => setExpandedId(expandedId === ds.id ? null : ds.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-sage-50/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                    ds.source === 'bundled'
                      ? 'bg-powder-50 text-powder-400 border border-powder-200/50'
                      : ds.source === 'thingsboard'
                      ? 'bg-green-50 text-green-600 border border-green-200/50'
                      : 'bg-sage-50 text-sage-600 border border-sage-200/50'
                  }`}>
                    {ds.source === 'bundled' ? 'Bundled' : ds.source === 'thingsboard' ? 'TB' : 'CSV'}
                  </span>
                  <span className="text-sm font-medium text-gray-700 truncate">{ds.name}</span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {ds.readingCount.toLocaleString()} readings
                  </span>
                </div>
                {expandedId === ds.id ? (
                  <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
              </button>

              {/* Expanded details */}
              {expandedId === ds.id && (
                <div className="px-4 pb-3 pt-1 border-t border-sage-100/40 bg-sage-50/20">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
                    <div>
                      <span className="text-gray-400">Time range:</span>{' '}
                      <span className="text-gray-600 font-medium">
                        {formatTimeMs(ds.firstTimeMs)} → {formatTimeMs(ds.lastTimeMs)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Imported:</span>{' '}
                      <span className="text-gray-600 font-medium">{formatDate(ds.importedAt)}</span>
                    </div>
                    {ds.experimentStartTime && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Experiment start:</span>{' '}
                        <span className="text-gray-600 font-medium">{formatDate(ds.experimentStartTime)}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-400">Dataset ID:</span>{' '}
                      <span className="text-gray-500 font-mono text-[10px]">{ds.id}</span>
                    </div>
                  </div>

                  {/* Delete */}
                  {ds.source !== 'thingsboard' && (
                    <>
                      {confirmDelete === ds.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-600 font-medium">Delete this dataset?</span>
                          <button
                            onClick={() => { onDelete(ds.id); setConfirmDelete(null); setExpandedId(null); }}
                            className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded-full hover:bg-red-100 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200 rounded-full hover:bg-gray-100 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(ds.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-red-500 bg-red-50/50 border border-red-200/50 rounded-full hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete dataset
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
