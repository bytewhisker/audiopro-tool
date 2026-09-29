/**
 * AudioPro Tool - Web Audio 4-Stem Interactive Preview Player
 * Synchronized multi-track playback with real-time Solo [S], Mute [M], and timeline scrubbing.
 */

class StemPlayer {
    constructor() {
        this.audioCtx = null;
        this.stems = {}; // { vocals: { el, source, gain, solo, mute }, ... }
        this.stemKeys = ['voice', 'music', 'noise'];
        this.isPlaying = false;
        this.duration = 0;
        this.animFrameId = null;
        this.onProgressCallback = null;
        this.onStateChangeCallback = null;
    }

    initAudioContext() {
        if (!this.audioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioCtx();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    /**
     * Loads 3 audio stems (Voice, Music, Noise) from local disk paths.
     * @param {{ voice: string, music: string, noise: string }} stemPaths 
     */
    async loadStems(stemPaths) {
        this.stop();
        this.destroyStems();
        this.initAudioContext();

        const loadPromises = [];

        for (const key of this.stemKeys) {
            let rawPath = stemPaths[key];
            if (!rawPath && key === 'voice') rawPath = stemPaths.vocals;
            if (!rawPath && key === 'noise') rawPath = stemPaths.sfx;
            if (!rawPath) continue;

            // Format to file URL
            let fileUrl = rawPath;
            if (!fileUrl.startsWith('file://') && !fileUrl.startsWith('http')) {
                fileUrl = 'file:///' + rawPath.replace(/\\/g, '/');
            }

            const audioEl = new Audio();
            audioEl.crossOrigin = 'anonymous';
            audioEl.preload = 'auto';
            audioEl.src = fileUrl;

            // Create Web Audio gain node for 0ms click-free solo/mute routing
            const sourceNode = this.audioCtx.createMediaElementSource(audioEl);
            const gainNode = this.audioCtx.createGain();
            gainNode.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

            sourceNode.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);

            this.stems[key] = {
                el: audioEl,
                source: sourceNode,
                gain: gainNode,
                solo: false,
                mute: false,
                ready: false
            };

            const p = new Promise((resolve) => {
                audioEl.addEventListener('loadedmetadata', () => {
                    this.stems[key].ready = true;
                    if (audioEl.duration && audioEl.duration > this.duration) {
                        this.duration = audioEl.duration;
                    }
                    resolve();
                }, { once: true });

                audioEl.addEventListener('error', () => {
                    console.warn(`[StemPlayer] Error loading stem: ${key} (${fileUrl})`);
                    resolve();
                }, { once: true });
            });

            loadPromises.push(p);
        }

        await Promise.all(loadPromises);
        this.updateGains();

        if (this.onStateChangeCallback) {
            this.onStateChangeCallback({ isPlaying: false, duration: this.duration });
        }

        return true;
    }

    play() {
        if (this.isPlaying) return;
        this.initAudioContext();

        // Get master current time from first active stem
        let syncTime = 0;
        for (const key of this.stemKeys) {
            if (this.stems[key] && this.stems[key].el) {
                syncTime = this.stems[key].el.currentTime;
                break;
            }
        }

        // Loop protection: reset if near end
        if (this.duration > 0 && syncTime >= this.duration - 0.1) {
            syncTime = 0;
        }

        for (const key of this.stemKeys) {
            const item = this.stems[key];
            if (item && item.el) {
                item.el.currentTime = syncTime;
                item.el.play().catch(e => console.warn(`[StemPlayer] Play failed for ${key}:`, e));
            }
        }

        this.isPlaying = true;
        this.startProgressTracking();

        if (this.onStateChangeCallback) {
            this.onStateChangeCallback({ isPlaying: true, duration: this.duration });
        }
    }

    pause() {
        if (!this.isPlaying) return;
        for (const key of this.stemKeys) {
            const item = this.stems[key];
            if (item && item.el) {
                item.el.pause();
            }
        }

        this.isPlaying = false;
        this.stopProgressTracking();

        if (this.onStateChangeCallback) {
            this.onStateChangeCallback({ isPlaying: false, duration: this.duration });
        }
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    stop() {
        this.pause();
        this.seek(0);
    }

    seek(targetTime) {
        const clamped = Math.max(0, Math.min(this.duration, targetTime));
        for (const key of this.stemKeys) {
            const item = this.stems[key];
            if (item && item.el) {
                item.el.currentTime = clamped;
            }
        }
        if (this.onProgressCallback) {
            this.onProgressCallback({
                currentTime: clamped,
                duration: this.duration,
                percent: this.duration > 0 ? (clamped / this.duration) * 100 : 0
            });
        }
    }

    seekPercent(pct) {
        if (this.duration <= 0) return;
        this.seek((pct / 100) * this.duration);
    }

    toggleSolo(stemKey) {
        const target = this.stems[stemKey];
        if (!target) return;

        target.solo = !target.solo;
        // If un-muting when solo is pressed
        if (target.solo) {
            target.mute = false;
        }

        this.updateGains();
        return this.getStemStates();
    }

    toggleMute(stemKey) {
        const target = this.stems[stemKey];
        if (!target) return;

        target.mute = !target.mute;
        // Un-solo if muted
        if (target.mute) {
            target.solo = false;
        }

        this.updateGains();
        return this.getStemStates();
    }

    updateGains() {
        if (!this.audioCtx) return;

        // Check if any stem is in Solo mode
        let anySolo = false;
        for (const key of this.stemKeys) {
            if (this.stems[key] && this.stems[key].solo) {
                anySolo = true;
                break;
            }
        }

        const now = this.audioCtx.currentTime;
        const fadeTime = 0.02; // 20ms anti-pop exponential fade

        for (const key of this.stemKeys) {
            const item = this.stems[key];
            if (!item || !item.gain) continue;

            let targetGain = 1.0;
            if (anySolo) {
                targetGain = (item.solo && !item.mute) ? 1.0 : 0.0;
            } else {
                targetGain = item.mute ? 0.0 : 1.0;
            }

            item.gain.gain.setTargetAtTime(targetGain, now, fadeTime);
        }
    }

    getStemStates() {
        const states = {};
        for (const key of this.stemKeys) {
            if (this.stems[key]) {
                states[key] = {
                    solo: !!this.stems[key].solo,
                    mute: !!this.stems[key].mute
                };
            }
        }
        return states;
    }

    getCurrentTime() {
        for (const key of this.stemKeys) {
            if (this.stems[key] && this.stems[key].el) {
                return this.stems[key].el.currentTime;
            }
        }
        return 0;
    }

    startProgressTracking() {
        this.stopProgressTracking();
        const update = () => {
            if (!this.isPlaying) return;

            const t = this.getCurrentTime();
            if (this.onProgressCallback) {
                this.onProgressCallback({
                    currentTime: t,
                    duration: this.duration,
                    percent: this.duration > 0 ? (t / this.duration) * 100 : 0
                });
            }

            // Check if ended
            if (this.duration > 0 && t >= this.duration - 0.08) {
                this.pause();
                this.seek(0);
                return;
            }

            this.animFrameId = requestAnimationFrame(update);
        };
        this.animFrameId = requestAnimationFrame(update);
    }

    stopProgressTracking() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    destroyStems() {
        this.stopProgressTracking();
        for (const key of this.stemKeys) {
            const item = this.stems[key];
            if (item) {
                if (item.el) {
                    item.el.pause();
                    item.el.src = '';
                }
                if (item.gain) {
                    try { item.gain.disconnect(); } catch (e) {}
                }
                if (item.source) {
                    try { item.source.disconnect(); } catch (e) {}
                }
            }
        }
        this.stems = {};
        this.isPlaying = false;
        this.duration = 0;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StemPlayer;
}
