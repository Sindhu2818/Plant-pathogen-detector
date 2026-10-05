import type { SensorReading } from '../types';

const CSV_URL = '/esp32_sensor_data.csv';

const REQUIRED_COLUMNS = [
  'Time_ms',
  'DHT22_Temperature_C',
  'DHT22_Humidity_percent',
  'DS18B20_Temperature_C',
  'SGP30_TVOC_ppb',
  'SGP30_eCO2_ppm',
  'BH1750_Lux',
  'Soil_Raw',
  'Soil_Moisture_percent',
  'MQ2_Raw',
  'MQ2_ADC_Voltage',
] as const;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function numberOrNull(value: string | undefined): number | null {
  if (!value || value.toUpperCase() === 'NA') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate a CSV header and return the column index map.
 * Returns an error string if required columns are missing.
 */
function validateHeader(headerLine: string): { index: Map<string, number> } | { error: string } {
  const header = parseCsvLine(headerLine);
  const index = new Map(header.map((name, i) => [name, i]));
  const missing = REQUIRED_COLUMNS.filter((key) => !index.has(key));
  if (missing.length) {
    return { error: `CSV is missing columns: ${missing.join(', ')}` };
  }
  return { index };
}

/** Build a SensorReading from a parsed CSV row. */
function rowToReading(
  cells: string[],
  index: Map<string, number>,
  rowIndex: number,
  experimentStartTime?: Date,
  source: SensorReading['source'] = 'csv',
  datasetId?: string,
): SensorReading {
  const get = (key: string) => cells[index.get(key)!];
  const timeMs = numberOrNull(get('Time_ms')) ?? rowIndex * 10000;

  let timestamp: string;
  if (experimentStartTime) {
    timestamp = new Date(experimentStartTime.getTime() + timeMs).toISOString();
  } else {
    // Use epoch + timeMs so readings sort correctly even without a start time
    timestamp = new Date(timeMs).toISOString();
  }

  return {
    timestamp,
    timeMs,
    temperature: numberOrNull(get('DHT22_Temperature_C')),
    humidity: numberOrNull(get('DHT22_Humidity_percent')),
    ds18b20Temperature: numberOrNull(get('DS18B20_Temperature_C')),
    tvoc: numberOrNull(get('SGP30_TVOC_ppb')),
    co2: numberOrNull(get('SGP30_eCO2_ppm')),
    ambientLight: numberOrNull(get('BH1750_Lux')),
    soilRaw: numberOrNull(get('Soil_Raw')),
    soilMoisture: numberOrNull(get('Soil_Moisture_percent')),
    mq2Gas: numberOrNull(get('MQ2_Raw')),
    mq2Voltage: numberOrNull(get('MQ2_ADC_Voltage')),
    source,
    datasetId,
  };
}

/* ── Public API ───────────────────────────────────────────── */

/** Fetch the bundled historical CSV from public/. */
export async function fetchCsvHistory(): Promise<SensorReading[]> {
  const response = await fetch(CSV_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load historical CSV (${response.status}).`);
  }

  const text = await response.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error('The historical CSV contains no sensor readings.');

  const result = validateHeader(lines[0]);
  if ('error' in result) throw new Error(result.error);

  return lines.slice(1).map((line, rowIndex) => {
    const cells = parseCsvLine(line);
    return rowToReading(cells, result.index, rowIndex, undefined, 'bundled', 'bundled-historical');
  });
}

/**
 * Parse CSV text from a user-uploaded file.
 * Returns parsed readings and any validation errors.
 */
export function parseCsvText(
  text: string,
  options?: { experimentStartTime?: Date; datasetId?: string },
): { readings: SensorReading[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return { readings: [], errors: ['CSV file is empty or contains only a header row.'] };
  }

  const result = validateHeader(lines[0]);
  if ('error' in result) {
    return { readings: [], errors: [result.error] };
  }

  const readings: SensorReading[] = [];
  for (let i = 1; i < lines.length; i++) {
    try {
      const cells = parseCsvLine(lines[i]);
      readings.push(
        rowToReading(
          cells,
          result.index,
          i - 1,
          options?.experimentStartTime,
          'csv',
          options?.datasetId,
        ),
      );
    } catch {
      errors.push(`Row ${i + 1}: failed to parse — skipped.`);
    }
  }

  return { readings, errors };
}

/**
 * Validate a CSV header string (first line of a CSV file).
 * Returns null if valid, or an error message if columns are missing.
 */
export function validateCsvHeader(headerLine: string): string | null {
  const result = validateHeader(headerLine);
  return 'error' in result ? result.error : null;
}

