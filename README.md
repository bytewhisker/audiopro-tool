# AudioPro Tool — 1-Click AI Audio Isolation & Voice Restoration for Adobe After Effects

![AudioPro Tool Banner](Assets/AudioPro%20Tool%20Logo.png)

> **Professional, 100% Offline AI Audio Cleaning directly inside Adobe After Effects.**  
> Zero Cloud APIs. Zero Subscriptions. Studio-grade dialogue enhancement with sample-accurate timeline sync.

---

## 🚀 Overview

**AudioPro Tool** (internally powered by the **NoiseClean** CEP engine) is an Adobe After Effects extension designed to give video editors, motion designers, and VFX artists instant, studio-quality dialogue cleanup without leaving their timeline.

Built strictly according to **aescripts + aeplugins** development and distribution guidelines, AudioPro Tool eliminates background noise, AC hum, street traffic, room reverb, and cafe chatter using cutting-edge deep learning models running 100% locally on your machine.

---

## ✨ Key Features

* **🧠 Dual Offline AI Engines:**
  * **Fast Engine (RNNoise):** Lightweight recurrent neural network running at **60x–70x Real-Time Factor** (~4 seconds for a 5-minute interview). Perfect for fast-turnaround speech isolation and hum elimination.
  * **Studio Engine (DeepFilterNet 3):** High-definition deep-filtering neural network (WebAssembly + ONNX) delivering up to **50+ dB** broadband noise suppression while preserving vocal body and natural formants.
* **🔒 100% Offline & Private:**
  * All audio processing happens locally on your CPU/GPU.
  * Zero audio ever uploaded to cloud servers. Zero telemetry, API keys, or internet connection required.
* **⚡ Native Pre-Comp & Footage Intelligence:**
  * Clean audio directly on footage layers, pure audio files (WAV, MP3, AAC, M4A), or nested **Pre-comps**.
  * Deep footage resolution automatically locates source audio inside complex precomp hierarchies without forcing you to open or unpack them.
* **🎯 Sample-Accurate Timeline Synchronization:**
  * Automatic bandlimited resampling (48kHz/44.1kHz) and frame-clamping ensure sample-accurate alignment with zero drift.
* **🛡️ Non-Destructive & Permanent Project Storage:**
  * Original media remains untouched.
  * Cleaned media is automatically organized in an `AudioPro_Cleaned` directory alongside project assets, ensuring After Effects projects never suffer from "Missing Footage" errors upon reopening.
* **🎨 Premium Native Dark UI:**
  * Responsive, high-contrast dark aesthetic tailored for After Effects panel docking (supports ultra-narrow widths down to 280px).

---

## 📁 Repository Structure

```
AudioPro Tool/
├── Assets/                        # Brand logos, icons, and graphic assets
├── NoiseClean/                    # Core Adobe CEP Extension source code
│   ├── CSXS/                      # Extension manifest (manifest.xml) for AE 16.0 - 99.9
│   ├── client/                    # Panel frontend (HTML5, Vanilla CSS, modern JS)
│   ├── host/                      # ExtendScript (JSX) host bridges for After Effects
│   ├── node/                      # Node.js orchestration, demuxing, and audio pipelines
│   ├── engines/                   # Bundled offline AI engines (RNNoise, DeepFilterNet, FFmpeg)
│   ├── models/                    # Quantized ONNX & neural network weights
│   ├── resources/                 # License texts, icons, and UI assets
│   ├── scripts/                   # Development installer and packaging utilities
│   ├── DEVELOPMENT.md             # Developer setup, architecture notes, and debugging
│   ├── LICENSES.md                # Open-source and third-party license acknowledgments
│   └── package.json               # Extension metadata and npm scripts
├── Teacher-Student/               # A/B audio quality comparison tracks & benchmark benchmarks
├── Thumbnails/                    # 4K promotional graphics, marketing banners, & tutorial covers
├── EPIC_EXPLAINER_VIDEO_SCRIPT.md # Video marketing script and narrative flow
├── PRODUCT_MARKETING_KIT.md       # aescripts submission copy, SEO metadata, and product descriptions
└── README.md                      # Repository documentation
```

---

## ⚙️ Architecture & Data Flow

```
   After Effects Composition / Pre-Comp
                   │
                   ▼
       [Select Audio/Video Layer]
                   │
                   ▼
        AudioPro Tool CEP Panel
                   │
                   ▼
  ExtendScript JSX Bridge (ES3)
  • Inspects layer properties & deep precomp hierarchy
  • Resolves source media paths
                   │
                   ▼
  Node.js Orchestration Runtime (Mixed-Context CEP)
                   │
   ┌───────────────┼───────────────┐
   ▼               ▼               ▼
[FFmpeg]    [RNNoise Engine]  [DeepFilterNet 3]
 Demux/Remux  Fast Recurrent    WASM + ONNX Model
 Audio Tracks Neural Network   Deep Spectral Filter
   │               │               │
   └───────────────┴───────────────┘
                   │
                   ▼
   Output: Cleaned WAV (16-bit PCM / 48 kHz)
                   │
                   ▼
  ExtendScript Project Bin Import & Comp Insertion
  • Imported into bin as OriginalName_Cleaned
  • Preserves layer in/out points & sync
```

---

## 🛠️ Developer Setup & Local Installation

### Prerequisites
* Adobe After Effects CC 2019 (v16.0) or higher.
* Node.js v16+ (for local test running and packaging scripts).

### 1. Enable CEP Debug Mode
Enable `PlayerDebugMode` in your operating system so After Effects loads unsigned development extensions:

* **Windows (PowerShell):**
  ```powershell
  reg add "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f
  reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f
  reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f
  ```

* **macOS (Terminal):**
  ```bash
  defaults write com.adobe.CSXS.10 PlayerDebugMode 1
  defaults write com.adobe.CSXS.11 PlayerDebugMode 1
  defaults write com.adobe.CSXS.12 PlayerDebugMode 1
  ```

### 2. Symlink Extension to Adobe CEP Directory
Run the automated dev installer to link `NoiseClean` into your Adobe CEP extension folder:

```bash
cd NoiseClean
node scripts/build/install-dev.js
```

### 3. Open in After Effects
Launch After Effects and access the panel from:
```
Window > Extensions > NoiseClean
```

### 4. Remote Debugging
Open Google Chrome and navigate to:
```
http://localhost:8889
```
This gives you full Chrome DevTools access to the panel's DOM, console, network calls, and Node.js environment.

---

## 📦 Building & Packaging (aescripts Distribution)

To generate an aescripts-compliant distribution package with debug flags and development artifacts removed:

```bash
cd NoiseClean
node scripts/package/package-zxp.js
```

This compiles a clean `.zip` / `.zxp` staging archive inside the `dist/` folder ready for submission.

---

## 📄 Licensing & Attribution

AudioPro Tool is commercial proprietary software. Bundled third-party components (FFmpeg, RNNoise, DeepFilterNet) are distributed under their respective permissive open-source licenses (BSD-3-Clause, MIT, LGPL 2.1+, Apache-2.0). Complete attribution and license notices can be reviewed in [NoiseClean/LICENSES.md](NoiseClean/LICENSES.md).

---

© 2026 Mahadi (ByteWhisker). All rights reserved.
