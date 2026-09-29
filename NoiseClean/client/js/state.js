/**
 * NoiseClean - Central Application State Machine (CapCut Style)
 */

const AppStates = {
    NO_SELECTION: 'NO_SELECTION',
    IDLE: 'IDLE',
    PROCESSING: 'PROCESSING',
    ERROR: 'ERROR'
};

class StateManager {
    constructor() {
        this.currentState = AppStates.NO_SELECTION;
        this.sourceInfo = null;
        this.isNoiseCleanActive = false;
        this.reductionDb = 80;
        this.resembleEnhance = false;
        this.resembleStatus = { ready: false, deviceName: null };
        this.progress = { message: '', percent: 0 };
        this.lastError = null;
        this.cleanedHistory = new Map(); // layerIdentifier -> { originalPath, cleanedPath, isVideo }
        this.listeners = new Set();
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        for (const listener of this.listeners) {
            try {
                listener(this.getStateSnapshot());
            } catch (err) {
                console.error('[StateManager] Listener error:', err);
            }
        }
    }

    getStateSnapshot() {
        return {
            state: this.currentState,
            sourceInfo: this.sourceInfo,
            isNoiseCleanActive: this.isNoiseCleanActive,
            reductionDb: this.reductionDb,
            resembleEnhance: this.resembleEnhance,
            resembleStatus: this.resembleStatus,
            progress: this.progress,
            lastError: this.lastError
        };
    }

    setSource(sourceInfo) {
        if (this.currentState === AppStates.PROCESSING) return;

        this.sourceInfo = sourceInfo;
        if (sourceInfo && sourceInfo.hasSelection) {
            this.currentState = AppStates.IDLE;
            this.isNoiseCleanActive = !!sourceInfo.isCleaned;
            this.lastError = null;
        } else {
            this.currentState = AppStates.NO_SELECTION;
            this.isNoiseCleanActive = false;
        }
        this.notify();
    }

    setReductionDb(db) {
        this.reductionDb = db;
        this.notify();
    }

    setResembleEnhance(enabled) {
        this.resembleEnhance = !!enabled;
        this.notify();
    }

    setResembleStatus(status) {
        this.resembleStatus = status || { ready: false, deviceName: null };
        this.notify();
    }

    startProcessing(msg = 'Cleaning audio with NoiseClean AI...') {
        this.currentState = AppStates.PROCESSING;
        this.progress = { message: msg, percent: 15 };
        this.lastError = null;
        this.notify();
    }

    updateProgress(percent, msg) {
        if (this.currentState !== AppStates.PROCESSING) return;
        this.progress = {
            message: msg || this.progress.message,
            percent: Math.min(100, Math.max(0, percent))
        };
        this.notify();
    }

    setCompleted(active = true) {
        this.currentState = AppStates.IDLE;
        this.isNoiseCleanActive = active;
        this.progress = { message: 'Done', percent: 100 };
        this.lastError = null;
        this.notify();
    }

    setError(err) {
        this.currentState = AppStates.ERROR;
        this.lastError = typeof err === 'string' ? err : (err && err.message ? err.message : 'Processing failed');
        this.notify();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppStates, StateManager };
}
