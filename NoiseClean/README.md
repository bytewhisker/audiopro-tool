# NoiseClean — Professional AI Audio Noise Reduction CEP Extension for Adobe After Effects

NoiseClean is a production-ready Adobe After Effects CEP panel extension providing 100% offline, AI-powered audio noise suppression. Designed according to the official **aescripts + aeplugins** author guidelines, NoiseClean delivers commercial-grade audio restoration directly inside After Effects with zero cloud APIs, zero subscriptions, and zero external software dependencies.

---

## Key Features

* **Dual AI Engines:**
  * **Fast (RNNoise):** Ultra-fast recurrent neural network noise suppression running at **60x–70x Real-Time Factor** (~4 seconds to clean a 5-minute track). Excellent for speech cleanup, interviews, and long takes.
  * **Better Quality (DeepFilterNet):** Deep filtering neural network running at **20x–30x Real-Time Factor**, delivering up to **50+ dB** of broadband noise reduction while preserving natural vocal formants.
* **100% Offline & Private:** Operates entirely locally on the user's computer. No audio is ever uploaded to the cloud. No internet connection, account creation, or API tokens required.
* **Zero User Runtime Requirements:** No Python, no PyTorch, no CUDA, and no command-line tools needed. Everything runs out of the box via bundled self-contained binaries and the embedded CEP runtime.
* **Non-Destructive Workflow:** Original footage and audio remain completely untouched. Cleaned assets are imported directly into the project bin as `OriginalName_Denoised.wav` with an optional one-click **Add to Comp** action that aligns timing and frame boundaries with sample-accurate synchronization.
* **Native Adobe Dark UI:** Clean, responsive, motion-design dark aesthetic optimized for narrow docked After Effects panel widths (down to 280px).
* **Sample-Accurate Sync:** Automatic high-quality bandlimited resampling and frame clamping ensure 100% duration synchronization without drift.

---

## Compatibility

* **Host Applications:** Adobe After Effects CC 2019 (v16.0) through After Effects 2026+ (`AEFT [16.0, 99.9]`).
* **Operating Systems:**
  * **Windows:** Windows 10 / 11 (64-bit).
  * **macOS:** macOS Catalina (10.15) through macOS Sequoia (15.x) & macOS 26+ (Universal Apple Silicon & Intel).

---

## Architecture Overview

```
After Effects Composition
       │
       ▼
 [Select Layer]
       │
       ▼
 CEP Panel UI (HTML5 / Vanilla CSS / ES6)
       │
       ▼
 ExtendScript JSX Bridge (ES3) ──► Inspects layer & prepares temporary WAV
       │
       ▼
 Node.js Orchestration (Mixed-Context CEP)
       │
       ├─────────────────────────┬─────────────────────────┐
       ▼                         ▼                         ▼
 [RNNoise Engine]       [DeepFilterNet Engine]      [Audio Resampler]
  Fast CPU Binary        WebAssembly + ONNX Model    Cubic / Sinc Sample
  (10ms Frames)          (10ms Frames)               Rate Conversion
       │                         │                         │
       └─────────────────────────┴─────────────────────────┘
       │
       ▼
 Cleaned WAV (16-bit PCM, Frame-Accurate)
       │
       ▼
 ExtendScript JSX Bridge ──► Imports into Project Bin as OriginalName_Denoised.wav
       │
       ▼
 Optional: [Add to Composition] (Non-Destructive Layer Placement)
```

---

## Installation

### For Users (Production Distribution)
1. Install via the **aescripts + aeplugins manager app** (recommended), or install using the **ZXP/UXP Installer**.
2. Launch Adobe After Effects.
3. Open the extension from the top menu: **Window > Extensions > NoiseClean**.

### For Developers (Local Development)
1. Clone this repository:
   ```bash
   git clone https://github.com/audiopro/noiseclean.git
   cd noiseclean
   ```
2. Enable `PlayerDebugMode` in your operating system:
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
3. Link the extension to your Adobe CEP directory:
   ```bash
   node scripts/build/install-dev.js
   ```
4. Restart After Effects and navigate to **Window > Extensions > NoiseClean**.

---

## Building & Packaging

* **Test Orchestration Suite:**
  ```bash
  node test_orchestration.js
  ```
* **Build RNNoise Windows Binary (MSVC):**
  ```cmd
  NoiseClean\engines\rnnoise\src\build.bat
  ```
* **Build RNNoise macOS Universal Binary (Clang):**
  ```bash
  bash NoiseClean/engines/rnnoise/src/build.sh
  ```
* **Create Production Package (aescripts-compliant):**
  ```bash
  node scripts/package/package-zxp.js
  ```
  The production zip is output to `dist/NoiseClean_v1.0.0.zip` (with `.debug` and scratch files stripped).

---

## Troubleshooting & Debug Mode

1. **Remote Debugging:**
   In development mode, open Google Chrome and navigate to `http://localhost:8889` to inspect the panel console, DOM, and network activity.
2. **Developer Drawer in Panel:**
   Click the **Developer Console** toggle at the bottom of the panel to view live logs, including layer inspection details, sample rates, child process exit codes, and timing diagnostics.
3. **No Audio Layer Selected:**
   Ensure an active composition is open and a layer containing audio is selected. For video layers with audio, ensure the audio speaker icon on the layer is enabled.

---

## Licensing & Commercial Attribution

NoiseClean is proprietary commercial software. All included third-party libraries (RNNoise, DeepFilterNet, miniaudio, dr_wav) are permissively licensed under BSD-3-Clause, MIT, Apache-2.0, or Public Domain / MIT-0. Full attribution is documented in [LICENSES.md](LICENSES.md).
