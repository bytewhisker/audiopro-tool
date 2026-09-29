/**
 * NoiseClean - Platform Detection and Environment Validation
 */

const fs = require('fs');
const os = require('os');
const paths = require('./paths');

class PlatformManager {
    constructor() {
        this.platform = process.platform; // 'win32' or 'darwin'
        this.arch = process.arch;         // 'x64' or 'arm64'
        this.isWindows = this.platform === 'win32';
        this.isMac = this.platform === 'darwin';
    }

    getPlatformInfo() {
        return {
            platform: this.platform,
            arch: this.arch,
            isWindows: this.isWindows,
            isMac: this.isMac,
            osRelease: os.release(),
            nodeVersion: process.version
        };
    }

    /**
     * Verifies that the required processing engine binary/model is accessible and executable.
     */
    verifyEngineAvailable(engineName) {
        if (engineName === 'rnnoise') {
            const binPath = paths.getRNNoiseBinaryPath();
            if (!fs.existsSync(binPath)) {
                return {
                    available: false,
                    path: binPath,
                    error: `RNNoise binary not found at expected path: ${binPath}`
                };
            }
            // Ensure executable permissions on macOS
            if (this.isMac) {
                try {
                    fs.chmodSync(binPath, 0o755);
                } catch (e) {
                    // Ignore if permission already set
                }
            }
            return { available: true, path: binPath };
        } else if (engineName === 'deepfilternet') {
            const wasmPath = paths.getDeepFilterWasmPath();
            const modelPath = paths.getDeepFilterModelPath();
            if (!fs.existsSync(wasmPath)) {
                return {
                    available: false,
                    path: wasmPath,
                    error: `NoiseClean WASM engine not found at: ${wasmPath}`
                };
            }
            if (!fs.existsSync(modelPath)) {
                return {
                    available: false,
                    path: modelPath,
                    error: `NoiseClean model weights not found at: ${modelPath}`
                };
            }
            return { available: true, wasmPath, modelPath };
        } else if (engineName === 'resemble') {
            const runnerPath = paths.getResembleRunnerPath();
            if (!fs.existsSync(runnerPath)) {
                return {
                    available: false,
                    path: runnerPath,
                    error: `Voice Restoration runner script not found at: ${runnerPath}`
                };
            }
            return { available: true, runnerPath };
        } else {
            return { available: false, error: `Unknown engine name: ${engineName}` };
        }
    }
}

module.exports = new PlatformManager();
