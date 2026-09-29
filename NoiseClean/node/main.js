/**
 * NoiseClean - Node.js API Interface for CEP Panel
 * Provides structured messaging and high-level async methods for the CEP UI layer.
 */

const processor = require('./processor');
const platform = require('./platform');
const paths = require('./paths');
const cleanup = require('./cleanup');
const { parseWav } = require('./resampler');
const fs = require('fs');

// Auto-clean any abandoned temporary files from previous sessions
try {
    cleanup.cleanAll();
} catch (e) {}

const demuxer = require('./demuxer');
const studioEnhancer = require('./studio-enhancer');
const resembleEngine = require('./engines/resemble-engine');
const stemSeparator = require('./engines/stem-separator');

const NoiseCleanNode = {
    version: '1.0.0',
    paths: paths,
    demuxer: demuxer,
    studioEnhancer: studioEnhancer,
    resembleEngine: resembleEngine,
    stemSeparator: stemSeparator,
    fs: fs,

    /**
     * Splits an audio file into 4 distinct stems (Vocals, Music, Drums, SFX).
     * @param {string} inputFilePath 
     * @param {string} sourceMediaPath Original source media path (for saving in AudioPro_Stems folder)
     * @param {string} clipName 
     * @param {Function} onProgressCallback 
     */
    splitAudioStems: async function(inputFilePath, sourceMediaPath = null, clipName = 'clip', onProgressCallback = null) {
        const jobId = 'stem_' + Date.now().toString(36);
        const targetDir = paths.getStemsDir(sourceMediaPath || inputFilePath);
        return stemSeparator.split(jobId, inputFilePath, targetDir, clipName, onProgressCallback);
    },

    /**
     * Checks if Resemble AI GPU engine is ready.
     */
    checkResembleAvailability: async function() {
        return resembleEngine.checkEnvironment();
    },

    /**
     * Retrieves system and platform diagnostics.
     */
    getSystemInfo: function() {
        return {
            version: this.version,
            platform: platform.getPlatformInfo(),
            availableEngines: processor.getAvailableEngines()
        };
    },

    /**
     * Inspects an audio file and returns metadata (sample rate, channels, duration, bit depth).
     */
    inspectAudioFile: function(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'File does not exist' };
            }
            const buf = fs.readFileSync(filePath);
            const info = parseWav(buf);
            return {
                success: true,
                sampleRate: info.sampleRate,
                numChannels: info.numChannels,
                totalFrames: info.totalFrames,
                durationSec: info.totalFrames / info.sampleRate,
                bitsPerSample: info.bitsPerSample
            };
        } catch (err) {
            return {
                success: false,
                error: err.message
            };
        }
    },

    /**
     * Starts audio processing through the requested engine.
     * @param {string} inputFilePath 
     * @param {string} engineId 'rnnoise' or 'deepfilternet'
     * @param {object} options 
     * @param {Function} onProgressCallback 
     */
    processAudio: async function(inputFilePath, engineId, options = {}, onProgressCallback = null) {
        return processor.processAudio(inputFilePath, engineId, options, onProgressCallback);
    },

    /**
     * Cancels an ongoing processing task.
     * @param {string} jobId 
     */
    cancelProcess: function(jobId) {
        return processor.cancelProcess(jobId);
    },

    /**
     * Cleans up the temporary workspace after AE has completed importing the footage.
     * @param {string} jobId 
     */
    finalizeJob: function(jobId) {
        processor.finalizeJob(jobId);
    }
};

module.exports = NoiseCleanNode;
