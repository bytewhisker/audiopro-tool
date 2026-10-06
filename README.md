# AudioPro Tool — 1-Click AI Audio Isolation & Voice Restoration for Adobe After Effects

<div align="center">

![AudioPro Tool Banner](Assets/AudioPro%20Tool%20Logo.png)

[![Latest Release](https://img.shields.io/github/v/release/bytewhisker/audiopro-tool?color=orange&logo=github)](https://github.com/bytewhisker/audiopro-tool/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Adobe After Effects](https://img.shields.io/badge/Adobe%20After%20Effects-CC%202019%E2%80%932026%2B-9999FF?logo=adobeaftereffects&logoColor=white)](https://www.adobe.com/products/aftereffects.html)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-informational)](#-installation)
[![AI Engine](https://img.shields.io/badge/AI%20Engines-DeepFilterNet3%20%2B%20RNNoise-brightgreen)](#-dual-ai-engines)
[![Inference](https://img.shields.io/badge/Inference-100%25%20Offline%20(Zero%20Cloud)-success)](#-key-features)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Professional, 100% Offline AI Audio Cleaning directly inside Adobe After Effects.**  
*Zero Cloud APIs. Zero Subscriptions. Studio-grade dialogue enhancement with sample-accurate timeline sync.*

[Download Latest Release](https://github.com/bytewhisker/audiopro-tool/releases/latest) • [Key Features](#-key-features) • [Installation](#-installation) • [Architecture](#-architecture--data-flow) • [Comparison](#-audiopro-vs-alternatives) • [Contributing](CONTRIBUTING.md) • [License](LICENSE)

</div>

---

## 💡 The Problem AudioPro Solves

Most video editors and motion designers waste 15–30 minutes per project exporting audio stems, uploading them to web enhancers (like Adobe Podcast, Descript, or ElevenLabs), waiting for cloud processing, downloading the results, and realigning them back onto their timeline.

**AudioPro Tool eliminates the entire cloud round-trip.**  
Select any footage layer, audio track, or nested pre-comp directly inside Adobe After Effects, click once, and get broadcast-clean studio dialogue in seconds—running **100% locally on your machine**.

---

## ✨ Key Features

* **🧠 Dual Offline AI Neural Engines:**
  * **Fast Engine (RNNoise):** Ultra-fast recurrent neural network operating at **60x–70x Real-Time Factor** (~4 seconds for a 5-minute clip). Eliminates AC hum, computer fan noise, traffic rumble, and steady noise floor.
  * **Studio Engine (DeepFilterNet 3):** High-definition deep-filtering neural network delivering up to **50+ dB** broadband noise suppression while preserving vocal body, harmonic overtones, and natural formants without watery DSP artifacts.
* **🔒 100% Offline, Private & Unlimited:**
  * Local inference on CPU/GPU. Client files and NDA projects **never touch the cloud**.
  * Zero internet connection required. No monthly credits, no tokens, and no subscription fees.
* **⚡ Deep Pre-Comp & Footage Intelligence:**
  * Automatically inspects nested After Effects **pre-comps** to locate and clean the original source audio without forcing you to unpack or flatten your composition hierarchy.
* **🎯 Sample-Accurate Timeline Synchronization:**
  * Automatic bandlimited resampling (48 kHz / 44.1 kHz) and frame clamping ensure sample-accurate sync with zero audio drift.
* **🛡️ Non-Destructive Project Safety:**
  * Original media remains 100% untouched.
  * Cleaned media is automatically organized in an `AudioPro_Cleaned` directory alongside project assets, preventing "Missing Footage" errors when reopening projects.
* **🎨 Native Dark Panel:**
  * High-contrast aesthetic seamlessly docks into After Effects workspace layouts (supports narrow widths down to 280px).

---

## 📊 AudioPro vs. Alternatives

| Feature | AudioPro Tool (Open Source) | Cloud Web Enhancers (Adobe Podcast, etc.) | Traditional Denoisers / DSP Plugins |
| :--- | :---: | :---: | :---: |
| **Workflow** | **1-Click on AE Timeline** | Export → Upload → Wait → Download → Align | Manual tweaking of 10+ sliders & gates |
| **Privacy / NDAs** | **100% Local (Air-Gapped)** | Uploaded to third-party cloud servers | Local |
| **Internet Required** | **NO (100% Offline)** | YES (Fails without internet) | No |
| **Cost** | **Free & Open Source (MIT)** | Monthly Subscription / Token limits | Expensive paid bundles ($99–$299+) |
| **Audio Quality** | **Natural Neural Recovery** | Often robotic / synthetic artifacts | Hollow, phasey, "underwater" sound |
| **Pre-Comp Support** | **Automatic Deep Traversal** | Not supported | Requires manual nesting navigation |

---

## 🛠️ Installation

### Option 1: Direct Download (Easiest for Video Editors)

1. Download the pre-built extension package from **[Releases (v1.0.0)](https://github.com/bytewhisker/audiopro-tool/releases/latest)**:
   * 📦 **[NoiseClean_v1.0.0.zip](https://github.com/bytewhisker/audiopro-tool/releases/download/v1.0.0/NoiseClean_v1.0.0.zip)**
2. Unzip `NoiseClean_v1.0.0.zip` directly into your Adobe CEP extensions folder:
   * **Windows:** `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\` *(or `%APPDATA%\Adobe\CEP\extensions\`)*
   * **macOS:** `/Library/Application Support/Adobe/CEP/extensions/` *(or `~/Library/Application Support/Adobe/CEP/extensions/`)*
3. Enable CEP Debug Mode (see below) and restart After Effects.
4. Launch the panel from **Window > Extensions > NoiseClean**.

---

### Option 2: Clone & Symlink (For Developers)

1. Clone this repository:
   ```bash
   git clone https://github.com/bytewhisker/audiopro-tool.git
   cd audiopro-tool/NoiseClean
   ```
2. Enable Adobe CEP Debug Mode (allows unsigned panels to run):
   * **Windows (PowerShell as Admin):**
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
3. Run the automated symlink installer:
   ```bash
   node scripts/build/install-dev.js
   ```
4. Restart Adobe After Effects.
5. Open the panel via: **Window > Extensions > NoiseClean**.

---

### Option 2: Build Packaged Extension (.zxp / .zip)

To create a clean release package for distribution or ZXP installers (Anastasiy's Extension Manager, ZXP Installer):

```bash
cd NoiseClean
node scripts/package/package-zxp.js
```
The compiled archive will be generated inside the `dist/` folder.

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
├── Teacher-Student/               # A/B audio quality comparison tracks & benchmarks
├── Thumbnails/                    # Promotional graphics and marketing banners
├── CONTRIBUTING.md                # Contribution guidelines for developers
├── LICENSE                        # MIT Open Source License
└── README.md                      # Project documentation
```

---

## 💻 Remote Debugging

AudioPro Tool runs as an Adobe CEP panel. You can inspect its DOM, JavaScript, and Node.js backend using Chrome DevTools:

1. Launch After Effects and open **Window > Extensions > NoiseClean**.
2. Open Google Chrome and navigate to:
   ```text
   http://localhost:8889
   ```
3. Full interactive DevTools access (Console, Elements, Network, Profiler) is available.

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome!
Please check out [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/NewFeature`)
3. Commit your Changes (`git commit -m 'Add NewFeature'`)
4. Push to the Branch (`git push origin feature/NewFeature`)
5. Open a Pull Request

---

## 📜 License & Third-Party Credits

AudioPro Tool is released under the **[MIT License](LICENSE)**.

### Third-Party Software Attribution:
* **[RNNoise](https://github.com/xiph/rnnoise)** — BSD-3-Clause (Jean-Marc Valin, Xiph.Org Foundation, Amazon, Mozilla)
* **[DeepFilterNet](https://github.com/Rikorose/DeepFilterNet)** — MIT / Apache-2.0 (Hendrik Schröter)
* **[miniaudio / dr_wav](https://github.com/mackron/miniaudio)** — MIT-0 / Public Domain (David Reid)
* **[Adobe CSInterface](https://github.com/Adobe-CEP/CEP-Resources)** — Adobe MIT-style License

Full third-party license details are available in [NoiseClean/LICENSES.md](NoiseClean/LICENSES.md).

---

<div align="center">

Developed with ❤️ by **[Md Mahadi (ByteWhisker)](https://github.com/bytewhisker)**

*If you find this project useful, please consider giving it a ⭐ on GitHub!*

</div>
