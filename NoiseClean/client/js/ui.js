/**
 * AudioPro Tool - UI View Renderer (Studio Pro Interface)
 * Controls Voice Clean toggles, 4-Stem AI Splitter matrix, progress indicators, and preview states.
 */

const AUDIO_TIPS = [
    { tag: "PRO TIP", text: "Cutting 200–500Hz room resonance adds natural studio warmth." },
    { tag: "AUDIO FACT", text: "Human hearing is most sensitive to 2–5 kHz, the consonant zone." },
    { tag: "HARMONICS", text: "Reconstructing high-order harmonics lost in compact microphone capsules." },
    { tag: "ACOUSTICS", text: "Eliminating flutter echoes and room reflections around vocal formants." },
    { tag: "BROADCAST", text: "Synthesizing 48 kHz high-frequency air for crystal-clear dialogue." },
    { tag: "PRO MIXING", text: "Dialogue cuts best through music when true peak is capped at -3 dBTP." },
    { tag: "NEURAL AI", text: "Multi-band neural models separate speech from ambient background noise." },
    { tag: "SOUND FACT", text: "Sound travels 4× faster through water than through studio air." },
    { tag: "CLARITY", text: "Enhancing consonant crispness (T, K, S) ensures effortless speech intelligibility." },
    { tag: "MASTERING", text: "Zero red-line clipping: Built-in safety ceiling protects your AE timeline." },
    { tag: "PRO TIP", text: "High-pass filtering below 70 Hz cleans up table bumps and handling rumble." },
    { tag: "ACOUSTICS", text: "Soft furnishings and heavy curtains eliminate up to 70% of room slapback." }
];

class UIRenderer {
    constructor(stateManager) {
        this.sm = stateManager;
        this.elements = {};
        this.debugLogs = [];
        this.tipInterval = null;
        this.currentTipIndex = 0;

        this.initDomReferences();
        this.bindEvents();

        this.sm.subscribe((snapshot) => this.render(snapshot));
    }

    initDomReferences() {
        // Mode Tabs
        this.elements.tabVoiceBtn = document.getElementById('tab-voice-btn');
        this.elements.tabStemsBtn = document.getElementById('tab-stems-btn');
        this.elements.voiceView = document.getElementById('voice-view');
        this.elements.stemsView = document.getElementById('stems-view');

        // Voice Clean Elements
        this.elements.noiseToggle = document.getElementById('noise-toggle');
        this.elements.toggleSub = document.getElementById('toggle-sub');
        this.elements.resembleToggle = document.getElementById('resemble-toggle');
        this.elements.resembleSub = document.getElementById('resemble-sub');

        this.elements.progressContainer = document.getElementById('progress-container');
        this.elements.progressBarFill = document.getElementById('progress-bar-fill');
        this.elements.progressMessage = document.getElementById('progress-message');
        this.elements.progressPercent = document.getElementById('progress-percent');
        this.elements.progressTipTag = document.getElementById('progress-tip-tag');
        this.elements.progressTipText = document.getElementById('progress-tip-text');

        // Stem Splitter Elements
        this.elements.stemClipLabel = document.getElementById('stem-clip-label');
        this.elements.stemClipTime = document.getElementById('stem-clip-time');
        this.elements.splitStemsBtn = document.getElementById('split-stems-btn');
        this.elements.splitBtnText = document.getElementById('split-btn-text');

        this.elements.stemProgressContainer = document.getElementById('stem-progress-container');
        this.elements.stemProgressBarFill = document.getElementById('stem-progress-bar-fill');
        this.elements.stemProgressMessage = document.getElementById('stem-progress-message');
        this.elements.stemProgressPercent = document.getElementById('stem-progress-percent');
        this.elements.stemProgressTip = document.getElementById('stem-progress-tip');

        this.elements.stemPlayerSection = document.getElementById('stem-player-section');
        this.elements.stemMasterPlayBtn = document.getElementById('stem-master-play-btn');
        this.elements.playIcon = document.getElementById('play-icon');
        this.elements.pauseIcon = document.getElementById('pause-icon');
        this.elements.stemScrubberTrack = document.getElementById('stem-scrubber-track');
        this.elements.stemScrubberFill = document.getElementById('stem-scrubber-fill');
        this.elements.stemCurrentTime = document.getElementById('stem-current-time');
        this.elements.stemTotalTime = document.getElementById('stem-total-time');
        this.elements.addAllStemsBtn = document.getElementById('add-all-stems-btn');

        // Shared Error Notice
        this.elements.errorNotice = document.getElementById('error-notice');
        this.elements.errorText = document.getElementById('error-text');
    }

