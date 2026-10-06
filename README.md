# PlantSense — Smart Farming Dashboard

Offline-first, online-capable multisensor plant monitoring dashboard for ESP32.

The dashboard can receive data two ways:

1. **Automatically** from ThingsBoard when the ESP32 has network connectivity.
2. **Manually** via CSV import when the ESP32 was offline and stored data locally.

Both sources are merged into one unified historical dataset.

## Run

```powershell
cd "path\to\Code"
npm install
npm run dev
```

Open `http://localhost:5173`.

## Architecture

### Live mode

```
ESP32 → ThingsBoard → Dashboard
```

When the ESP32 has Wi-Fi, it sends telemetry to ThingsBoard. The dashboard polls ThingsBoard every 10 seconds (configurable via `VITE_REFRESH_INTERVAL_MS` in `.env`) and merges the data with any locally imported CSV datasets.

### Offline mode

```
ESP32 → LittleFS CSV (sensor_data.csv)
```

When the ESP32 loses Wi-Fi, it continues logging readings to local flash storage (LittleFS) in CSV format. The dashboard continues operating normally with locally stored data and shows a non-alarming "ThingsBoard offline" indicator.

### Recovery — CSV Import

```
ESP32 CSV → Dashboard → Import CSV → IndexedDB
```

1. Retrieve the CSV file from the ESP32 (e.g. via USB/serial or web server).
2. Click **Import CSV** in the dashboard header.
3. Select the `.csv` file.
4. Optionally set an **Experiment Start Time** — each reading's timestamp will be `startTime + Time_ms`.
5. Click **Import**. Progress is shown for large files (the 23k+ row CSV imports without freezing).
6. The data persists in the browser's IndexedDB and survives page refreshes.

## Timestamps

The ESP32 CSV uses `Time_ms` — elapsed milliseconds since logging started.

- **Without start time**: readings use elapsed time as-is. Charts show elapsed time labels.
- **With start time**: each timestamp = `experimentStartTime + Time_ms`, giving absolute dates.

Original `Time_ms` spacing is always preserved. No timestamps are modified or averaged.

## Duplicate Detection

When importing a CSV, the dashboard checks if a dataset with the same fingerprint (reading count, first `Time_ms`, last `Time_ms`) already exists. If a match is found:

- A warning is shown: *"This dataset appears to match..."*
- The user can choose **Import anyway** or **Skip**.
- This prevents accidentally duplicating all 23k+ rows.

## Dataset Management

Click **Datasets** in the header to view all loaded datasets:

| Info | Example |
|------|---------|
| Name | Historical Experiment |
| Readings | 23,238 |
| Source | CSV / Bundled / ThingsBoard |
| Time Range | Day 1 → Day 3 |
| Imported | Oct 5, 2026 |

Datasets can be deleted individually. Deleting a CSV dataset does not affect ThingsBoard data.

## CSV Export

Click **Export CSV** to download the combined dataset from all sources in the original ESP32 CSV format:

```
Time_ms,DHT22_Temperature_C,DHT22_Humidity_percent,...
```

## Bundled Historical CSV

The file `public/esp32_sensor_data.csv` is automatically imported into IndexedDB on first load and labeled as "Bundled Historical CSV". It does not need to be manually imported.

## Historical Sensor Charts

The dashboard features intelligent time-filtering and dynamic Y axis scaling:

### Time-Range Selector

Choose from:
- `1H` (Last 1 Hour)
- `3H` (Last 3 Hours — default view)
- `6H` (Last 6 Hours)
- `12H` (Last 12 Hours)
- `24H` (Last 24 Hours)
- `3D` (Last 3 Days)
- `ALL` (All available data)

The reference point is the newest timestamp in the dataset. If the dataset spans less time than the selected range, all available data is automatically shown rather than displaying an empty chart.

### Dynamic Y-Axis Scaling

- **No forced zero**: Rather than forcing every Y-axis to start at 0, the chart dynamically computes the observed minimum and maximum for the active sensor in the selected time window and applies ~8% visual padding.
- **Independent per sensor**: Each of the 10 sensors maintains its own scaling, precision, and physical constraints (e.g. humidity and soil moisture cannot exceed 100% or drop below 0%; MQ-2 voltage preserves 3 decimal places; constant values maintain a sensible non-zero range).
- **Recalculation**: Y-axis scale automatically recalibrates when changing time ranges, switching sensors, or importing new data.
- **Performance**: Raw readings in IndexedDB are never altered; downsampling is applied solely at the SVG rendering layer for smooth 60 FPS performance across 23,000+ points.

## Environment Variables

```env
VITE_THINGSBOARD_URL=http://localhost:8080
VITE_THINGSBOARD_DEVICE_ID=<your-device-id>
VITE_THINGSBOARD_API_KEY=<your-api-key>
VITE_THINGSBOARD_HISTORY_LIMIT=500
VITE_THINGSBOARD_HISTORY_WINDOW_MS=604800000
VITE_REFRESH_INTERVAL_MS=10000
```

ThingsBoard credentials are stored only in `.env` and are never exposed through CSV exports, IndexedDB, or uploaded files.

## Sensors

| Sensor | CSV Column | Dashboard Key | Unit |
|--------|-----------|---------------|------|
| DHT22 Temperature | `DHT22_Temperature_C` | `temperature` | °C |
| DHT22 Humidity | `DHT22_Humidity_percent` | `humidity` | % |
| DS18B20 Temperature | `DS18B20_Temperature_C` | `ds18b20Temperature` | °C |
| SGP30 TVOC | `SGP30_TVOC_ppb` | `tvoc` | ppb |
| SGP30 eCO₂ | `SGP30_eCO2_ppm` | `co2` | ppm |
| BH1750 Light | `BH1750_Lux` | `ambientLight` | lux |
| Soil Raw | `Soil_Raw` | `soilRaw` | ADC |
| Soil Moisture | `Soil_Moisture_percent` | `soilMoisture` | % |
| MQ-2 Raw | `MQ2_Raw` | `mq2Gas` | ADC |
| MQ-2 Voltage | `MQ2_ADC_Voltage` | `mq2Voltage` | V |

## Security Note

The dashboard uses ThingsBoard API keys configured via environment variables. For local development this is acceptable. For production deployment, consider using a backend proxy to avoid exposing API keys in the browser.

## Tech Stack

- React 18 + TypeScript
- Vite
- Recharts (charts)
- Tailwind CSS (styling)
- Lucide React (icons)
- idb (IndexedDB wrapper, ~3KB gzipped)
