/**
 * NoiseClean - Central Audio Processing Orchestrator
 * Coordinates engine selection, file validation, execution monitoring, and workspace lifecycle.
 */

const fs = require('fs');
const paths = require('./paths');
const platform = require('./platform');
const cleanup = require('./cleanup');
const deepfilterEngine = require('./engines/deepfilternet-engine');
const resembleEngine = require('./engines/resemble-engine');

class NoiseProcessor {
    constructor() {
        this.engines = new Map();
        this.registerEngine(deepfilterEngine);
        this.registerEngine(resembleEngine);
        this.activeJobs = new Map(); // jobId -> { engine, workspace }
    }

    registerEngine(engine) {
        this.engines.set(engine.id, engine);
    }

    getEngine(engineId) {
        return this.engines.get(engineId) || null;
    }

    getAvailableEngines() {
        const list = [];
        for (const [id, engine] of this.engines.entries()) {
            const status = platform.verifyEngineAvailable(id);
            list.push({
                id: engine.id,
                name: engine.name,
                description: engine.description,
                available: status.available,
                error: status.error || null
            });
        }
        return list;
    }

    /**
     * Executes the noise reduction pipeline for an audio file.
     * @param {string} inputFilePath Source audio file path
     * @param {string} engineId 'rnnoise' or 'deepfilternet'
     * @param {object} options Additional options (attenuationDb, timeoutMs)
     * @param {Function} onProgress Callback for status updates
     * @returns {Promise<{ success: boolean, outputWavPath: string, durationSec: number, elapsedMs: number, rtf: number, jobId: string }>}
     */
    async processAudio(inputFilePath, engineId = 'deepfilternet', options = {}, onProgress = null) {
        if (!inputFilePath || !fs.existsSync(inputFilePath)) {
            throw new Error(`Input audio file not found: ${inputFilePath}`);
        }

        const engine = this.getEngine(engineId);
        if (!engine) {
            throw new Error(`Selected noise reduction engine '${engineId}' is not installed or supported.`);
        }

        const jobId = cleanup.generateJobId();
        const baseName = (options && options.clipName) ? options.clipName : (inputFilePath ? require('path').basename(inputFilePath) : 'audio');
        const workspace = paths.createJobWorkspace(jobId, baseName);
        this.activeJobs.set(jobId, { engine, workspace });

        const logPrefix = `[NoiseClean][Job ${jobId}][${engine.name}]`;
        console.log(`${logPrefix} Starting process for: ${inputFilePath}`);

        try {
            // Avoid redundant file copies if input is already an uncompressed WAV
            let actualInputWav = workspace.inputWav;
            if (inputFilePath.toLowerCase().endsWith('.wav')) {
                actualInputWav = inputFilePath;
            } else {
                try {
                    fs.copyFileSync(inputFilePath, workspace.inputWav);
                } catch (copyErr) {
                    if (copyErr.code === 'ENOSPC' || copyErr.message.includes('ENOSPC')) {
                        throw new Error('ENOSPC: Insufficient disk space on your drive. Please free up space on your primary drive (C:) to continue.');
                    }
                    throw copyErr;
                }
            }

            // Execute engine
            const result = await engine.process(
                jobId,
                actualInputWav,
                workspace.outputWav,
                options,
                (statusUpdate) => {
                    if (onProgress) {
                        onProgress({ ...statusUpdate, jobId });
                    }
                }
            );

            console.log(`${logPrefix} Process finished in ${result.elapsedMs}ms (RTF: ${result.rtf.toFixed(2)}x)`);

            this.activeJobs.delete(jobId);

            return {
                success: true,
                jobId,
                outputWavPath: workspace.outputWav,
                durationSec: result.durationSec,
                elapsedMs: result.elapsedMs,
                rtf: result.rtf
            };
        } catch (err) {
            console.error(`${logPrefix} Error during processing:`, err.message);
            // On failure, clean up temporary files immediately
            cleanup.cleanJob(jobId);
            this.activeJobs.delete(jobId);
            throw err;
        }
    }

    /**
     * Cancels an ongoing processing job.
     * @param {string} jobId 
     */
    cancelProcess(jobId) {
        const job = this.activeJobs.get(jobId);
        if (job) {
            console.log(`[NoiseClean] Cancelling job: ${jobId}`);
            job.engine.cancel(jobId);
            cleanup.cleanJob(jobId, 500);
            this.activeJobs.delete(jobId);
            return true;
        }
        return false;
    }

    /**
     * Called after After Effects has successfully imported the cleaned WAV.
     * @param {string} jobId 
     */
    finalizeJob(jobId) {
        cleanup.cleanJob(jobId, 1000);
    }
}

module.exports = new NoiseProcessor();