    startTipRotation() {
        if (this.tipInterval) return;
        this.currentTipIndex = Math.floor(Math.random() * AUDIO_TIPS.length);
        this.updateTipDisplay(AUDIO_TIPS[this.currentTipIndex]);

        this.tipInterval = setInterval(() => {
            this.currentTipIndex = (this.currentTipIndex + 1) % AUDIO_TIPS.length;
            const nextTip = AUDIO_TIPS[this.currentTipIndex];
            
            if (this.elements.progressTipText) {
                this.elements.progressTipText.classList.add('fade-out');
                setTimeout(() => {
                    this.updateTipDisplay(nextTip);
                    if (this.elements.progressTipText) {
                        this.elements.progressTipText.classList.remove('fade-out');
                    }
                }, 260);
            } else {
                this.updateTipDisplay(nextTip);
            }
        }, 3600);
    }

    stopTipRotation() {
        if (this.tipInterval) {
            clearInterval(this.tipInterval);
            this.tipInterval = null;
        }
    }

    updateTipDisplay(tip) {
        if (!tip) return;
        if (this.elements.progressTipTag) {
            this.elements.progressTipTag.textContent = tip.tag;
        }
        if (this.elements.progressTipText) {
            this.elements.progressTipText.textContent = tip.text;
        }
    }

