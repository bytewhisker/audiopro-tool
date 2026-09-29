/**
 * NoiseClean - Temporary File and Workspace Cleanup Manager
 */

const fs = require('fs');
const path = require('path');
const paths = require('./paths');

class CleanupManager {
    constructor() {
        this.activeJobs = new Set();
    }

    generateJobId() {
        const timestamp = Date.now();
        const rand = Math.random().toString(36).substring(2, 8);
        const jobId = `job_${timestamp}_${rand}`;
        this.activeJobs.add(jobId);
        return jobId;
    }

    cleanJob(jobId, delayMs = 0) {
        if (!jobId) return;

        const performCleanup = () => {
            try {
                const jobDir = path.join(paths.tempBaseDir, jobId);
                if (fs.existsSync(jobDir)) {
                    // Remove all files inside jobDir
                    const files = fs.readdirSync(jobDir);
                    for (const f of files) {
                        try {
                            fs.unlinkSync(path.join(jobDir, f));
                        } catch (e) {}
                    }
                    try {
                        fs.rmdirSync(jobDir);
                    } catch (e) {}
                }
                this.activeJobs.delete(jobId);
            } catch (err) {
                console.error(`[NoiseClean Cleanup] Error cleaning job ${jobId}:`, err);
            }
        };

        if (delayMs > 0) {
            setTimeout(performCleanup, delayMs);
        } else {
            performCleanup();
        }
    }

    cleanAll() {
        try {
            if (fs.existsSync(paths.tempBaseDir)) {
                const entries = fs.readdirSync(paths.tempBaseDir);
                for (const e of entries) {
                    const fullPath = path.join(paths.tempBaseDir, e);
                    try {
                        if (fs.lstatSync(fullPath).isDirectory()) {
                            fs.rmSync(fullPath, { recursive: true, force: true });
                        } else {
                            fs.unlinkSync(fullPath);
                        }
                    } catch (err) {}
                }
            }
        } catch (e) {}
    }
}

module.exports = new CleanupManager();
