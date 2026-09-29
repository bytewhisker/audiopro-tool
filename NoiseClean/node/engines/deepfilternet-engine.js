/**
 * NoiseClean - DeepFilterNet Engine Adapter
 * DeepFilterNet3 speech enhancement engine running via WebAssembly + ONNX model weights.
 * 100% offline, cross-platform (Windows & macOS), zero Python/PyTorch requirement.
 */

const fs = require('fs');
const crypto = require('crypto');
const BaseNoiseEngine = require('./base-engine');
const paths = require('../paths');
const platform = require('../platform');
const { parseWav, writeWavFile, resampleFloatBuffer } = require('../resampler');

if (!globalThis.crypto) {
    globalThis.crypto = crypto.webcrypto;
}

class DeepFilterNetEngine extends BaseNoiseEngine {
    constructor() {
        super(
            'deepfilternet',
            'NoiseClean AI',
            'Advanced neural AI voice isolation and background suppression.'
        );
        this.wasmPath = paths.getDeepFilterWasmPath();
        this.modelPath = paths.getDeepFilterModelPath();
        this.wasmInstance = null;
        this.compiledModule = null;
        this.modelBytes = null;
        this.helpers = null;
        this.cancelledJobs = new Set();
    }

    async initialize() {
        if (this.wasmInstance && this.modelBytes) {
            return true;
        }

        const verify = platform.verifyEngineAvailable('deepfilternet');
        if (!verify.available) {
            throw new Error(verify.error);
        }

        const wasmBuf = fs.readFileSync(this.wasmPath);
        this.modelBytes = fs.readFileSync(this.modelPath);

        let instanceExports;
        let cachedFloat32ArrayMemory0 = null;
        let cachedUint8ArrayMemory0 = null;
        let WASM_VECTOR_LEN = 0;

        function getFloat32ArrayMemory0() {
            if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
                cachedFloat32ArrayMemory0 = new Float32Array(instanceExports.memory.buffer);
            }
            return cachedFloat32ArrayMemory0;
        }

