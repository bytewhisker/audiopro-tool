# Contributing to AudioPro Tool

First off, thank you for considering contributing to **AudioPro Tool**! Community contributions are what make open-source tools great.

---

## 🛠️ How to Contribute

### 1. Reporting Bugs
- Search existing [GitHub Issues](https://github.com/bytewhisker/audiopro-tool/issues) first to verify the issue has not already been reported.
- When filing a bug report, please include:
  - Operating system (Windows 10/11, macOS Intel / Apple Silicon)
  - Adobe After Effects version (e.g., CC 2024 v24.2)
  - Audio format tested (WAV, MP3, AAC, MP4, nested pre-comp)
  - Reproduction steps and any error logs from Chrome DevTools (`http://localhost:8889`)

### 2. Proposing Features
- Open an [Issue](https://github.com/bytewhisker/audiopro-tool/issues) tagged `enhancement`.
- Describe the feature, user workflow benefit, and any model or library requirements.

### 3. Local Development Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/bytewhisker/audiopro-tool.git
   cd audiopro-tool/NoiseClean
   ```
2. Enable Adobe CEP Debug Mode:
   - **Windows:**
     ```powershell
     reg add "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f
     reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f
     reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f
     ```
   - **macOS:**
     ```bash
     defaults write com.adobe.CSXS.10 PlayerDebugMode 1
     defaults write com.adobe.CSXS.11 PlayerDebugMode 1
     defaults write com.adobe.CSXS.12 PlayerDebugMode 1
     ```
3. Install the dev extension:
   ```bash
   node scripts/build/install-dev.js
   ```
4. Launch After Effects:
   - Open **Window > Extensions > NoiseClean**
   - Open Chrome at `http://localhost:8889` for remote debugging.

### 4. Submitting Pull Requests (PRs)
- Fork the repository and create a feature branch (`git checkout -b feature/amazing-idea`).
- Ensure code follows existing styling conventions:
  - Clean ES6+ JavaScript for CEP panel frontend (`NoiseClean/client/`)
  - Robust ExtendScript ES3 compatibility for JSX host scripts (`NoiseClean/host/`)
  - Reliable Node.js orchestration (`NoiseClean/node/`)
- Commit changes with descriptive messages:
  ```bash
  git commit -m "feat: add automatic vocal level leveling"
  ```
- Push to your branch and open a Pull Request against `main`.

---

## 📜 Code of Conduct
Please maintain a welcoming, respectful, and collaborative environment for everyone.
