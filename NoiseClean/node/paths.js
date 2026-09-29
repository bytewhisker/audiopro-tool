/**
 * NoiseClean - Centralized Path Management
 * Handles cross-platform paths, temporary working directories, and engine binaries.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

class PathManager {
    constructor() {
        // Root directory of the extension (parent of 'node' directory)
        this.extensionRoot = path.resolve(__dirname, '..');
        this.tempBaseDir = path.join(os.tmpdir(), 'NoiseClean');
        this.ensureDir(this.tempBaseDir);
    }

    getExtensionRoot() {
        return this.extensionRoot;
    }

    getEnginesDir() {
        return path.join(this.extensionRoot, 'engines');
    }

    getModelsDir() {
        return path.join(this.extensionRoot, 'models');
    }

    getRNNoiseBinaryPath() {
        const isWin = process.platform === 'win32';
        if (isWin) {
            return path.join(this.getEnginesDir(), 'rnnoise', 'win', 'rnnoise.exe');
        } else {
            return path.join(this.getEnginesDir(), 'rnnoise', 'mac', 'rnnoise');
        }
    }

    getFFmpegPath() {
        const isWin = process.platform === 'win32';
        const bundled = path.join(this.getEnginesDir(), 'ffmpeg', isWin ? 'ffmpeg.exe' : 'ffmpeg');
        if (fs.existsSync(bundled)) {
            return bundled;
        }
        return isWin ? 'ffmpeg.exe' : 'ffmpeg';
    }

    getDeepFilterWasmPath() {
        return path.join(this.getEnginesDir(), 'deepfilternet', 'df_bg.wasm');
    }

    getDeepFilterModelPath() {
        return path.join(this.getModelsDir(), 'DeepFilterNet3_onnx.tar.gz');
    }

    getResembleRunnerPath() {
        return path.join(this.getEnginesDir(), 'resemble', 'resemble_runner.py');
    }

    createJobWorkspace(jobId, clipName) {
        const jobDir = path.join(this.tempBaseDir, jobId);
        this.ensureDir(jobDir);
        let safeBase = 'audio';
        if (clipName) {
            safeBase = path.basename(clipName, path.extname(clipName))
                .replace(/[^a-zA-Z0-9_\-]/g, '_');
        }
        return {
            jobDir,
            inputWav: path.join(jobDir, `${safeBase}_input.wav`),
            workingWav: path.join(jobDir, `${safeBase}_working.wav`),
            outputWav: path.join(jobDir, `${safeBase}_Cleaned.wav`)
        };
    }

    getTempBaseDir() {
        this.ensureDir(this.tempBaseDir);
        return this.tempBaseDir;
    }

    getCleanedMediaDir(sourceFilePath) {
        if (sourceFilePath && fs.existsSync(sourceFilePath)) {
            try {
                const parentDir = path.dirname(sourceFilePath);
                const targetDir = path.join(parentDir, 'AudioPro_Cleaned');
                this.ensureDir(targetDir);
                // Verify writable
                const test = path.join(targetDir, '.test_' + Date.now());
                fs.writeFileSync(test, '1');
                fs.unlinkSync(test);
                return targetDir;
            } catch (e) {
                // If original folder is read-only, fallback to persistent user folder
            }
        }
        // Persistent directory (outside of temp, will never be purged by Windows)
        const persistentDir = path.join(os.homedir(), 'Documents', 'AudioPro Tool', 'Cleaned Media');
        this.ensureDir(persistentDir);
        return persistentDir;
    }

    ensureDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
}

module.exports = new PathManager();
