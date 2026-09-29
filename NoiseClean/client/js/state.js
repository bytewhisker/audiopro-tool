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
        this.activeTab = 'voice'; // 'voice' | 'stems'
        this.stemsState = {
            status: 'idle', // 'idle' | 'splitting' | 'ready' | 'error'
            stems: null, // { voice, music, noise, duration }
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            percent: 0,
            message: '',
            stemStates: {
                voice: { solo: false, mute: false },
                music: { solo: false, mute: false }
            }
        };
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
            lastError: this.lastError,
            activeTab: this.activeTab,
            stemsState: this.stemsState
        };
    }

    setActiveTab(tab) {
        this.activeTab = tab;
        this.notify();
    }

    startStemSplitting(msg = 'Analyzing audio mix...') {
        this.stemsState.status = 'splitting';
        this.stemsState.percent = 10;
        this.stemsState.message = msg;
        this.lastError = null;
        this.notify();
    }

    updateStemProgress(percent, msg) {
        if (this.stemsState.status !== 'splitting') return;
        this.stemsState.percent = Math.min(100, Math.max(0, percent));
        if (msg) this.stemsState.message = msg;
        this.notify();
    }

    setStemsReady(stemsData) {
        this.stemsState.status = 'ready';
        this.stemsState.stems = stemsData;
        this.stemsState.duration = stemsData.duration || 0;
        this.stemsState.currentTime = 0;
        this.stemsState.isPlaying = false;
        this.stemsState.percent = 100;
        this.stemsState.message = 'Vocal & Music stems ready';
        this.notify();
    }

    setStemPlayback(isPlaying, currentTime, duration) {
        this.stemsState.isPlaying = isPlaying;
        if (typeof currentTime === 'number') this.stemsState.currentTime = currentTime;
        if (typeof duration === 'number' && duration > 0) this.stemsState.duration = duration;
        this.notify();
    }

    setStemSoloMute(stemStates) {
        this.stemsState.stemStates = stemStates;
        this.notify();
    }

    setStemError(err) {
        this.stemsState.status = 'error';
        this.lastError = typeof err === 'string' ? err : (err && err.message ? err.message : 'Stem separation failed');
        this.notify();
    }

    setSource(sourceInfo) {
        if (this.currentState === AppStates.PROCESSING || this.stemsState.status === 'splitting') return;

        const prevLayerKey = this.sourceInfo ? `${this.sourceInfo.compId}_${this.sourceInfo.layerIndex}` : null;
        const newLayerKey = sourceInfo ? `${sourceInfo.compId}_${sourceInfo.layerIndex}` : null;

        // If user changed layer in AE, reset stems player state for fresh clip
        if (prevLayerKey && newLayerKey && prevLayerKey !== newLayerKey) {
            this.stemsState.status = 'idle';
            this.stemsState.stems = null;
            this.stemsState.isPlaying = false;
            this.stemsState.currentTime = 0;
            this.stemsState.duration = 0;
        }

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

