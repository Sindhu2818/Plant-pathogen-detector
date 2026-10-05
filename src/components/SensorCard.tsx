import {
  Thermometer,
  Droplets,
  Sun,
  Wind,
  Sprout,
  Cloud,
  Flame,
  Gauge,
  Zap,
} from 'lucide-react';
import type { SensorConfig, SensorKey, SensorReading } from '../types';

/* ── Icon map ─────────────────────────────────────────────── */

const SENSOR_ICONS: Record<SensorKey, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  temperature: Thermometer,
  humidity: Droplets,
  ambientLight: Sun,
  co2: Wind,
  soilMoisture: Sprout,
  tvoc: Cloud,
  mq2Gas: Flame,
  ds18b20Temperature: Thermometer,
  soilRaw: Gauge,
  mq2Voltage: Zap,
};

/* ── Formatting helpers ───────────────────────────────────── */

function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'No data';
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value))
    return 'No data';
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatTime(timestamp: string | undefined | null): string {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

/* ── Component ────────────────────────────────────────────── */

interface SensorCardProps {
  config: SensorConfig;
  reading: SensorReading | null;
}

export function SensorCard({ config, reading }: SensorCardProps) {
  const Icon = SENSOR_ICONS[config.key];
  const rawValue = reading ? reading[config.key] : null;
  const displayValue = formatValue(rawValue);
  const noData = displayValue === 'No data';

  return (
    <div
      className="group bg-white rounded-2xl border shadow-soft p-5
                 transition-all duration-300 ease-out
                 hover:shadow-soft-md hover:-translate-y-0.5"
      style={{ borderColor: config.borderColor }}
    >
      {/* Top row: icon + timestamp */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: config.bgColor }}
        >
          <Icon
            className="w-5 h-5"
            style={{ color: config.color }}
            strokeWidth={1.8}
          />
        </div>
        <span className="text-[11px] text-gray-400 font-light tabular-nums">
          {reading ? formatTime(reading.timestamp) : ''}
        </span>
      </div>

      {/* Sensor label */}
      <h3 className="text-sm font-medium text-gray-500 mb-1 tracking-wide">
        {config.displayName}
      </h3>

      {/* Value + unit */}
      <div className="flex items-baseline gap-1.5">
        <span
          className={`font-semibold transition-colors ${
            noData
              ? 'text-gray-300 text-sm'
              : 'text-gray-800 text-2xl tabular-nums'
          }`}
        >
          {displayValue}
        </span>
        {!noData && (
          <span className="text-sm text-gray-400 font-light">{config.unit}</span>
        )}
      </div>
    </div>
  );
}
