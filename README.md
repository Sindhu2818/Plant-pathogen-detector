# 🌱 PlantSense — ESP32 Smart Farming & Pathogen Monitoring System

[![Live Demo](https://img.shields.io/badge/Live_Dashboard-spidey--farmers.vercel.app-2ea44f?style=for-the-badge&logo=vercel)](https://spidey-farmers.vercel.app/)
[![ESP32](https://img.shields.io/badge/Hardware-ESP32-blue?style=for-the-badge&logo=espressif)](https://www.espressif.com/)
[![ThingsBoard](https://img.shields.io/badge/IoT-ThingsBoard_MQTT-purple?style=for-the-badge)](https://thingsboard.io/)
[![React](https://img.shields.io/badge/Frontend-React_18_+_Vite-61dafb?style=for-the-badge&logo=react)](https://react.dev/)

An **offline-first, dual-pipeline Smart Farming IoT system**. An **ESP32** microcontroller continuously samples 10 environmental metrics to detect plant pathogen risk factors. When network connectivity is present, data streams in real time via **ThingsBoard MQTT**. When disconnected or in remote fields, the ESP32 logs data to internal flash storage using **LittleFS**.

Recovered CSV data and live telemetry are seamlessly merged in the **PlantSense React Dashboard**, backed by browser-native **IndexedDB** storage, interactive time-range filtering, and dynamic Y-axis auto-scaling.

🔗 **Deployed Web Dashboard:** [https://spidey-farmers.vercel.app/](https://spidey-farmers.vercel.app/)

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [Part 1: ESP32 Arduino Firmware](#-part-1-esp32-arduino-firmware)
  - [Hardware & Sensors](#hardware--sensors)
  - [Pinout & Wiring](#pinout--wiring)
  - [Firmware Features](#firmware-features)
  - [Required Arduino Libraries](#required-arduino-libraries)
  - [Configuration & Settings](#configuration--settings)
  - [Serial Monitor Commands (CLI)](#serial-monitor-commands-cli)
  - [How to Flash the ESP32](#how-to-flash-the-esp32)
- [Part 2: PlantSense Web Dashboard](#-part-2-plantsense-web-dashboard)
  - [Dashboard Capabilities](#dashboard-capabilities)
  - [How to Run the Dashboard Locally](#how-to-run-the-dashboard-locally)
  - [Environment Variables](#environment-variables)
- [Sensor & Telemetry Mapping](#-sensor--telemetry-mapping)
- [Offline Recovery Workflow](#-offline-recovery-workflow)

---

## 🏗 System Architecture

```text
               ┌────────────────────────────────────────────────────────┐
               │              ESP32 Smart Farming Node                  │
               │  (DHT22, DS18B20, SGP30, BH1750, Soil Moisture, MQ-2)  │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   │                                             │
      [Wi-Fi Online Mode]                           [Offline / Field Mode]
                   │                                             │
                   ▼                                             ▼
       ThingsBoard MQTT Server                     ESP32 LittleFS Flash Storage
        (Topic: v1/devices/me/telemetry)              (File: /sensor_data.csv)
                   │                                             │
                   │                                             │ Serial "DOWNLOAD"
                   │                                             │ or USB Export
                   │                                             ▼
                   │                                     Retrieved CSV File
                   │                                             │
                   ▼                                             ▼
        ┌─────────────────────────────────────────────────────────────┐
        │                  PlantSense Web Dashboard                   │
        │             https://spidey-farmers.vercel.app/             │
        │                                                             │
        │  • Unified Chronological Data Stream                        │
        │  • Browser IndexedDB Persistence (23,000+ raw records)       │
        │  • Dynamic Y-Axis Auto-Scaling with 8% visual padding       │
        │  • Time-Range Filtering: 1H | 3H | 6H | 12H | 24H | 3D | ALL│
        │  • Multi-Source Deduplication & CSV Re-Export               │
        └─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Part 1: ESP32 Arduino Firmware

The firmware runs on an **ESP32 Dev Module** and continuously samples air, soil, gas, and ambient light sensors to assess conditions conducive to fungal pathogens and plant stress.

### Hardware & Sensors

| Sensor | Metric Measured | Interface | Operating Voltage |
| :--- | :--- | :--- | :--- |
| **DHT22 (AM2302)** | Air Temperature & Relative Humidity | Single-Wire Digital | 3.3V – 5V |
| **DS18B20** | Waterproof Soil / Root Probe Temperature | Dallas OneWire | 3.0V – 5.5V |
| **SGP30** | Indoor/Greenhouse Air Quality (TVOC & eCO₂) | I2C | 3.3V |
| **BH1750** | Ambient Light Intensity (Lux) | I2C | 3.3V |
| **Capacitive/Resistive Soil** | Volumetric Soil Moisture Content | Analog (ADC1) | 3.3V |
| **MQ-2** | Smoke, Flammable Gases, Combustible Air Pollutants | Analog (ADC1) | 5V (heater) / 3.3V ADC |

---

### Pinout & Wiring

Connect the sensors to the ESP32 as defined in `ESP32_Smart_Farming_ThingsBoard.ino`:

```text
       ESP32 Pinout Configuration
     ┌────────────────────────────┐
     │ 3V3       [Power] ──── VCC │ (Sensors 3.3V)
     │ GND       [Power] ──── GND │ (Common Ground)
     │ GPIO 4   ───────────── DHT22 Data (4.7kΩ pull-up to 3.3V)
     │ GPIO 5   ───────────── DS18B20 Data (4.7kΩ pull-up to 3.3V)
     │ GPIO 21  ───────────── I2C SDA (SGP30 & BH1750)
     │ GPIO 22  ───────────── I2C SCL (SGP30 & BH1750)
     │ GPIO 34  ───────────── MQ-2 Analog AOUT (ADC1_CH6)
     │ GPIO 35  ───────────── Soil Moisture AOUT (ADC1_CH7)
     └────────────────────────────┘
```

> **Note on ADC Pins:** GPIO 34 and GPIO 35 belong to **ADC1**, which can safely operate alongside the ESP32 Wi-Fi radio (unlike ADC2 pins). Both are configured with `ADC_11db` attenuation (0–3.3V input range) and 12-bit resolution (0–4095).

---

### Firmware Features

1. **Dual Logging Architecture**:
   - Every **10 seconds** (`LOG_INTERVAL = 10000`), all 6 sensor drivers take synchronized readings.
   - Readings are appended to the internal flash file `/sensor_data.csv` using **LittleFS**.
   - If Wi-Fi is connected, the same readings are immediately published as an MQTT JSON payload to ThingsBoard.
2. **Offline Resilience**:
   - If Wi-Fi disconnects or ThingsBoard is unreachable, logging to LittleFS continues uninterrupted.
   - Non-blocking reconnect attempts occur every 15s (Wi-Fi) and 10s (MQTT) without halting sensor cycles.
3. **Interactive Serial Command Line (CLI)**:
   - Interact with the ESP32 via Serial at **115200 baud** to monitor, inspect, and extract logged CSV data.

---

### Required Arduino Libraries

Install these libraries via **Arduino IDE Library Manager** (`Ctrl+Shift+I` / `Cmd+Shift+I`):

1. **DHT sensor library** by *Adafruit* (v1.4.x)
2. **Adafruit Unified Sensor** by *Adafruit* (dependency for DHT)
3. **DallasTemperature** by *Miles Burton* (v3.9.x)
4. **OneWire** by *Paul Stoffregen* (v2.3.x)
5. **Adafruit SGP30 Sensor** by *Adafruit* (v2.0.x)
6. **BH1750** by *Christopher Laws* (v1.3.x)
7. **PubSubClient** by *Nick O'Leary* (v2.8.x)
8. **LittleFS** & **WiFi** *(built directly into the ESP32 Arduino Core)*

---

### Configuration & Settings

Open `ESP32_Smart_Farming_ThingsBoard.ino` and update the network and server credentials before flashing:

```cpp
// ======================================================
// WIFI & THINGSBOARD CONFIGURATION
// ======================================================
const char* WIFI_SSID         = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD     = "YOUR_WIFI_PASSWORD";
const char* THINGSBOARD_SERVER = "192.168.1.100";  // IP or host of ThingsBoard instance
const int   THINGSBOARD_PORT   = 1883;             // Default MQTT port
const char* THINGSBOARD_TOKEN  = "YOUR_DEVICE_ACCESS_TOKEN";

// Data logging interval (milliseconds)
const unsigned long LOG_INTERVAL = 10000; // 10 seconds per reading
```

---

### Serial Monitor Commands (CLI)

Open the Serial Monitor at **115200 baud** (with `Newline` or `Both NL & CR`). Send any of the following commands:

| Command | Action | Output Description |
| :--- | :--- | :--- |
| `DOWNLOAD` | Dump CSV Log | Streams the complete `/sensor_data.csv` between `=== BEGIN SENSOR DATA ===` and `=== END SENSOR DATA ===`. Copy/paste directly into a `.csv` file. |
| `COUNT` | Count Stored Records | Prints the total number of valid rows stored in LittleFS flash. |
| `STATUS` | System Health | Shows file size in bytes, logging frequency, and flash memory status. |
| `CLEAR` | Format Flash Log | Erases `/sensor_data.csv`, re-creates the standard CSV header, and resets storage. |

---

### How to Flash the ESP32

1. **Install ESP32 Board Core**:
   - In Arduino IDE, open **File → Preferences**.
   - Add to *Additional Boards Manager URLs*:
     ```text
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Go to **Tools → Board → Boards Manager**, search for `esp32`, and install **esp32 by Espressif Systems**.
2. **Select Board & Port**:
   - **Board**: `ESP32 Dev Module` (or your specific ESP32 variant)
   - **Flash Size**: `4MB (32Mb)`
   - **Partition Scheme**: `Default 4MB with spiffs (1.2MB APP / 1.5MB SPIFFS)` or `Minimal SPIFFS` (both allocate flash for LittleFS)
   - **Upload Speed**: `921600` or `115200`
   - **Port**: Select the COM port corresponding to your connected ESP32
3. **Upload**:
   - Click the **Upload** (`→`) button.
   - If your board requires it, hold down the `BOOT` button on the ESP32 until uploading begins.
4. **Verify**:
   - Open **Serial Monitor** at **115200 baud**.
   - Confirm all sensors initialize:
     ```text
     ==========================================
      ESP32 MULTI SENSOR DATA LOGGER
     ==========================================
     LittleFS initialized.
     I2C initialized.
     DHT22 initialized.
     DS18B20 initialized. Devices found: 1
     SGP30 detected.
     BH1750 detected.
     ```

---

## 💻 Part 2: PlantSense Web Dashboard

The web dashboard is a modern, responsive single-page application built with **React 18**, **Vite**, **TypeScript**, **Tailwind CSS**, and **Recharts**.

🌐 **Live Deployed App:** [https://spidey-farmers.vercel.app/](https://spidey-farmers.vercel.app/)

### Dashboard Capabilities

- **Unified Data View**: Merges live ThingsBoard MQTT feeds, manually uploaded CSV files, and bundled historical datasets into one synchronized stream.
- **Client-Side IndexedDB Storage**: Uses `idb` to store **23,000+ sensor records** directly in the browser. Survives page reloads without requiring a backend database.
- **Dynamic Y-Axis Scaling**:
  - Automatically zooms each sensor's Y-axis to fit the observed data range.
  - Adds **8% visual padding** above and below the min/max values.
  - Edge-case protection: handles constant values (e.g. constant CO₂=400), clamps percentage sensors (Humidity and Soil Moisture between 0%–100%), and preserves 3 decimal places for small voltages (MQ-2).
- **Time-Range Selector**: Filter historical data by:
  - `[ 1H ]` Last 1 Hour
  - `[ 3H ]` Last 3 Hours *(Default)*
  - `[ 6H ]` Last 6 Hours
  - `[ 12H ]` Last 12 Hours
  - `[ 24H ]` Last 24 Hours
  - `[ 3D ]` Last 3 Days
  - `[ ALL ]` Complete historical experiment
- **Timestamp Integrity**: Filters against true elapsed `Time_ms` or user-defined experiment start timestamps. Never substitutes upload time for actual collection timestamps.
- **Duplicate Detection**: Automatically fingerprints CSV imports (`readingCount`, `firstTimeMs`, `lastTimeMs`) to prevent accidental duplication.
- **Combined CSV Export**: Download the unified dataset with standard ESP32 column headers with a single click.

---

### How to Run the Dashboard Locally

#### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

#### 1. Clone & Navigate
```powershell
git clone https://github.com/your-username/Plant-pathogen-detector.git
cd Plant-pathogen-detector
```

#### 2. Install Dependencies
```powershell
npm install
```

#### 3. Run Development Server
```powershell
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

#### 4. Build for Production
```powershell
npm run build
```
The compiled, minified bundle will be in the `dist/` directory.

---

### Environment Variables

Configure connection settings by editing `.env` (or copying from `.env.example`):

```env
# ThingsBoard Server URL (Local or Cloud instance)
VITE_THINGSBOARD_URL=http://localhost:8080

# ThingsBoard Device Identifier (UUID)
VITE_THINGSBOARD_DEVICE_ID=fa035680-c077-11f1-a55e-a94eabed987f

# ThingsBoard REST / Telemetry API Key (X-Authorization)
VITE_THINGSBOARD_API_KEY=your_api_key_here

# Telemetry History Fetch Limit (Number of points per poll)
VITE_THINGSBOARD_HISTORY_LIMIT=500

# Telemetry History Time Window (in milliseconds, default 7 days)
VITE_THINGSBOARD_HISTORY_WINDOW_MS=604800000

# Auto-Refresh Polling Interval (in milliseconds, default 10s)
VITE_REFRESH_INTERVAL_MS=10000
```

> **Security Note:** ThingsBoard credentials are read exclusively from environment variables and are never stored in client-side IndexedDB or included in exported CSVs.

---

## 📊 Sensor & Telemetry Mapping

The system preserves uniform naming from the ESP32 firmware through ThingsBoard and into the web dashboard:

| Sensor | Physical Metric | ESP32 CSV Column | ThingsBoard Telemetry Key | Dashboard Key | Unit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DHT22** | Air Temperature | `DHT22_Temperature_C` | `temperature` | `temperature` | °C |
| **DHT22** | Air Humidity | `DHT22_Humidity_percent` | `humidity` | `humidity` | % |
| **DS18B20** | Soil / Probe Temperature | `DS18B20_Temperature_C` | `ds18b20Temperature` | `ds18b20Temperature` | °C |
| **SGP30** | Total Volatile Organic Compounds | `SGP30_TVOC_ppb` | `tvoc` | `tvoc` | ppb |
| **SGP30** | Equivalent CO₂ | `SGP30_eCO2_ppm` | `co2` | `co2` | ppm |
| **BH1750** | Ambient Light Intensity | `BH1750_Lux` | `ambientLight` | `ambientLight` | lux |
| **Soil Sensor** | Raw ADC Count | `Soil_Raw` | `soilRaw` | `soilRaw` | ADC (0–4095) |
| **Soil Sensor** | Calibrated Soil Moisture | `Soil_Moisture_percent` | `soilMoisture` | `soilMoisture` | % |
| **MQ-2** | Raw Gas ADC Count | `MQ2_Raw` | `mq2Gas` | `mq2Gas` | ADC (0–4095) |
| **MQ-2** | Analog Sensor Voltage | `MQ2_ADC_Voltage` | `mq2Voltage` | `mq2Voltage` | V |

---

## 🔄 Offline Recovery Workflow

When operating the ESP32 in remote greenhouses or outdoor fields without network coverage:

1. **Continuous Sampling**: The ESP32 automatically logs every 10 seconds into its flash filesystem (`/sensor_data.csv`).
2. **Data Extraction**:
   - Connect the ESP32 to a laptop via USB.
   - Open any serial terminal (Arduino Serial Monitor, PuTTY, or screen) at **115200 baud**.
   - Send `DOWNLOAD` command.
   - Copy the output lines between `=== BEGIN SENSOR DATA ===` and `=== END SENSOR DATA ===` into a file named `esp32_sensor_data.csv`.
3. **Web Import**:
   - Open the live dashboard at [https://spidey-farmers.vercel.app/](https://spidey-farmers.vercel.app/).
   - Click **Import CSV** in the header.
   - Select your saved `.csv` file.
   - *(Optional)* Check **Use Experiment Start Time** to align elapsed milliseconds to true calendar dates.
   - Click **Import**. The chunked loader processes tens of thousands of rows smoothly.
4. **Historical Analysis**:
   - The imported experiment is saved to your browser's **IndexedDB**.
   - Use the **Time-Range Selector** (`1H`, `3H`, `24H`, etc.) and examine dynamically scaled charts.

---

## 🛠 Tech Stack

- **Firmware**: C++ / Arduino Core for ESP32, LittleFS, PubSubClient (MQTT), Wire (I2C), OneWire
- **Frontend**: React 18, TypeScript, Vite
- **Data Visualization**: Recharts
- **Styling**: Tailwind CSS, Lucide React Icons
- **Storage**: Browser IndexedDB (`idb` wrapper)
- **Deployment**: Vercel ([spidey-farmers.vercel.app](https://spidey-farmers.vercel.app/))
