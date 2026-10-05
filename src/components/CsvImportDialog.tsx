import { useState, useRef, useCallback } from 'react';
import { Upload, X, Calendar, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import type { ImportProgress, ImportOptions } from '../types';

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (file: File, options: ImportOptions) => Promise<{ success: boolean; datasetId: string; message: string }>;
  importProgress: ImportProgress | null;
  clearProgress: () => void;
}

export function CsvImportDialog({ open, onClose, onImport, importProgress, clearProgress }: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [useStartTime, setUseStartTime] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setDuplicateWarning(null);
    clearProgress();
    if (selected && !datasetName) {
      setDatasetName(selected.name.replace(/\.csv$/i, ''));
    }
  };

  const handleImport = useCallback(
    async (forceImport = false) => {
      if (!file) return;
      setDuplicateWarning(null);

      const options: ImportOptions = {
        datasetName: datasetName || file.name.replace(/\.csv$/i, ''),
        forceImport,
      };
      if (useStartTime && startTime) {
        options.experimentStartTime = new Date(startTime);
      }

      const result = await onImport(file, options);
      if (!result.success && result.message.includes('already been imported')) {
        setDuplicateWarning(result.message);
      } else if (result.success) {
        // Auto-close after short delay on success
        setTimeout(() => {
          resetAndClose();
        }, 1500);
      }
    },
    [file, datasetName, useStartTime, startTime, onImport],
  );

  const resetAndClose = () => {
    setFile(null);
    setDatasetName('');
    setUseStartTime(false);
    setStartTime('');
    setDuplicateWarning(null);
    clearProgress();
    onClose();
  };

  if (!open) return null;

  const isImporting = importProgress && (importProgress.phase === 'reading' || importProgress.phase === 'parsing' || importProgress.phase === 'checking' || importProgress.phase === 'importing');
  const isComplete = importProgress?.phase === 'complete';
  const isError = importProgress?.phase === 'error' && !duplicateWarning;
  const progressPercent = importProgress && importProgress.total > 0
    ? Math.round((importProgress.current / importProgress.total) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget && !isImporting) resetAndClose(); }}>
      <div className="bg-white rounded-2xl border border-sage-200/40 shadow-soft-md w-full max-w-lg mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sage-100 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-sage-500" strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-gray-800">Import CSV</h2>
              <p className="text-xs text-gray-400 font-light">Import ESP32 sensor data from a CSV file</p>
            </div>
          </div>
          <button onClick={resetAndClose} disabled={!!isImporting} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* File picker */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-1.5">CSV File</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={!!isImporting}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border file:border-sage-200/50 file:text-xs file:font-medium file:bg-sage-50 file:text-sage-600 hover:file:bg-sage-100 file:cursor-pointer file:transition-colors disabled:opacity-50"
          />
        </div>

        {/* Dataset name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Dataset Name</label>
          <input
            type="text"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            placeholder="e.g. Experiment Day 1"
            disabled={!!isImporting}
            className="w-full px-3 py-2 text-sm border border-sage-200/50 rounded-xl bg-sage-50/30 focus:outline-none focus:ring-2 focus:ring-sage-300/60 disabled:opacity-50"
          />
        </div>

        {/* Experiment start time */}
        <div className="mb-5">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={useStartTime}
              onChange={(e) => setUseStartTime(e.target.checked)}
              disabled={!!isImporting}
              className="rounded border-sage-300 text-sage-500 focus:ring-sage-300"
            />
            <Calendar className="w-3.5 h-3.5" />
            Use Experiment Start Time
          </label>
          {useStartTime && (
            <div className="ml-6">
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={!!isImporting}
                className="w-full px-3 py-2 text-sm border border-sage-200/50 rounded-xl bg-sage-50/30 focus:outline-none focus:ring-2 focus:ring-sage-300/60 disabled:opacity-50"
              />
              <p className="text-[11px] text-gray-400 mt-1 font-light">
                Each reading's timestamp = start time + Time_ms offset
              </p>
            </div>
          )}
          {!useStartTime && (
            <p className="text-[11px] text-gray-400 ml-6 font-light">
              Readings will use original elapsed time (Time_ms)
            </p>
          )}
        </div>

        {/* Duplicate warning */}
        {duplicateWarning && (
          <div className="bg-amber-50/80 border border-amber-200/50 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-amber-700 font-medium">{duplicateWarning}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleImport(true)}
                    className="px-3 py-1 text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 rounded-full hover:bg-amber-200 transition-colors"
                  >
                    Import anyway
                  </button>
                  <button
                    onClick={() => { setDuplicateWarning(null); clearProgress(); }}
                    className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {importProgress && !duplicateWarning && (
          <div className={`rounded-xl px-4 py-3 mb-4 border ${
            isComplete ? 'bg-green-50/80 border-green-200/50' :
            isError ? 'bg-red-50/80 border-red-200/50' :
            'bg-sage-50/80 border-sage-200/50'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {isImporting && <Loader2 className="w-4 h-4 text-sage-500 animate-spin" />}
              {isComplete && <CheckCircle className="w-4 h-4 text-green-500" />}
              {isError && <AlertTriangle className="w-4 h-4 text-red-500" />}
              <p className={`text-sm font-medium ${
                isComplete ? 'text-green-700' : isError ? 'text-red-600' : 'text-sage-700'
              }`}>
                {importProgress.message}
              </p>
            </div>
            {isImporting && importProgress.total > 0 && (
              <div className="w-full bg-sage-200/50 rounded-full h-2 mt-2">
                <div
                  className="bg-sage-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={resetAndClose}
            disabled={!!isImporting}
            className="px-4 py-2 text-sm font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {isComplete ? 'Close' : 'Cancel'}
          </button>
          {!isComplete && !duplicateWarning && (
            <button
              onClick={() => handleImport(false)}
              disabled={!file || !!isImporting}
              className="px-4 py-2 text-sm font-medium text-white bg-sage-500 border border-sage-600 rounded-xl hover:bg-sage-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? 'Importing…' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
