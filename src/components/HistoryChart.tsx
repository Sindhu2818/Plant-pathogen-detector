import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SENSOR_CONFIGS, getReadingTime } from '../types';
import type { SensorKey, SensorReading, TimeRangeKey } from '../types';
import {
  TIME_RANGE_LIST,
  TIME_RANGE_CONFIGS,
  calculateSensorDomain,
  formatReadingTimePoint,
  formatAxisTime,
} from '../utils/chartScaling';

interface HistoryChartProps {
  history: SensorReading[];
}

export function HistoryChart({ history }: HistoryChartProps) {
  const [selectedSensor, setSelectedSensor] = useState<SensorKey>('temperature');
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('3H');

  const config = SENSOR_CONFIGS.find((c) => c.key === selectedSensor)!;

  // Build a source summary string for the subtitle
  const sourceSummary = useMemo(() => {
    const sources = new Set<string>();
    for (const r of history) {
      if (r.source === 'thingsboard') sources.add('ThingsBoard');
      else if (r.source === 'csv') sources.add('CSV Import');
      else if (r.source === 'bundled') sources.add('Bundled CSV');
      else sources.add('CSV');
    }
    return sources.size > 0 ? [...sources].join(' + ') : 'No data';
  }, [history]);

  // 1. Time-range filtering based on actual timestamp / timeMs
  const { filteredReadings, rangeLabel, fromStr, toStr } = useMemo(() => {
    if (history.length === 0) {
      return {
        filteredReadings: [] as SensorReading[],
        rangeLabel: TIME_RANGE_CONFIGS[timeRange].fullLabel,
        fromStr: '',
        toStr: '',
      };
    }

    const durationMs = TIME_RANGE_CONFIGS[timeRange].durationMs;

    if (durationMs === null) {
      // "ALL" Data: entire dataset
      const first = history[0];
      const last = history[history.length - 1];
      return {
        filteredReadings: history,
        rangeLabel: 'All Data',
        fromStr: formatReadingTimePoint(first),
        toStr: formatReadingTimePoint(last),
      };
    }

    // Reference point: newest timestamp across the currently available dataset
    let latestTime = getReadingTime(history[history.length - 1]);
    for (let i = history.length - 2; i >= 0; i--) {
      const t = getReadingTime(history[i]);
      if (t > latestTime) latestTime = t;
    }

    const startTime = latestTime - durationMs;
    const filtered = history.filter((r) => getReadingTime(r) >= startTime);

    // If dataset contains less than the selected time range of data, display all available data
    const finalReadings = filtered.length > 0 ? filtered : history;
    const isShowingAll = finalReadings.length === history.length && timeRange !== 'ALL';

    const first = finalReadings[0];
    const last = finalReadings[finalReadings.length - 1];

    return {
      filteredReadings: finalReadings,
      rangeLabel: isShowingAll
        ? `${TIME_RANGE_CONFIGS[timeRange].fullLabel} (All available data)`
        : TIME_RANGE_CONFIGS[timeRange].fullLabel,
      fromStr: formatReadingTimePoint(first),
      toStr: formatReadingTimePoint(last),
    };
  }, [history, timeRange]);

  // 2. Dynamic Y-axis domain & summary stats calculated AFTER time filtering
  const { yDomain, stats } = useMemo(() => {
    const validValues = filteredReadings
      .map((r) => r[selectedSensor])
      .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));

    if (validValues.length === 0) {
      return {
        yDomain: [0, 100] as [number, number],
        stats: { min: null, max: null, avg: null, current: null },
      };
    }

    let min = validValues[0];
    let max = validValues[0];
    let sum = 0;
    for (let i = 0; i < validValues.length; i++) {
      const v = validValues[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    const avg = sum / validValues.length;
    const current = validValues[validValues.length - 1];

    const domain = calculateSensorDomain(selectedSensor, validValues);

    return {
      yDomain: domain,
      stats: { min, max, avg, current },
    };
  }, [filteredReadings, selectedSensor]);

  // 3. Downsample for chart rendering performance ONLY without altering raw readings
  const maxPoints = 1200;
  const step = Math.max(1, Math.ceil(filteredReadings.length / maxPoints));
  const chartData = filteredReadings
    .filter((_, i) => i % step === 0 || i === filteredReadings.length - 1)
    .map((r) => ({
      time: formatAxisTime(r, timeRange),
      value: r[selectedSensor],
      raw: r,
    }));

  return (
    <section className="bg-white rounded-2xl border border-sage-200/30 shadow-soft p-5 sm:p-6 mb-8">
      {/* ── Header row: Title & Sensor Selector ───────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-display text-xl font-semibold text-gray-800">Sensor History</h2>
          <p className="text-xs text-gray-400 font-light">
            {sourceSummary} · {history.length.toLocaleString()} total records
          </p>
        </div>
        <select
          value={selectedSensor}
          onChange={(e) => setSelectedSensor(e.target.value as SensorKey)}
          className="bg-sage-50 border border-sage-200/50 rounded-xl px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sage-300/60 cursor-pointer transition-shadow"
        >
          {SENSOR_CONFIGS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.displayName} ({c.unit})
            </option>
          ))}
        </select>
      </div>

      {/* ── Time-range selector & range information ───────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5 pb-4 border-b border-sage-100/50">
        {/* Segmented Time-Range Buttons */}
        <div className="inline-flex p-1 bg-sage-50/80 border border-sage-200/40 rounded-xl gap-1 overflow-x-auto">
          {TIME_RANGE_LIST.map((opt) => {
            const isActive = timeRange === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setTimeRange(opt.key)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all duration-150 whitespace-nowrap active:scale-95 ${
                  isActive
                    ? 'bg-white text-sage-700 shadow-sm border border-sage-200/60 font-semibold'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-white/50 font-medium'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Time-Range Information */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-500 font-light">
          <span>
            Showing: <strong className="font-medium text-gray-700">{rangeLabel}</strong>
          </span>
          <span className="text-gray-300">·</span>
          <span>
            Readings: <strong className="font-medium text-gray-700 tabular-nums">{filteredReadings.length.toLocaleString()}</strong>
          </span>
          {fromStr && toStr && (
            <>
              <span className="text-gray-300">·</span>
              <span>
                From: <strong className="font-medium text-gray-700 tabular-nums">{fromStr}</strong>
              </span>
              <span className="text-gray-300">→</span>
              <span>
                To: <strong className="font-medium text-gray-700 tabular-nums">{toStr}</strong>
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Chart Container with Dynamic Y-axis ────────────── */}
      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id={`grad-${selectedSensor}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={config.chartColor} stopOpacity={0.2} />
                <stop offset="95%" stopColor={config.chartColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: '#aaa' }}
              tickLine={false}
              axisLine={{ stroke: '#eee' }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 11, fill: '#aaa' }}
              tickLine={false}
              axisLine={{ stroke: '#eee' }}
              width={65}
              tickFormatter={(v: number) => {
                if (v == null || !Number.isFinite(v)) return '';
                if (selectedSensor === 'mq2Voltage') return v.toFixed(3);
                if (Math.abs(v) < 10) return v.toFixed(1);
                if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString();
                return Number(v.toFixed(1)).toString();
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255,255,255,0.96)',
                border: `1px solid ${config.borderColor}`,
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                fontSize: '13px',
                padding: '10px 14px',
              }}
              formatter={(value: number | string | Array<number | string>) => [
                value != null && typeof value === 'number'
                  ? `${value.toLocaleString(undefined, { maximumFractionDigits: selectedSensor === 'mq2Voltage' ? 3 : 2 })} ${config.unit}`
                  : 'No data',
                config.displayName,
              ]}
              labelFormatter={(label: string) => `Time: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={config.chartColor}
              strokeWidth={2.5}
              fill={`url(#grad-${selectedSensor})`}
              dot={false}
              connectNulls={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: config.chartColor }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Sensor Statistics & Active Y-Axis Scale Summary ── */}
      {stats.current !== null && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-4 pt-3 border-t border-sage-100/40 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Current:</span>
            <span className="font-semibold text-gray-700 tabular-nums">
              {stats.current.toLocaleString(undefined, { maximumFractionDigits: selectedSensor === 'mq2Voltage' ? 3 : 1 })}{' '}
              {config.unit}
            </span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Min:</span>
            <span className="font-medium text-gray-600 tabular-nums">
              {stats.min?.toLocaleString(undefined, { maximumFractionDigits: selectedSensor === 'mq2Voltage' ? 3 : 1 })}{' '}
              {config.unit}
            </span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Avg:</span>
            <span className="font-medium text-gray-600 tabular-nums">
              {stats.avg?.toLocaleString(undefined, { maximumFractionDigits: selectedSensor === 'mq2Voltage' ? 3 : 1 })}{' '}
              {config.unit}
            </span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Max:</span>
            <span className="font-medium text-gray-600 tabular-nums">
              {stats.max?.toLocaleString(undefined, { maximumFractionDigits: selectedSensor === 'mq2Voltage' ? 3 : 1 })}{' '}
              {config.unit}
            </span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Y-Axis Scale:</span>
            <span className="font-mono text-[11px] text-sage-700 bg-sage-50 px-2 py-0.5 rounded-md border border-sage-200/50 tabular-nums font-medium">
              {yDomain[0]} – {yDomain[1]} {config.unit}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
