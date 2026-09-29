/**
 * AudioPro Tool - 4-Stem AI Audio Splitter Engine
 * Decomposes audio into 4 stems: Vocals, Music, Drums, SFX/Ambience.
 * 100% offline, local CPU execution, zero cloud dependencies.
 */

const fs = require('fs');
const path = require('path');
const deepFilter = require('./deepfilternet-engine');
const { parseWav, writeWavFile, resampleFloatBuffer } = require('../resampler');
const paths = require('../paths');

class StemSeparatorEngine {
    constructor() {
        this.cancelledJobs = new Set();
    }

    /**
     * Splits an input WAV file into 4 distinct high-fidelity stems:
     * - Vocals (dialogue, speech, singing)
     * - Music (instruments, keys, synths, melody)
     * - Drums (kicks, snares, hats, percussive transients)
     * - SFX (room tone, Foley, atmospheric soundscapes)
     * 
     * @param {string} jobId Unique identifier for the job
     * @param {string} inputWavPath Path to source 48kHz WAV
     * @param {string} outputDir Directory where the 4 stems will be written
     * @param {string} baseClipName Base name for the generated stem files
     * @param {Function} onProgress Progress callback ({ status, message, percent })
     * @returns {Promise<{ vocals: string, music: string, drums: string, sfx: string, duration: number }>}
     */
    async split(jobId, inputWavPath, outputDir, baseClipName = 'clip', onProgress = null) {
        this.cancelledJobs.delete(jobId);
        paths.ensureDir(outputDir);

        const safeBase = (baseClipName || 'audio')
            .replace(/\.[a-zA-Z0-9]+$/, '')
            .replace(/[^a-zA-Z0-9_\-]/g, '_');

        const outVocals = path.join(outputDir, `${safeBase}_Vocals.wav`);
        const outMusic = path.join(outputDir, `${safeBase}_Music.wav`);
        const outDrums = path.join(outputDir, `${safeBase}_Drums.wav`);
        const outSFX = path.join(outputDir, `${safeBase}_SFX.wav`);

        if (onProgress) onProgress({ status: 'running', message: 'Analyzing source audio mix...', percent: 5 });

        // 1. Read and parse input WAV
        const rawBuf = fs.readFileSync(inputWavPath);
        const sourceWav = parseWav(rawBuf);
        const sr = 48000;
        let sourceSamples = sourceWav.samples;

        // Ensure 48 kHz
        if (sourceWav.sampleRate !== sr) {
            if (onProgress) onProgress({ status: 'running', message: `Resampling to ${sr} Hz...`, percent: 10 });
            sourceSamples = resampleFloatBuffer(sourceSamples, sourceWav.sampleRate, sr, sourceWav.numChannels);
        }

        const totalFrames = Math.floor(sourceSamples.length / sourceWav.numChannels);
        const durationSec = totalFrames / sr;

        // Convert to stereo if mono for uniform stem processing
        let stereoSource;
        if (sourceWav.numChannels === 1) {
            stereoSource = new Float32Array(totalFrames * 2);
            for (let i = 0; i < totalFrames; i++) {
                const s = sourceSamples[i];
                stereoSource[i * 2] = s;
                stereoSource[i * 2 + 1] = s;
            }
        } else {
            stereoSource = sourceSamples;
        }

        // 2. Extract Stem 1: Vocals using DeepFilterNet Neural Engine
        if (onProgress) onProgress({ status: 'running', message: 'Neural AI isolating vocal & dialogue stem...', percent: 20 });
        
        await deepFilter.initialize();
        if (this.cancelledJobs.has(jobId)) {
            this.cancelledJobs.delete(jobId);
            throw new Error('Stem separation was cancelled.');
        }

        const tempVocalWav = path.join(outputDir, `_temp_${jobId}_vocal.wav`);
        await deepFilter.process(
            `${jobId}_vocal`,
            inputWavPath,
            tempVocalWav,
            { attenuationDb: 70 },
            (p) => {
                if (onProgress) {
                    const mappedPercent = 20 + Math.round((p.progress || 30) * 0.35);
                    onProgress({ status: 'running', message: 'Neural AI isolating vocal & dialogue stem...', percent: Math.min(55, mappedPercent) });
                }
            }
        );

        if (this.cancelledJobs.has(jobId)) {
            try { fs.unlinkSync(tempVocalWav); } catch (e) {}
            this.cancelledJobs.delete(jobId);
            throw new Error('Stem separation was cancelled.');
        }

        // Read extracted vocals
        const vocBuf = fs.readFileSync(tempVocalWav);
        const vocWav = parseWav(vocBuf);
        let vocSamples = vocWav.samples;
        if (vocWav.sampleRate !== sr) {
            vocSamples = resampleFloatBuffer(vocSamples, vocWav.sampleRate, sr, vocWav.numChannels);
        }

        const vocFrames = Math.floor(vocSamples.length / vocWav.numChannels);
        const processFrames = Math.min(totalFrames, vocFrames);

        // Normalize vocals to stereo
        const vocalsStereo = new Float32Array(processFrames * 2);
        for (let i = 0; i < processFrames; i++) {
            if (vocWav.numChannels === 1) {
                vocalsStereo[i * 2] = vocSamples[i];
                vocalsStereo[i * 2 + 1] = vocSamples[i];
            } else {
                vocalsStereo[i * 2] = vocSamples[i * 2];
                vocalsStereo[i * 2 + 1] = vocSamples[i * 2 + 1];
            }
        }

        // Clean up temporary vocal file
        try { fs.unlinkSync(tempVocalWav); } catch (e) {}

        // 3. Compute Non-Vocal Residual (R = Source - Vocals)
        if (onProgress) onProgress({ status: 'running', message: 'Separating musical harmonics & percussive beats...', percent: 60 });

        const drumsStereo = new Float32Array(processFrames * 2);
        const musicStereo = new Float32Array(processFrames * 2);
        const sfxStereo = new Float32Array(processFrames * 2);

        // Multi-rate DSP envelope constants
        const dt = 1.0 / sr;
        const alphaFastAtt = 1 - Math.exp(-dt / 0.0008); // 0.8ms attack (drums)
        const alphaFastDec = 1 - Math.exp(-dt / 0.022);  // 22ms decay
        const alphaSlowAtt = 1 - Math.exp(-dt / 0.035);  // 35ms attack (music)
        const alphaSlowDec = 1 - Math.exp(-dt / 0.160);  // 160ms decay

        let envFastL = 0, envSlowL = 0;
        let envFastR = 0, envSlowR = 0;

        // Progress update throttle
        const updateInterval = Math.floor(processFrames / 8);

        for (let i = 0; i < processFrames; i++) {
            if (i % updateInterval === 0 && onProgress) {
                const subPct = 60 + Math.round((i / processFrames) * 25);
                onProgress({ status: 'running', message: 'Deconstructing 4 distinct audio stems...', percent: subPct });
            }

            const sL = stereoSource[i * 2];
            const sR = stereoSource[i * 2 + 1];
            const vL = vocalsStereo[i * 2];
            const vR = vocalsStereo[i * 2 + 1];

            // Non-vocal residual: sample-accurate phase subtraction
            let resL = sL - vL;
            let resR = sR - vR;

            // Clamping guard
            if (resL > 1.0) resL = 1.0; else if (resL < -1.0) resL = -1.0;
            if (resR > 1.0) resR = 1.0; else if (resR < -1.0) resR = -1.0;

            const absL = Math.abs(resL);
            const absR = Math.abs(resR);

            // Dual envelope followers for transient separation
            envFastL += (absL > envFastL ? alphaFastAtt : alphaFastDec) * (absL - envFastL);
            envFastR += (absR > envFastR ? alphaFastAtt : alphaFastDec) * (absR - envFastR);

            envSlowL += (absL > envSlowL ? alphaSlowAtt : alphaSlowDec) * (absL - envSlowL);
            envSlowR += (absR > envSlowR ? alphaSlowAtt : alphaSlowDec) * (absR - envSlowR);

            // Transient detection ratio (Drums / Percussion)
            const transL = Math.max(0, envFastL - envSlowL * 1.35);
            const transR = Math.max(0, envFastR - envSlowR * 1.35);
            const transWeightL = Math.min(1.0, transL / (envFastL + 0.0001));
            const transWeightR = Math.min(1.0, transR / (envFastR + 0.0001));

            // Drums stem: transient attack components
            const dL = resL * transWeightL;
            const dR = resR * transWeightR;
            drumsStereo[i * 2] = dL;
            drumsStereo[i * 2 + 1] = dR;

            // Sustained residual (Music + SFX)
            const sustL = resL - dL;
            const sustR = resR - dR;

            // Ambiance / SFX separation:
            // Side channel (L - R) contains diffuse stereo field and ambient reflections
            const side = (sustL - sustR) * 0.5;
            const energy = Math.max(envSlowL, envSlowR);

            // Low-level atmospheric decay (< -26dB) maps to SFX/Ambience
            const sfxWeight = Math.min(1.0, Math.max(0.0, (0.045 - energy) / 0.045)) * 0.75;
            const sfxL = sustL * sfxWeight + side * 0.35;
            const sfxR = sustR * sfxWeight - side * 0.35;

            sfxStereo[i * 2] = Math.max(-1.0, Math.min(1.0, sfxL));
            sfxStereo[i * 2 + 1] = Math.max(-1.0, Math.min(1.0, sfxR));

            // Music stem: pure sustained harmonic & melodic instruments
            const mL = sustL - sfxL * 0.55;
            const mR = sustR - sfxR * 0.55;
            musicStereo[i * 2] = Math.max(-1.0, Math.min(1.0, mL));
            musicStereo[i * 2 + 1] = Math.max(-1.0, Math.min(1.0, mR));
        }

        // 4. Write all 4 stem WAV files to disk
        if (onProgress) onProgress({ status: 'running', message: 'Writing high-fidelity 48 kHz stem masters...', percent: 90 });

        writeWavFile(outVocals, sr, 2, vocalsStereo);
        writeWavFile(outMusic, sr, 2, musicStereo);
        writeWavFile(outDrums, sr, 2, drumsStereo);
        writeWavFile(outSFX, sr, 2, sfxStereo);

        if (onProgress) onProgress({ status: 'completed', message: '4 Stems separated successfully!', percent: 100 });

        return {
            vocals: outVocals,
            music: outMusic,
            drums: outDrums,
            sfx: outSFX,
            duration: durationSec,
            sampleRate: sr
        };
    }

    cancel(jobId) {
        this.cancelledJobs.add(jobId);
        deepFilter.cancel(`${jobId}_vocal`);
        return true;
    }
}

module.exports = new StemSeparatorEngine();
