/**
 * NoiseClean - Robust Child Process Manager
 * Safely spawns processes with argument arrays, monitors execution, handles timeouts, and supports cancellation.
 */

const { spawn } = require('child_process');
const fs = require('fs');

class ProcessManager {
    constructor() {
        this.runningProcesses = new Map(); // jobId -> ChildProcess
    }

    /**
     * Executes an external binary safely using argument array.
     * @param {string} jobId Unique identifier for the job
     * @param {string} executablePath Absolute path to the executable binary
     * @param {string[]} args Array of arguments (paths, options)
     * @param {object} options Optional settings: { timeoutMs, onProgress }
     * @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>}
     */
    runProcess(jobId, executablePath, args, options = {}) {
        return new Promise((resolve, reject) => {
            const timeoutMs = options.timeoutMs || 300000; // 5 min default timeout
            let stdoutData = '';
            let stderrData = '';
            let isCancelled = false;

            if (!fs.existsSync(executablePath)) {
                return reject(new Error(`Executable binary not found: ${executablePath}`));
            }

            // Spawn without shell to prevent shell injection and handle spaces/quotes/Unicode cleanly
            const child = spawn(executablePath, args, {
                shell: false,
                windowsHide: true
            });

            this.runningProcesses.set(jobId, { child, cancelRequested: false });

            // Set up timeout timer
            const timer = setTimeout(() => {
                if (this.runningProcesses.has(jobId)) {
                    child.kill('SIGTERM');
                    setTimeout(() => {
                        try { child.kill('SIGKILL'); } catch (e) {}
                    }, 2000);
                    reject(new Error(`Process timed out after ${timeoutMs / 1000} seconds.`));
                }
            }, timeoutMs);

            child.stdout.on('data', (data) => {
                const text = data.toString('utf8');
                stdoutData += text;
                if (options.onProgress) {
                    options.onProgress({ stream: 'stdout', text });
                }
            });

            child.stderr.on('data', (data) => {
                const text = data.toString('utf8');
                stderrData += text;
                if (options.onProgress) {
                    options.onProgress({ stream: 'stderr', text });
                }
            });

            child.on('error', (err) => {
                clearTimeout(timer);
                this.runningProcesses.delete(jobId);
                reject(new Error(`Failed to start child process: ${err.message}`));
            });

            child.on('close', (code, signal) => {
                clearTimeout(timer);
                const procInfo = this.runningProcesses.get(jobId);
                this.runningProcesses.delete(jobId);

                if (procInfo && procInfo.cancelRequested) {
                    return reject(new Error('Process was cancelled by the user.'));
                }

                if (code === 0) {
                    resolve({ exitCode: 0, stdout: stdoutData, stderr: stderrData });
                } else {
                    const detail = stderrData.trim() || `Exit code ${code} (signal: ${signal})`;
                    reject(new Error(`Processing engine failed: ${detail}`));
                }
            });
        });
    }

    /**
     * Cancels an active job's child process.
     * @param {string} jobId 
     * @returns {boolean} True if cancelled
     */
    cancelJob(jobId) {
        const procInfo = this.runningProcesses.get(jobId);
        if (procInfo && procInfo.child) {
            procInfo.cancelRequested = true;
            try {
                procInfo.child.kill('SIGTERM');
                setTimeout(() => {
                    try { procInfo.child.kill('SIGKILL'); } catch (e) {}
                }, 1000);
            } catch (e) {}
            return true;
        }
        return false;
    }

    isJobRunning(jobId) {
        return this.runningProcesses.has(jobId);
    }
}

module.exports = new ProcessManager();
