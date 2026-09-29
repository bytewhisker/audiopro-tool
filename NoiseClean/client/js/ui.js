/**
 * AudioPro Tool - UI View Renderer (Studio Pro Interface)
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
        // Eliminate chunk details and nerdy parameter arguments
        if (lower.includes('chunk') || lower.includes('nfe=') || lower.includes('lambd=') || lower.includes('tau=')) {
            if (lower.includes('restor') || lower.includes('resemble') || lower.includes('clarity') || lower.includes('harmoni')) {
                return 'Restoring vocal harmonics & studio clarity...';
            }
            return 'Isolating dialogue & removing background noise...';
        }
        // Remove any residual parentheses with parameters like (enhance, nfe=32, ...)
        msg = msg.replace(/\s*\([^)]*(nfe|lambd|chunk|param|mode)[^)]*\)/gi, '');
        msg = msg.trim();
        return msg || 'Enhancing audio dialogue...';
    }

    bindEvents() {
        // Voice Restoration toggle update
        if (this.elements.resembleToggle) {
            this.elements.resembleToggle.addEventListener('change', (e) => {
                this.sm.setResembleEnhance(e.target.checked);
            });
        }
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

        // 1. Disk Space (ENOSPC)
        if (errStr.includes('ENOSPC') || lower.includes('no space left on device') || lower.includes('insufficient disk space')) {
            return 'Your hard drive is low on storage space. Please free up space on your primary drive (C:) to continue.';
        }

        // 2. File Lock / In-use
        if (errStr.includes('EBUSY') || errStr.includes('EPERM')) {
            return 'The media file is temporarily in use by another process. Please try again in a moment.';
        }

        // 3. Strip internal file system paths (C:\Users\..., /Users/..., AppData, Temp, etc.)
        let cleaned = errStr;
        cleaned = cleaned.replace(/[a-zA-Z]:\\[^\s'"]+/g, 'media file');
        cleaned = cleaned.replace(/\/Users\/[^\s'"]+/g, 'media file');
        cleaned = cleaned.replace(/\b(copyfile|unlink|readdir|mkdir)\b/gi, '');
        cleaned = cleaned.replace(/['"]+/g, '');
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        return cleaned || 'Audio processing failed. Please check your clip and try again.';
    }

    render(snapshot) {
        const { state, sourceInfo, isNoiseCleanActive, progress, lastError } = snapshot;

        // 1. Render Voice Isolation Toggle
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

        // 3. Render Voice Restoration Toggle (No GPU/NVIDIA text)
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

        // 4. Render Progress Container
        if (this.elements.progressContainer) {
            if (state === 'PROCESSING') {
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

        // 5. Render Error Notice
        if (this.elements.errorNotice) {
            if (state === 'ERROR' && lastError) {
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
