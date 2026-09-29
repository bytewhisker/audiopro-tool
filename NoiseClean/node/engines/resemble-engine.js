/**
 * NoiseClean - Resemble Enhance Engine Adapter
 * Deep generative voice restoration and bandwidth extension powered by Resemble AI.
 * Runs locally via Python, PyTorch, and NVIDIA CUDA GPU.
 */

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const BaseNoiseEngine = require('./base-engine');

class ResembleEnhanceEngine extends BaseNoiseEngine {
    constructor() {
        super(
            'resemble',
            'Voice Restoration (GPU)',
            'Generative deep neural restoration and bandwidth extension (CUDA GPU accelerated).'
        );
        this.runnerPath = path.resolve(__dirname, '../../engines/resemble/resemble_runner.py');
        this.runningJobs = new Map(); // jobId -> ChildProcess
        this.envStatus = null;
        this.isChecking = false;
        this.pythonCmd = 'python';
    }

    /**
     * Inspects Python environment, PyTorch, CUDA, and Resemble Enhance availability.
     * @returns {Promise<{ ready: boolean, hasTorch: boolean, hasCuda: boolean, deviceName: string|null, error: string|null }>}
     */
    async checkEnvironment() {
        return new Promise((resolve) => {
            const proc = spawn(this.pythonCmd, [this.runnerPath, '--check-env'], {
                windowsHide: true
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', d => { stdout += d.toString(); });
            proc.stderr.on('data', d => { stderr += d.toString(); });

            proc.on('error', (err) => {
                const res = {
                    ready: false,
                    hasTorch: false,
                    hasCuda: false,
                    deviceName: null,
                    error: `Python command '${this.pythonCmd}' not found: ${err.message}`
                };
                this.envStatus = res;
                resolve(res);
            });

            proc.on('close', (code) => {
                try {
                    const lines = stdout.trim().split('\n');
                    for (let i = lines.length - 1; i >= 0; i--) {
                        const line = lines[i].trim();
                        if (line.startsWith('{') && line.endsWith('}')) {
                            const parsed = JSON.parse(line);
                            this.envStatus = parsed;
                            return resolve(parsed);
                        }
                    }
                } catch (e) {}

                const res = {
                    ready: false,
                    hasTorch: false,
                    hasCuda: false,
                    deviceName: null,
                    error: stderr || `Process exited with code ${code}`
                };
                this.envStatus = res;
                resolve(res);
            });
        });
    }

    async initialize() {
        const status = await this.checkEnvironment();
        return status.ready;
    }

    /**
     * Processes input WAV audio through Resemble Enhance.
     * @param {string} jobId Unique identifier for task management
     * @param {string} inputWavPath Source audio WAV file
     * @param {string} outputWavPath Destination audio WAV file
     * @param {object} options Parameters (nfe, mode, lambd, tau, solver)
     * @param {Function} onProgress Progress callback
     * @returns {Promise<{ success: boolean, durationSec: number, elapsedMs: number, rtf: number }>}
     */
    async process(jobId, inputWavPath, outputWavPath, options = {}, onProgress = null) {
        if (!fs.existsSync(inputWavPath)) {
            throw new Error(`Input audio file not found: ${inputWavPath}`);
        }

        const args = [
            this.runnerPath,
            '--input', inputWavPath,
            '--output', outputWavPath,
            '--mode', options.mode || 'enhance',
            '--device', options.device || 'cuda',
            '--nfe', String(options.nfe || 32),
            '--solver', options.solver || 'midpoint',
            '--lambd', String(options.lambd !== undefined ? options.lambd : 0.5),
            '--tau', String(options.tau !== undefined ? options.tau : 0.5),
            '--chunk-seconds', String(options.chunkSeconds || 5.0),
            '--output-sr', '48000'
        ];

        return new Promise((resolve, reject) => {
            const proc = spawn(this.pythonCmd, args, {
                windowsHide: true,
                env: Object.assign({}, process.env, {
                    PYTORCH_CUDA_ALLOC_CONF: 'max_split_size_mb:128'
                })
            });

            this.runningJobs.set(jobId, proc);

            let lastResult = null;
            let stderrBuffer = '';

            proc.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const msg = JSON.parse(trimmed);
                        if (msg.type === 'progress') {
                            if (typeof onProgress === 'function') {
                                onProgress({
                                    status: 'running',
                                    message: msg.message,
                                    progress: msg.percent
                                });
                            }
                        } else if (msg.type === 'done') {
                            lastResult = msg;
                        } else if (msg.type === 'error') {
                            reject(new Error(msg.error || 'Voice Restoration processing failed.'));
                        }
                    } catch (e) {
                        // Non-JSON debug output
                    }
                }
            });

            proc.stderr.on('data', (data) => {
                stderrBuffer += data.toString();
            });

            proc.on('error', (err) => {
                this.runningJobs.delete(jobId);
                reject(new Error(`Failed to launch Voice Restoration runner: ${err.message}`));
            });

            proc.on('close', (code, signal) => {
                this.runningJobs.delete(jobId);

                if (signal === 'SIGTERM' || signal === 'SIGKILL') {
                    return reject(new Error('Process was cancelled by the user.'));
                }

                if (code === 0 && lastResult && fs.existsSync(outputWavPath)) {
                    resolve({
                        success: true,
                        engine: this.id,
                        durationSec: lastResult.durationSec,
                        elapsedMs: lastResult.elapsedMs,
                        rtf: lastResult.rtf
                    });
                } else {
                    const errMsg = (stderrBuffer || '').slice(-400) || `Process exited with code ${code}`;
                    reject(new Error(`Voice Restoration failed: ${errMsg}`));
                }
            });
        });
    }

    cancel(jobId) {
        const proc = this.runningJobs.get(jobId);
        if (proc) {
            try {
                proc.kill('SIGTERM');
            } catch (e) {
                try { proc.kill(); } catch (e2) {}
            }
            this.runningJobs.delete(jobId);
            return true;
        }
        return false;
    }
}

module.exports = new ResembleEnhanceEngine();