    sanitizeProgressMessage(msg) {
        if (!msg) return 'Restoring studio dialogue clarity...';
        const lower = msg.toLowerCase();
        if (lower.includes('chunk') || lower.includes('nfe=') || lower.includes('lambd=') || lower.includes('tau=')) {
            if (lower.includes('restor') || lower.includes('resemble') || lower.includes('clarity') || lower.includes('harmoni')) {
                return 'Restoring vocal harmonics & studio clarity...';
            }
            return 'Isolating dialogue & removing background noise...';
        }
        msg = msg.replace(/\s*\([^)]*(nfe|lambd|chunk|param|mode)[^)]*\)/gi, '');
        msg = msg.trim();
        return msg || 'Enhancing audio dialogue...';
    }

    bindEvents() {
        // Tab switching
        if (this.elements.tabVoiceBtn && this.elements.tabStemsBtn) {
            this.elements.tabVoiceBtn.addEventListener('click', () => {
                this.sm.setActiveTab('voice');
            });
            this.elements.tabStemsBtn.addEventListener('click', () => {
                this.sm.setActiveTab('stems');
            });
        }

        // Voice Restoration toggle update
        if (this.elements.resembleToggle) {
            this.elements.resembleToggle.addEventListener('change', (e) => {
                this.sm.setResembleEnhance(e.target.checked);
            });
        }
    }

    formatTime(sec) {
        if (!sec || isNaN(sec)) return '00:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }

    logDebug(msg) {
        const timestamp = new Date().toISOString().substring(11, 19);
        const line = `[AudioPro][${timestamp}] ${msg}`;
        this.debugLogs.push(line);
        console.log(line);
    }

    formatUserErrorMessage(rawError) {
        if (!rawError) return 'An unexpected error occurred. Please try again.';
        const errStr = typeof rawError === 'string' ? rawError : (rawError.message || String(rawError));
        const lower = errStr.toLowerCase();

        if (errStr.includes('ENOSPC') || lower.includes('no space left on device') || lower.includes('insufficient disk space')) {
            return 'Your hard drive is low on storage space. Please free up space on your primary drive (C:) to continue.';
        }
        if (errStr.includes('EBUSY') || errStr.includes('EPERM')) {
            return 'The media file is temporarily in use by another process. Please try again in a moment.';
        }

        let cleaned = errStr;
        cleaned = cleaned.replace(/[a-zA-Z]:\\[^\s'"]+/g, 'media file');
        cleaned = cleaned.replace(/\/Users\/[^\s'"]+/g, 'media file');
        cleaned = cleaned.replace(/\b(copyfile|unlink|readdir|mkdir)\b/gi, '');
        cleaned = cleaned.replace(/['"]+/g, '');
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        return cleaned || 'Audio processing failed. Please check your clip and try again.';
    }

    render(snapshot) {
        const { state, sourceInfo, isNoiseCleanActive, progress, lastError, activeTab, stemsState } = snapshot;

        // 1. Render Tab Switching
        const isVoiceTab = (activeTab === 'voice');
        if (this.elements.tabVoiceBtn && this.elements.tabStemsBtn) {
            this.elements.tabVoiceBtn.classList.toggle('active', isVoiceTab);
            this.elements.tabStemsBtn.classList.toggle('active', !isVoiceTab);
        }
        if (this.elements.voiceView && this.elements.stemsView) {
            this.elements.voiceView.style.display = isVoiceTab ? 'block' : 'none';
            this.elements.stemsView.style.display = isVoiceTab ? 'none' : 'block';
        }

        // 2. Render Voice Clean View
        if (this.elements.noiseToggle) {
            if (state === 'NO_SELECTION') {
                this.elements.noiseToggle.disabled = true;
                this.elements.noiseToggle.checked = false;
                if (this.elements.toggleSub) {
                    this.elements.toggleSub.textContent = 'Select a clip in timeline to isolate voice';
                }
            } else if (state === 'PROCESSING') {
                this.elements.noiseToggle.disabled = true;
                this.elements.noiseToggle.checked = true;
                if (this.elements.toggleSub) {
                    this.elements.toggleSub.textContent = 'Isolating voice dialogue...';
                }
            } else {
                this.elements.noiseToggle.disabled = false;
                this.elements.noiseToggle.checked = isNoiseCleanActive;
                if (this.elements.toggleSub) {
                    const clipName = (sourceInfo && sourceInfo.layerName) ? ` • ${sourceInfo.layerName}` : '';
                    this.elements.toggleSub.textContent = isNoiseCleanActive
                        ? `Active • Studio voice isolation${clipName}`
                        : `Studio background noise & echo removal${clipName}`;
                }
            }
        }

        if (this.elements.resembleToggle) {
            this.elements.resembleToggle.checked = !!snapshot.resembleEnhance;
            this.elements.resembleToggle.disabled = (state === 'PROCESSING');
        }

        if (this.elements.resembleSub) {
            if (snapshot.resembleEnhance) {
                this.elements.resembleSub.textContent = 'Active • Broadcast clarity active';
            } else {
                this.elements.resembleSub.textContent = 'Broadcast clarity & harmonic reconstruction';
            }
        }

        if (this.elements.progressContainer) {
            if (state === 'PROCESSING' && isVoiceTab) {
                this.elements.progressContainer.style.display = 'flex';
                this.startTipRotation();
                if (this.elements.progressBarFill) this.elements.progressBarFill.style.width = `${progress.percent}%`;
                if (this.elements.progressPercent) this.elements.progressPercent.textContent = `${progress.percent}%`;
                if (this.elements.progressMessage) {
                    this.elements.progressMessage.textContent = this.sanitizeProgressMessage(progress.message);
                }
            } else {
                this.stopTipRotation();
                this.elements.progressContainer.style.display = 'none';
            }
        }

        // 3. Render 3-Stem AI Splitter View
        const hasSelection = (sourceInfo && sourceInfo.hasSelection);

        if (this.elements.stemClipLabel) {
            if (hasSelection) {
                this.elements.stemClipLabel.textContent = sourceInfo.layerName || 'Active Clip';
            } else {
                this.elements.stemClipLabel.textContent = 'Select audio/video clip in timeline';
            }
        }

        if (this.elements.stemClipTime) {
            if (hasSelection && sourceInfo.durationSec) {
                this.elements.stemClipTime.textContent = this.formatTime(sourceInfo.durationSec);
            } else {
                this.elements.stemClipTime.textContent = '';
            }
        }

        // Split button state
        const isSplitting = (stemsState && stemsState.status === 'splitting');
        const stemsReady = (stemsState && stemsState.status === 'ready');

        if (this.elements.splitStemsBtn) {
            this.elements.splitStemsBtn.disabled = !hasSelection || isSplitting;
            if (this.elements.splitBtnText) {
                if (isSplitting) {
                    this.elements.splitBtnText.textContent = 'Deconstructing 3 Stems...';
                } else if (stemsReady) {
                    this.elements.splitBtnText.textContent = 'Re-separate 3 Stems';
                } else {
                    this.elements.splitBtnText.textContent = 'Separate into 3 Stems';
                }
            }
        }

        // Stem Splitting Progress Indicator
        if (this.elements.stemProgressContainer) {
            if (isSplitting) {
                this.elements.stemProgressContainer.style.display = 'flex';
                if (this.elements.stemProgressBarFill) {
                    this.elements.stemProgressBarFill.style.width = `${stemsState.percent}%`;
                }
                if (this.elements.stemProgressPercent) {
                    this.elements.stemProgressPercent.textContent = `${stemsState.percent}%`;
                }
                if (this.elements.stemProgressMessage) {
                    this.elements.stemProgressMessage.textContent = stemsState.message || 'Separating 3 audio stems...';
                }
            } else {
                this.elements.stemProgressContainer.style.display = 'none';
            }
        }

        // Stem Player & Matrix Section
        if (this.elements.stemPlayerSection) {
            this.elements.stemPlayerSection.style.display = (stemsReady && !isSplitting) ? 'flex' : 'none';
        }

        if (stemsReady) {
            // Master Play / Pause icon
            if (this.elements.playIcon && this.elements.pauseIcon) {
                this.elements.playIcon.style.display = stemsState.isPlaying ? 'none' : 'block';
                this.elements.pauseIcon.style.display = stemsState.isPlaying ? 'block' : 'none';
            }

            // Scrubber
            const curTime = stemsState.currentTime || 0;
            const dur = stemsState.duration || 1;
            const pct = Math.max(0, Math.min(100, (curTime / dur) * 100));

            if (this.elements.stemScrubberFill) {
                this.elements.stemScrubberFill.style.width = `${pct}%`;
            }
            if (this.elements.stemCurrentTime) {
                this.elements.stemCurrentTime.textContent = this.formatTime(curTime);
            }
            if (this.elements.stemTotalTime) {
                this.elements.stemTotalTime.textContent = this.formatTime(dur);
            }

            // Update per-stem Solo / Mute button highlights and VU meter animation
            const stemKeys = ['voice', 'music', 'noise'];
            const curStates = stemsState.stemStates || {};

            // Check if any solo is active
            let anySolo = false;
            for (const k of stemKeys) {
                if (curStates[k] && curStates[k].solo) anySolo = true;
            }

            for (const k of stemKeys) {
                const sObj = curStates[k] || { solo: false, mute: false };
                const card = document.querySelector(`.stem-card[data-stem="${k}"]`);
                const soloBtn = document.querySelector(`.btn-stem-solo[data-stem="${k}"]`);
                const muteBtn = document.querySelector(`.btn-stem-mute[data-stem="${k}"]`);

                if (soloBtn) soloBtn.classList.toggle('active', !!sObj.solo);
                if (muteBtn) muteBtn.classList.toggle('active', !!sObj.mute);

                // Is stem audible right now?
                let isAudible = false;
                if (stemsState.isPlaying) {
                    if (anySolo) {
                        isAudible = sObj.solo && !sObj.mute;
                    } else {
                        isAudible = !sObj.mute;
                    }
                }
                if (card) {
                    card.classList.toggle('playing', isAudible);
                }
            }
        }

        // 4. Render Error Notice
        if (this.elements.errorNotice) {
            if ((state === 'ERROR' || (stemsState && stemsState.status === 'error')) && lastError) {
                this.elements.errorNotice.style.display = 'flex';
                if (this.elements.errorText) {
                    this.elements.errorText.textContent = this.formatUserErrorMessage(lastError);
                }
            } else {
                this.elements.errorNotice.style.display = 'none';
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIRenderer;
}