        function getUint8ArrayMemory0() {
            if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
                cachedUint8ArrayMemory0 = new Uint8Array(instanceExports.memory.buffer);
            }
            return cachedUint8ArrayMemory0;
        }

        function passArray8ToWasm0(arg, malloc) {
            const ptr = malloc(arg.length * 1, 1) >>> 0;
            getUint8ArrayMemory0().set(arg, ptr / 1);
            WASM_VECTOR_LEN = arg.length;
            return ptr;
        }

        function passArrayF32ToWasm0(arg, malloc) {
            const ptr = malloc(arg.length * 4, 4) >>> 0;
            getFloat32ArrayMemory0().set(arg, ptr / 4);
            WASM_VECTOR_LEN = arg.length;
            return ptr;
        }

        function getStringFromWasm0(ptr, len) {
            return new TextDecoder('utf-8').decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
        }

        function addToExternrefTable0(obj) {
            const idx = instanceExports.__externref_table_alloc_command_export();
            instanceExports.__wbindgen_externrefs.set(idx, obj);
            return idx;
        }

        function handleError(f, args) {
            try {
                return f.apply(this, args);
            } catch (e) {
                const idx = addToExternrefTable0(e);
                instanceExports.__wbindgen_exn_store_command_export(idx);
            }
        }

        const import0 = {
            __proto__: null,
            __wbg___wbindgen_throw_344f42d3211c4765: function(arg0, arg1) {
                throw new Error(getStringFromWasm0(arg0, arg1));
            },
            __wbg_getRandomValues_cc7f052a444bb2ce: function() {
                return handleError(function (arg0, arg1) {
                    globalThis.crypto.getRandomValues(getUint8ArrayMemory0().subarray(arg0, arg0 + arg1));
                }, arguments);
            },
            __wbg_new_from_slice_ddf8b82c4d6af38e: function(arg0, arg1) {
                const ret = new Float32Array(getFloat32ArrayMemory0().subarray(arg0 / 4, arg0 / 4 + arg1));
                return ret;
            },
            __wbindgen_init_externref_table: function() {
                const table = instanceExports.__wbindgen_externrefs;
                const offset = table.grow(4);
                table.set(0, undefined);
                table.set(offset + 0, undefined);
                table.set(offset + 1, null);
                table.set(offset + 2, true);
                table.set(offset + 3, false);
            },
        };

        const imports = {
            __proto__: null,
            "./df_bg.js": import0,
        };

        this.compiledModule = await WebAssembly.compile(wasmBuf);
        const instantiated = await WebAssembly.instantiate(this.compiledModule, imports);
        instanceExports = instantiated.exports;
        instanceExports.__wbindgen_start();

        this.wasmInstance = instanceExports;
        this.helpers = {
            passArray8ToWasm0,
            passArrayF32ToWasm0,
            getWasmVectorLen: () => WASM_VECTOR_LEN
        };
        return true;
    }

    createDfState(attenuationDb = 50) {
        if (!this.cachedState) {
            const modelBytes = new Uint8Array(this.modelBytes);
            const ptr0 = this.helpers.passArray8ToWasm0(modelBytes, this.wasmInstance.__wbindgen_malloc_command_export);
            const len0 = this.helpers.getWasmVectorLen();
            const handle = this.wasmInstance.df_create(ptr0, len0, attenuationDb) >>> 0;
            const frameLength = this.wasmInstance.df_get_frame_length(handle) >>> 0;
            this.cachedState = { handle, frameLength, attenuationDb };
        } else if (this.cachedState.attenuationDb !== attenuationDb) {
            if (typeof this.wasmInstance.df_set_atten_lim === 'function') {
                this.wasmInstance.df_set_atten_lim(this.cachedState.handle, attenuationDb);
                this.cachedState.attenuationDb = attenuationDb;
            }
        }
        return this.cachedState;
    }

    processFrame(state, inSamples) {
        const inPtr = this.helpers.passArrayF32ToWasm0(inSamples, this.wasmInstance.__wbindgen_malloc_command_export);
        const inLen = this.helpers.getWasmVectorLen();
        return this.wasmInstance.df_process_frame(state.handle, inPtr, inLen);
    }

    async process(jobId, inputWavPath, outputWavPath, options = {}, onProgress = null) {
        await this.initialize();
        this.cancelledJobs.delete(jobId);
        const startTime = Date.now();

        if (onProgress) {
            onProgress({ status: 'running', message: 'Analyzing audio...', progress: null });
        }

        const inBuf = fs.readFileSync(inputWavPath);
        const wav = parseWav(inBuf);
        const audioDurationSec = wav.totalFrames / wav.sampleRate;

        const TARGET_SR = 48000;
        const needsResample = (wav.sampleRate !== TARGET_SR);
        let procSamples = wav.samples;

        if (needsResample) {
            if (onProgress) {
                onProgress({ status: 'running', message: `Resampling ${wav.sampleRate} Hz to 48000 Hz...`, progress: null });
            }
            procSamples = resampleFloatBuffer(wav.samples, wav.sampleRate, TARGET_SR, wav.numChannels);
        }

        if (this.cancelledJobs.has(jobId)) {
            this.cancelledJobs.delete(jobId);
            throw new Error('Process was cancelled by the user.');
        }

        if (onProgress) {
            onProgress({ status: 'running', message: 'Running NoiseClean AI neural engine...', progress: null });
        }

        const procFrames = Math.floor(procSamples.length / wav.numChannels);
        const attenuationDb = options.attenuationDb || 50;

        let cleaned48k;
        if (wav.numChannels === 1) {
            const state = this.createDfState(attenuationDb);
            cleaned48k = this.processChannelWithCancelCheck(jobId, state, procSamples, onProgress);
        } else {
            // Stereo / Multi-channel Dialogue Processing
            // Independent Left/Right neural states cause catastrophic phase divergence and ping-pong panning jumping.
            // Summing to coherent center dialogue and reconstructing dual-mono guarantees rock-solid stereo imaging.
            let energyL = 0;
            let energyR = 0;
            for (let i = 0; i < procFrames; i++) {
                energyL += Math.abs(procSamples[i * 2]);
                energyR += Math.abs(procSamples[i * 2 + 1]);
            }

            const mono = new Float32Array(procFrames);
            if (energyR < energyL * 0.05) {
                for (let i = 0; i < procFrames; i++) mono[i] = procSamples[i * 2];
            } else if (energyL < energyR * 0.05) {
                for (let i = 0; i < procFrames; i++) mono[i] = procSamples[i * 2 + 1];
            } else {
                for (let i = 0; i < procFrames; i++) {
                    mono[i] = 0.5 * (procSamples[i * 2] + procSamples[i * 2 + 1]);
                }
            }

            const state = this.createDfState(attenuationDb);
            const cleanMono = this.processChannelWithCancelCheck(jobId, state, mono, onProgress);

            cleaned48k = new Float32Array(procFrames * 2);
            for (let i = 0; i < procFrames; i++) {
                cleaned48k[i * 2] = cleanMono[i];
                cleaned48k[i * 2 + 1] = cleanMono[i];
            }
        }

        if (this.cancelledJobs.has(jobId)) {
            this.cancelledJobs.delete(jobId);
            throw new Error('Process was cancelled by the user.');
        }

        let finalSamples = cleaned48k;
        if (needsResample) {
            if (onProgress) {
                onProgress({ status: 'running', message: `Resampling back to original ${wav.sampleRate} Hz...`, progress: null });
            }
            finalSamples = resampleFloatBuffer(cleaned48k, TARGET_SR, wav.sampleRate, wav.numChannels);
            // Ensure exact duration preservation down to the sample
            const targetLen = wav.totalFrames * wav.numChannels;
            if (finalSamples.length > targetLen) {
                finalSamples = finalSamples.subarray(0, targetLen);
            }
        }

        if (onProgress) {
            onProgress({ status: 'running', message: 'Writing cleaned audio asset...', progress: null });
        }

        writeWavFile(outputWavPath, wav.sampleRate, wav.numChannels, finalSamples);

        if (!fs.existsSync(outputWavPath) || fs.statSync(outputWavPath).size < 44) {
            throw new Error('NoiseClean AI finished without producing a valid output file.');
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

    processChannelWithCancelCheck(jobId, state, samples, onProgress) {
        const frameLength = state.frameLength;
        const total = samples.length;
        const out = new Float32Array(total);
        const frameBuf = new Float32Array(frameLength);

        let offset = 0;
        while (offset < total) {
            if (this.cancelledJobs.has(jobId)) {
                throw new Error('Process was cancelled by the user.');
            }
            const chunk = Math.min(frameLength, total - offset);
            for (let i = 0; i < chunk; i++) {
                frameBuf[i] = samples[offset + i];
            }
            for (let i = chunk; i < frameLength; i++) {
                frameBuf[i] = 0;
            }

            const proc = this.processFrame(state, frameBuf);
            for (let i = 0; i < chunk; i++) {
                let s = proc[i];
                if (s > 1.0) s = 1.0;
                if (s < -1.0) s = -1.0;
                out[offset + i] = s;
            }
            offset += chunk;
        }
        return out;
    }

    cancel(jobId) {
        this.cancelledJobs.add(jobId);
        return true;
    }
}

module.exports = new DeepFilterNetEngine();
