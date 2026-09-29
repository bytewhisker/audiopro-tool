/**
 * NoiseClean - RNNoise Engine Adapter
 * Fast CPU-based Recurrent Neural Network noise suppression.
 */

const fs = require('fs');
const BaseNoiseEngine = require('./base-engine');
const paths = require('../paths');
const platform = require('../platform');
const processManager = require('../process-manager');
const { parseWav } = require('../resampler');

class RNNoiseEngine extends BaseNoiseEngine {
    constructor() {
        super(
            'rnnoise',
            'RNNoise',
            'Fast CPU noise suppression. Ideal for quick cleanup and long recordings.'
        );
        this.binaryPath = paths.getRNNoiseBinaryPath();
    }

    async initialize() {
        const verify = platform.verifyEngineAvailable('rnnoise');
        if (!verify.available) {
            throw new Error(verify.error);
        }
        return true;
    }

    async process(jobId, inputWavPath, outputWavPath, options = {}, onProgress = null) {
        await this.initialize();
        const startTime = Date.now();

        if (onProgress) {
            onProgress({ status: 'running', message: 'Running RNNoise engine...', progress: null });
        }

        // Read input audio duration for RTF reporting
        let audioDurationSec = 0;
        try {
            const buf = fs.readFileSync(inputWavPath);
            const meta = parseWav(buf);
            audioDurationSec = meta.totalFrames / meta.sampleRate;
        } catch (e) {
            // Non-critical if metadata read fails
        }

        const args = [inputWavPath, outputWavPath];

        const result = await processManager.runProcess(
            jobId,
            this.binaryPath,
            args,
            {
                timeoutMs: options.timeoutMs || 300000,
                onProgress: (p) => {
                    if (onProgress) {
                        onProgress({ status: 'running', message: p.text.trim() || 'Running RNNoise...', progress: null });
                    }
                }
            }
        );

        if (!fs.existsSync(outputWavPath) || fs.statSync(outputWavPath).size < 44) {
            throw new Error('RNNoise finished without producing a valid output file.');
        }

        const elapsedMs = Date.now() - startTime;
        const rtf = audioDurationSec > 0 ? (elapsedMs / 1000) / audioDurationSec : 0;

        return {
            success: true,
            engine: this.id,
            durationSec: audioDurationSec,
            elapsedMs,
            rtf
        };
    }

    cancel(jobId) {
        return processManager.cancelJob(jobId);
    }
}

module.exports = new RNNoiseEngine();
