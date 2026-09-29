# Third-Party Software Licenses and Attribution

NoiseClean bundles or integrates the following third-party open-source components. This document provides full legal attribution, licensing details, and redistribution compliance for commercial distribution (including via aescripts + aeplugins).

---

## 1. RNNoise (C Source & Pretrained Model Tables)
* **Component Name:** RNNoise (Recurrent Neural Network for Audio Noise Reduction)
* **Version:** 0.1.1 (Commit: `6cbfd53eb348a8d394e0757b4025c6ded34eb2b6`)
* **License:** BSD 3-Clause
* **Copyright Holders:**
  * Copyright (c) 2007-2017, 2024 Jean-Marc Valin
  * Copyright (c) 2023 Amazon
  * Copyright (c) 2017 Mozilla
  * Copyright (c) 2005-2017 Xiph.Org Foundation
  * Copyright (c) 2003-2004 Mark Borgerding
* **Source URL:** https://github.com/xiph/rnnoise
* **Model/Weights Licensing Status:** In upstream RNNoise tag `v0.1.1`, the neural network weights are compiled directly into static C arrays (`rnn_data.c`). The entire source tree, including `rnn_data.c`, is covered under the project's BSD-3-Clause `COPYING` file. The training datasets used are public speech and acoustic noise corpora.
* **Redistribution Requirements:** Redistribution in binary form must reproduce the copyright notice, conditions, and disclaimer in documentation/materials provided with distribution. Commercial redistribution is permitted under BSD-3-Clause.
* **License File:** `resources/licenses/COPYING_RNNOISE.txt`

---

## 2. DeepFilterNet3 (WebAssembly DSP Core & Neural Network Model)
* **Component Name:** DeepFilterNet (Low-Complexity Speech Enhancement via Deep Filtering)
* **Version:** DeepFilterNet3 (v0.5.6 core architecture)
* **License:** Dual-licensed MIT License or Apache License 2.0
* **Copyright Holder:** Copyright (c) 2021-2024 Hendrik Schröter (Rikorose)
* **Source URL:** https://github.com/Rikorose/DeepFilterNet
* **Model/Weights Licensing Status:** The pretrained DeepFilterNet3 model (`DeepFilterNet3_onnx.tar.gz`) is published and distributed under the same permissive MIT / Apache-2.0 open-source terms as the project repository. It is trained on public datasets (DNS Challenge, CommonVoice).
* **Redistribution Requirements:** Requires inclusion of copyright notice and permission notice in all copies or substantial portions of the software. Commercial redistribution is fully permitted under MIT and Apache-2.0.
* **License File:** `resources/licenses/LICENSE_DEEPFILTERNET.txt`

---

## 3. miniaudio & dr_wav
* **Component Name:** miniaudio (Audio Playback, Decoding, Resampling & Conversion) & dr_wav
* **Version:** 0.11.25 / dr_wav 0.14.6
* **License:** Choice of Public Domain (Unlicense) or MIT-0 (No Attribution Required)
* **Copyright Holder:** Copyright (c) 2018-2024 David Reid
* **Source URL:** https://github.com/mackron/miniaudio
* **Redistribution Requirements:** Unencumbered software released into the public domain or under MIT-0. Permitted for commercial use, modification, and redistribution without restriction.
* **License File:** `resources/licenses/LICENSE_MINIAUDIO.txt`

---

## 4. Adobe CSInterface
* **Component Name:** Adobe Common Extensibility Platform CSInterface (CEP)
* **Version:** 11.0.0
* **License:** Adobe MIT-style License
* **Copyright Holder:** Copyright (c) 2014-2024 Adobe Systems Incorporated
* **Source URL:** https://github.com/Adobe-CEP/CEP-Resources
* **Redistribution Requirements:** Permitted for distribution with Adobe CEP panel extensions.

---

## Commercial Distribution Compliance Summary
1. **No Copyleft / GPL / AGPL:** None of the components utilized by NoiseClean are licensed under GPL, LGPL, AGPL, or restrictive non-commercial licenses (such as CC-NC). All dependencies are BSD-3-Clause, MIT, Apache-2.0, or Public Domain / MIT-0.
2. **Offline-First:** All model weights, binaries, and execution runtimes are 100% self-contained within the extension directory. Zero cloud connections, zero runtime downloading, and zero per-use API fees are required.
3. **No External Runtime Requirement:** Users do not need to install Python, PyTorch, CUDA, Rust, or any custom command-line tools. Everything executes through the bundled native binaries and the embedded CEP Node.js runtime.
