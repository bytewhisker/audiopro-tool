/**
 * NoiseClean - Base NoiseEngine Abstraction
 * All noise suppression engines implement this uniform interface.
 */

class BaseNoiseEngine {
    constructor(id, name, description) {
        this.id = id;
        this.name = name;
        this.description = description;
    }

    /**
     * Initializes engine resources (pre-loading models, compiling wasm, checking binaries).
     * @returns {Promise<boolean>}
     */
    async initialize() {
        throw new Error('initialize() must be implemented by subclass');
    }

    /**
     * Processes input audio file and writes denoised output audio file.
     * @param {string} jobId Unique job ID
     * @param {string} inputWavPath Path to source WAV
     * @param {string} outputWavPath Path to destination cleaned WAV
     * @param {object} options Engine-specific settings (e.g. attenuation level)
     * @param {Function} onProgress Callback for status/progress reporting
     * @returns {Promise<{ success: boolean, durationSec: number, elapsedMs: number, rtf: number }>}
     */
    async process(jobId, inputWavPath, outputWavPath, options, onProgress) {
        throw new Error('process() must be implemented by subclass');
    }

    /**
     * Cancels an ongoing processing task.
     * @param {string} jobId 
     */
    cancel(jobId) {
        throw new Error('cancel() must be implemented by subclass');
    }
}

module.exports = BaseNoiseEngine;
