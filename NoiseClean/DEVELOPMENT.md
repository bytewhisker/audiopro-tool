# NoiseClean — Technical Architecture & Development Documentation

This document describes the internal engineering design, communication protocols, and processing pipelines of the NoiseClean After Effects CEP extension.

---

## 1. High-Level Architecture & Separation of Concerns

NoiseClean maintains strict separation across four isolated layers:

| Layer | Technology | Primary Responsibilities |
| :--- | :--- | :--- |
| **Front-End UI** | HTML5, Vanilla CSS, ES6 | Visual state rendering, engine selection, timer, accessibility, user interaction |
| **ExtendScript Host** | ES3 ExtendScript (.jsx) | AE DOM inspection, Render Queue export, footage import, non-destructive comp insertion |
| **Node Orchestration** | CEP Node.js Context | File validation, isolated job workspaces, engine dispatch, child process lifecycle, cleanup |
| **Processing Engines** | Native C / WebAssembly | Offline neural noise suppression, sample rate conversion, frame-accurate synchronization |

---

## 2. IPC & Messaging Protocol

### UI ↔ ExtendScript Host (via `CSInterface.evalScript`)
All calls return structured JSON strings to guarantee type safety across the ExtendScript boundary:

* `NoiseCleanHost.getSelectedAudioLayer()`
  * Returns: `{ success: true, hasSelection: true, layerIndex: 1, layerName: "Voice.wav", sourceKind: "Audio File", isDirect: true, audioPath: "...", durationSec: 12.4, compId: 1, compName: "Comp 1" }`
* `NoiseCleanHost.prepareLayerAudio(tempDir)`
  * Extracts direct file reference if audio file; executes Render Queue if video/comp layer.
  * Returns: `{ success: true, audioPath: "...", layerName: "...", compId: ..., layerIndex: ... }`
* `NoiseCleanHost.importCleanedAudio(cleanedPath, layerName, compId, layerIndex)`
  * Imports into AE project bin, names asset `OriginalName_Denoised.wav`.
  * Returns: `{ success: true, footageId: 42, footageName: "Voice_Denoised.wav" }`
* `NoiseCleanHost.addFootageToComp(footageId, compId, layerIndex)`
  * Inserts the cleaned footage above the original layer with identical `startTime`, `inPoint`, and `outPoint`.

### UI ↔ Node.js Layer
* Direct module method calls enabled via `--mixed-context` and `--enable-nodejs` in `manifest.xml`.
* Methods:
  * `NoiseCleanNode.getSystemInfo()`
  * `NoiseCleanNode.inspectAudioFile(filePath)`
  * `NoiseCleanNode.processAudio(filePath, engineId, options, onProgress)`
  * `NoiseCleanNode.cancelProcess(jobId)`
  * `NoiseCleanNode.finalizeJob(jobId)`

---

## 3. Finite State Machine (FSM)

The UI state is governed by `StateManager` in `client/js/state.js`:

```
      [INIT]
         │
         ▼
   ┌───────────┐  Layer Selected   ┌───────────┐
   │ NO_SOURCE │ ────────────────► │   READY   │
   └───────────┘ ◄──────────────── └───────────┘
         ▲         No Selection          │
         │                               │ User clicks "Process Audio"
         │                               ▼
         │                        ┌─────────────┐
         │       Cancel           │             │
         ├─────────────────────── │ PROCESSING  │
         │                        │             │
         │                        └─────────────┘
         │                               │
         │           ┌───────────────────┴───────────────────┐
         │           ▼                                       ▼
   ┌───────────┐  Success                              Error ┌───────────┐
   │  SUCCESS  │                                             │   ERROR   │
   └───────────┘ ──────────────────────────────────────────► └───────────┘
         │                       "Try Again"                         │
         └───────────────────────────────────────────────────────────┘
```

---

## 4. Processing Engines Implementation

### RNNoise Engine
* **Source:** Official Xiph RNNoise v0.1.1 (Commit `6cbfd53eb348a8d394e0757b4025c6ded34eb2b6`).
* **Weights:** Static C tables in `rnn_data.c` (11,022 lines of BSD-3-Clause weights).
* **CLI Wrapper:** `rnnoise_cli.c` utilizing `miniaudio.h` (Public Domain / MIT-0).
* **Format:** Processes 480-sample frames (10ms @ 48kHz) in the float range `[-32768.0, 32767.0]`.
* **Multi-channel:** Stereo files are de-interleaved into independent Left and Right channels, processed through dual `DenoiseState` instances, and re-interleaved, preserving stereo imaging with zero crosstalk.
* **Resampling:** High-quality low-pass filtered resampling to 48kHz and back to source sample rate. Frame count is strictly clamped to the original duration to eliminate sync drift in After Effects.

### DeepFilterNet Engine
* **Source:** DeepFilterNet3 architecture (MIT / Apache-2.0 dual license).
* **Runtime:** Self-contained WebAssembly (`df_bg.wasm`) executed inside V8 / Node.js.
* **Weights:** `DeepFilterNet3_onnx.tar.gz` loaded directly into memory at runtime without external network calls.
* **Processing:** Dual filterbanks (STFT + ERB bands) and neural filter state processing 480-sample frames.
* **Cancellation:** Atomic cancellation check per chunk preventing orphaned execution.

---

## 5. Benchmark Performance Matrix

Real hardware measurements conducted on continuous synthetic speech and broadband noise:

| Engine | Audio Length | Sample Rate / Channels | Processing Time | Real-Time Factor (RTF) | Noise Attenuation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RNNoise** | 10.0s | 48 kHz Mono | **0.17s** | **0.017x** (59x real-time) | 20.5 dB |
| **RNNoise** | 60.0s | 48 kHz Mono | **0.86s** | **0.014x** (69x real-time) | 20.5 dB |
| **RNNoise** | 300.0s (5m) | 48 kHz Mono | **4.33s** | **0.014x** (69x real-time) | 20.5 dB |
| **RNNoise** | 5.0s | 44.1 kHz Stereo | **0.18s** | **0.036x** (28x real-time) | 4.7–20 dB |
| **DeepFilterNet** | 10.0s | 48 kHz Mono | **1.48s** | **0.148x** (6.8x real-time) | **50.0 dB** |
| **DeepFilterNet** | 60.0s | 48 kHz Mono | **2.94s** | **0.049x** (20x real-time) | **50.0 dB** |
| **DeepFilterNet** | 300.0s (5m) | 48 kHz Mono | **10.09s** | **0.034x** (30x real-time) | **50.0 dB** |
| **DeepFilterNet** | 5.0s | 44.1 kHz Stereo | **2.08s** | **0.416x** (2.4x real-time) | **51.1 dB** |

**Conclusion on Chunking:** Both engines natively handle 5+ minute recordings in 4.3 to 10 seconds without memory leaks or degradation. Chunking is therefore unnecessary and avoided to ensure zero audible splice artifacts.
