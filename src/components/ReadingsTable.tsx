import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SENSOR_CONFIGS } from '../types';
import type { SensorReading } from '../types';

const PAGE_SIZE = 100;

function formatElapsed(ms: number | null | undefined): string {
  if (ms == null) return '—';
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days ? `${days}d ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function sourceLabel(source?: string): string {
  if (source === 'thingsboard') return 'ThingsBoard';
  if (source === 'bundled') return 'Bundled';
  if (source === 'csv') return 'CSV';
  return '—';
}

function sourceBadgeClasses(source?: string): string {
  if (source === 'thingsboard') return 'bg-green-50 text-green-600 border-green-200/50';
  if (source === 'bundled') return 'bg-powder-50 text-powder-400 border-powder-200/50';
  return 'bg-sage-50 text-sage-600 border-sage-200/50';
}

interface ReadingsTableProps { history: SensorReading[]; }

export function ReadingsTable({ history }: ReadingsTableProps) {
  const [page, setPage] = useState(0);

  // Reverse so newest is first, then paginate
  const reversed = [...history].reverse();
  const totalPages = Math.max(1, Math.ceil(reversed.length / PAGE_SIZE));
  // Reset page if it goes out of bounds (e.g. after data changes)
  const safePage = Math.min(page, totalPages - 1);
  const visible = reversed.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const goToPage = (p: number) => setPage(Math.max(0, Math.min(p, totalPages - 1)));

  return (
    <section className="bg-white rounded-2xl border border-sage-200/30 shadow-soft overflow-hidden mb-8">
      <div className="p-5 sm:p-6 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-gray-800">Readings Table</h2>
          <p className="text-xs text-gray-400 font-light">
            Page {safePage + 1} of {totalPages} · {history.length.toLocaleString()} total records
          </p>
        </div>
        {/* Pagination controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-sage-50 text-sage-600 border border-sage-200/50 hover:bg-sage-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>
          <span className="text-xs text-gray-400 tabular-nums px-1">{safePage + 1} / {totalPages}</span>
          <button
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage >= totalPages - 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-sage-50 text-sage-600 border border-sage-200/50 hover:bg-sage-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1400px]">
          <thead><tr className="bg-sage-50/50 border-y border-sage-100/60">
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Elapsed</th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Source</th>
            {SENSOR_CONFIGS.map((c) => <th key={c.key} className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{c.displayName}</th>)}
          </tr></thead>
          <tbody>{visible.map((reading, i) => (
            <tr key={`${reading.timeMs}-${reading.source}-${i}`} className={`border-b border-gray-50 transition-colors hover:bg-sage-50/20 ${i % 2 === 0 ? 'bg-white' : 'bg-cream-50/40'}`}>
              <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap font-medium">{formatElapsed(reading.timeMs)}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${sourceBadgeClasses(reading.source)}`}>
                  {sourceLabel(reading.source)}
                </span>
              </td>
              {SENSOR_CONFIGS.map((c) => { const val = reading[c.key]; return <td key={c.key} className="text-right px-4 py-2.5 text-xs whitespace-nowrap"><span className="font-medium text-gray-700">{formatValue(val)}</span>{val != null && <span className="text-gray-400 font-normal ml-1 text-[10px]">{c.unit}</span>}</td>; })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
