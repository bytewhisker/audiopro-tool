/**
 * NoiseClean - Audio Resampling and WAV Formatting Utilities
 * Guarantees frame-accurate duration preservation, channel preservation, and valid standard WAV generation.
 */

const fs = require('fs');

/**
 * Resamples an interleaved Float32Array of samples using 4-point cubic Hermite interpolation.
 * @param {Float32Array} inSamples 
 * @param {number} inSampleRate 
 * @param {number} outSampleRate 
 * @param {number} numChannels 
 * @returns {Float32Array}
 */
function resampleFloatBuffer(inSamples, inSampleRate, outSampleRate, numChannels) {
    if (inSampleRate === outSampleRate) {
        return inSamples;
    }
    const ratio = outSampleRate / inSampleRate;
    const inFrames = Math.floor(inSamples.length / numChannels);
    const outFrames = Math.round(inFrames * ratio);
    const outSamples = new Float32Array(outFrames * numChannels);

    for (let ch = 0; ch < numChannels; ch++) {
        for (let i = 0; i < outFrames; i++) {
            const srcPos = i / ratio;
            const srcIdx = Math.floor(srcPos);
            const frac = srcPos - srcIdx;

            const idx0 = Math.max(0, srcIdx - 1) * numChannels + ch;
            const idx1 = Math.min(inFrames - 1, srcIdx) * numChannels + ch;
            const idx2 = Math.min(inFrames - 1, srcIdx + 1) * numChannels + ch;
            const idx3 = Math.min(inFrames - 1, srcIdx + 2) * numChannels + ch;

            const p0 = inSamples[idx0];
            const p1 = inSamples[idx1];
            const p2 = inSamples[idx2];
            const p3 = inSamples[idx3];

            const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
            const b = p0 - 2.5 * p1 + 2.0 * p2 - 0.5 * p3;
            const c = -0.5 * p0 + 0.5 * p2;
            const d = p1;

            outSamples[i * numChannels + ch] = a * frac * frac * frac + b * frac * frac + c * frac + d;
        }
    }
    return outSamples;
}

/**
 * Parses WAV metadata and PCM samples from a Buffer.
 * Supports 16-bit PCM, 24-bit PCM, 32-bit integer PCM, and 32-bit IEEE float.
 * @param {Buffer} buffer 
 * @returns {{ numChannels: number, sampleRate: number, totalFrames: number, bitsPerSample: number, samples: Float32Array }}
 */
function parseWav(buffer) {
    if (buffer.length < 44) {
        throw new Error('File is too small to be a valid WAV file');
    }
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
        throw new Error('Not a valid RIFF/WAVE file header');
    }

    let offset = 12;
    let numChannels = 0;
    let sampleRate = 0;
    let bitsPerSample = 0;
    let audioFormat = 0;
    let dataBuffer = null;

    while (offset < buffer.length - 8) {
        const chunkId = buffer.toString('ascii', offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);
        offset += 8;

        if (chunkId === 'fmt ') {
            audioFormat = buffer.readUInt16LE(offset);
            numChannels = buffer.readUInt16LE(offset + 2);
            sampleRate = buffer.readUInt32LE(offset + 4);
            bitsPerSample = buffer.readUInt16LE(offset + 14);
        } else if (chunkId === 'data') {
            dataBuffer = buffer.subarray(offset, Math.min(buffer.length, offset + chunkSize));
        }
        offset += chunkSize;
        if (chunkSize % 2 !== 0) offset++;
    }

    if (!dataBuffer || !numChannels || !sampleRate) {
        throw new Error('Invalid WAV structure: missing fmt or data chunks');
    }

    const bytesPerSample = bitsPerSample / 8;
    const totalSamples = Math.floor(dataBuffer.length / bytesPerSample);
    const totalFrames = Math.floor(totalSamples / numChannels);
    const samples = new Float32Array(totalSamples);

    if (bitsPerSample === 16) {
        for (let i = 0; i < totalSamples; i++) {
            samples[i] = dataBuffer.readInt16LE(i * 2) / 32768.0;
        }
    } else if (bitsPerSample === 24) {
        for (let i = 0; i < totalSamples; i++) {
            const b0 = dataBuffer[i * 3];
            const b1 = dataBuffer[i * 3 + 1];
            const b2 = dataBuffer[i * 3 + 2];
            let val = (b2 << 24) | (b1 << 16) | (b0 << 8);
            val = val >> 8;
            samples[i] = val / 8388608.0;
        }
    } else if (bitsPerSample === 32 && audioFormat === 3) {
        for (let i = 0; i < totalSamples; i++) {
            samples[i] = dataBuffer.readFloatLE(i * 4);
        }
    } else if (bitsPerSample === 32) {
        for (let i = 0; i < totalSamples; i++) {
            samples[i] = dataBuffer.readInt32LE(i * 4) / 2147483648.0;
        }
    } else {
        throw new Error(`Unsupported bit depth: ${bitsPerSample} bits (supported: 16, 24, 32-bit PCM/Float)`);
    }

    return { numChannels, sampleRate, totalFrames, bitsPerSample, samples };
}

/**
 * Encodes Float32Array samples into a standard 16-bit PCM WAV file.
 * @param {string} filePath 
 * @param {number} sampleRate 
 * @param {number} numChannels 
 * @param {Float32Array} samples 
 */
function writeWavFile(filePath, sampleRate, numChannels, samples) {
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // Linear PCM
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34);

    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        let s = samples[i];
        if (s > 1.0) s = 1.0;
        if (s < -1.0) s = -1.0;
        buffer.writeInt16LE(Math.round(s * 32767), offset);
        offset += 2;
    }

    fs.writeFileSync(filePath, buffer);
}

module.exports = {
    resampleFloatBuffer,
    parseWav,
    writeWavFile
};
