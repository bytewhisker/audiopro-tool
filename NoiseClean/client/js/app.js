/**
 * NoiseClean - Application Controller (CapCut Style 1-Click Interface)
 * Orchestrates direct audio extraction, DeepFilterNet processing, and in-place timeline updates.
 */

(function () {
    "use strict";

    // Obtain Node.js backend in mixed-context CEP or standalone mode
    let NoiseCleanNode = null;
    let extensionPath = '';

    try {
        if (typeof require !== 'undefined') {
            const path = require('path');
            if (typeof CSInterface !== 'undefined') {
                const csInterface = new CSInterface();
                extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);
            } else {
                extensionPath = path.resolve(__dirname, '..');
            }
            const mainJsPath = path.join(extensionPath, 'node', 'main.js');
            NoiseCleanNode = require(mainJsPath);
            console.log('[NoiseClean App] Node context loaded successfully from:', mainJsPath);
        } else {
            console.warn('[NoiseClean App] require is undefined. Node.js might not be enabled in manifest.');
        }
    } catch (e) {
        console.error('[NoiseClean App] Could not load Node context:', e);
    }

    const stateManager = new StateManager();
    const aeBridge = new AEBridge();
    let ui = null;
    let stemPlayer = null;

    // Track original audio paths for reverting in-place: layerKey -> originalFilePath
    const originalPathsMap = new Map();
    // Cache cleaned audio results for instant toggle restore: cacheKey -> { cleanedWavPath, reductionDb, sourcePath }
    const cleanedCache = new Map();
    // Track last applied file per layer for safe temp cleanup once AE switches: layerKey -> filePath
    const lastAppliedFilesMap = new Map();

    function init() {
        if (typeof CSInterface !== 'undefined') {
            try {
                const cs = new CSInterface();
                cs.setWindowTitle("AudioPro Tool");
            } catch (err) {
                console.warn('[AudioPro App] setWindowTitle failed:', err);
            }
        }
        document.title = "AudioPro Tool";

        ui = new UIRenderer(stateManager);

        // Initialize 4-Stem Web Audio Preview Player
        if (typeof StemPlayer !== 'undefined') {
            stemPlayer = new StemPlayer();
            stemPlayer.onProgressCallback = ({ currentTime, duration, percent }) => {
                stateManager.setStemPlayback(stemPlayer.isPlaying, currentTime, duration);
            };
            stemPlayer.onStateChangeCallback = ({ isPlaying, duration }) => {
                stateManager.setStemPlayback(isPlaying, stemPlayer.getCurrentTime(), duration);
            };
        }

        const noiseToggle = document.getElementById('noise-toggle');
        const refreshBtn = document.getElementById('refresh-btn');
        const strengthSlider = document.getElementById('strength-slider');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', refreshSelection);
        }

        if (noiseToggle) {
            noiseToggle.addEventListener('change', handleToggleChange);
        }

        let sliderDebounceTimer = null;
        function handleStrengthChange() {
            const snap = stateManager.getStateSnapshot();
            if (snap.sourceInfo && snap.sourceInfo.hasSelection && snap.isNoiseCleanActive && snap.state !== 'PROCESSING') {
                ui.logDebug(`Strength adjusted to ${snap.reductionDb} dB. Updating audio in After Effects...`);
                applyNoiseCleanAction();
            }
        }

        if (strengthSlider) {
            strengthSlider.addEventListener('input', () => {
                if (sliderDebounceTimer) clearTimeout(sliderDebounceTimer);
                sliderDebounceTimer = setTimeout(handleStrengthChange, 900);
            });
            strengthSlider.addEventListener('change', () => {
                if (sliderDebounceTimer) clearTimeout(sliderDebounceTimer);
                handleStrengthChange();
            });
        }

        const resembleToggle = document.getElementById('resemble-toggle');
        if (resembleToggle) {
            resembleToggle.addEventListener('change', () => {
                const snap = stateManager.getStateSnapshot();
                if (snap.sourceInfo && snap.sourceInfo.hasSelection && snap.isNoiseCleanActive && snap.state !== 'PROCESSING') {
                    ui.logDebug(`Voice Restoration toggled: ${snap.resembleEnhance ? 'ON' : 'OFF'}. Updating audio in After Effects...`);
                    applyNoiseCleanAction();
                }
            });
        }

        // 4-Stem Splitter Event Listeners
        const splitBtn = document.getElementById('split-stems-btn');
        if (splitBtn) {
            splitBtn.addEventListener('click', handleSplitStemsAction);
        }

        const stemMasterPlayBtn = document.getElementById('stem-master-play-btn');
        if (stemMasterPlayBtn) {
            stemMasterPlayBtn.addEventListener('click', () => {
                if (stemPlayer) stemPlayer.togglePlay();
            });
        }

        const scrubberTrack = document.getElementById('stem-scrubber-track');
        if (scrubberTrack) {
            let isScrubbing = false;
            const handleScrub = (e) => {
                const rect = scrubberTrack.getBoundingClientRect();
                const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                if (stemPlayer) stemPlayer.seekPercent(pct);
            };
            scrubberTrack.addEventListener('mousedown', (e) => {
                isScrubbing = true;
                handleScrub(e);
            });
            window.addEventListener('mousemove', (e) => {
                if (isScrubbing) handleScrub(e);
            });
            window.addEventListener('mouseup', () => {
                isScrubbing = false;
            });
        }

        document.querySelectorAll('.btn-stem-solo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const stemKey = e.currentTarget.getAttribute('data-stem');
                if (stemKey && stemPlayer) {
                    const newStates = stemPlayer.toggleSolo(stemKey);
                    stateManager.setStemSoloMute(newStates);
                }
            });
        });

        document.querySelectorAll('.btn-stem-mute').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const stemKey = e.currentTarget.getAttribute('data-stem');
                if (stemKey && stemPlayer) {
                    const newStates = stemPlayer.toggleMute(stemKey);
                    stateManager.setStemSoloMute(newStates);
                }
            });
        });

        document.querySelectorAll('.btn-stem-add').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const stemKey = e.currentTarget.getAttribute('data-stem');
                const capitalized = stemKey ? stemKey.charAt(0).toUpperCase() + stemKey.slice(1) : 'Stem';
                handleAddSingleStem(capitalized);
            });
        });

        const addAllBtn = document.getElementById('add-all-stems-btn');
        if (addAllBtn) {
            addAllBtn.addEventListener('click', handleAddAllStems);
        }

        // High-performance, non-intrusive selection sync
        // Only queries After Effects when user interacts with or focuses the panel.
        // Never interrupts AE playback, timeline scrubbing, or rendering!
        let isMouseOverPanel = false;
        document.addEventListener('mouseenter', () => {
            isMouseOverPanel = true;
            refreshSelection(true);
        });
        document.addEventListener('mouseleave', () => {
            isMouseOverPanel = false;
        });
        window.addEventListener('focus', () => {
            refreshSelection(true);
        });

        // Lazy background interval only when panel is active/hovered
        setInterval(() => {
            if (document.hasFocus() || isMouseOverPanel) {
                refreshSelection(false);
            }
        }, 5000);

        // Initial fetch
        refreshSelection(true);

        ui.logDebug('AudioPro Tool panel initialized (Studio Pro mode).');
        if (NoiseCleanNode) {
            const sys = NoiseCleanNode.getSystemInfo();
            ui.logDebug(`System: ${sys.platform.platform} (${sys.platform.arch}), AudioPro AI Engine Ready.`);

            if (NoiseCleanNode.checkResembleAvailability) {
                NoiseCleanNode.checkResembleAvailability().then((status) => {
                    stateManager.setResembleStatus(status);
                    if (status && status.ready) {
                        ui.logDebug('AudioPro Voice Restoration engine verified.');
                    } else {
                        ui.logDebug('AudioPro Voice Restoration engine: Standby');
                    }
                }).catch((err) => {
                    stateManager.setResembleStatus({ ready: false, error: err.message });
                });
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    let isRefreshing = false;
    let lastRefreshTime = 0;
    async function refreshSelection(force = false) {
        const now = Date.now();
        if (!force && (now - lastRefreshTime < 2000)) return;
        if (isRefreshing) return;

        const snap = stateManager.getStateSnapshot();
        if (snap.state === 'PROCESSING') return;

        isRefreshing = true;
        lastRefreshTime = now;
        try {
            const sel = await aeBridge.getSelectedAudioLayer();
            stateManager.setSource(sel);
        } catch (err) {
            // Silently maintain idle state
        } finally {
            isRefreshing = false;
        }
    }

    async function handleToggleChange(e) {
        const shouldEnable = e.target.checked;
        const snap = stateManager.getStateSnapshot();
        if (!snap.sourceInfo || !snap.sourceInfo.hasSelection) return;

        if (shouldEnable) {
            await applyNoiseCleanAction();
        } else {
            await revertNoiseCleanAction();
        }
    }

    async function applyNoiseCleanAction() {
        const snap = stateManager.getStateSnapshot();
        const source = snap.sourceInfo;
        const layerKey = `${source.compId}_${source.layerIndex}`;
        const trueOrigKey = originalPathsMap.get(layerKey) || (source.sourcePath && !source.sourcePath.includes('_Cleaned') && !source.sourcePath.includes('NoiseClean') ? source.sourcePath : null);
        const baseKey = trueOrigKey || layerKey;
        const engineTag = snap.resembleEnhance ? 'resemble' : 'df';
        const dbCacheKey = `${baseKey}_${snap.reductionDb}dB_${engineTag}`;

        // Check if we have a temporary cached cleaned file for this clip at this exact strength and profile
        const fs = (NoiseCleanNode && NoiseCleanNode.fs) || (typeof require !== 'undefined' ? require('fs') : null);
        const cached = cleanedCache.get(dbCacheKey) || cleanedCache.get(`${layerKey}_${snap.reductionDb}dB_${engineTag}`);
        const cachedTarget = cached ? (cached.cleanedPath || cached.cleanedWavPath) : null;

        if (cached && cachedTarget && fs && fs.existsSync(cachedTarget)) {
            try {
                const label = snap.resembleEnhance ? 'Voice Restoration' : 'NoiseClean AI';
                ui.logDebug(`Restoring cached ${label} media for: ${source.layerName} (Instant)`);
                stateManager.startProcessing(`Applying ${snap.reductionDb} dB ${label} clean audio...`);
                stateManager.updateProgress(90, 'Restoring clean audio...');
                const applyRes = await aeBridge.applyNoiseClean(
                    source.compId,
                    source.layerIndex,
                    cachedTarget,
                    source.isVideo,
                    trueOrigKey || originalPathsMap.get(layerKey) || ""
                );

                if (!applyRes.success) {
                    throw new Error(applyRes.error || 'Failed to apply cached media.');
                }

                ui.logDebug(`Instant restore applied in-place (${snap.reductionDb} dB, ${engineTag}).`);
                stateManager.setCompleted(true);
                setTimeout(refreshSelection, 300);
                return;
            } catch (cacheErr) {
                ui.logDebug(`Cache restore failed, re-processing: ${cacheErr.message}`);
            }
        }

        try {
            const modeDesc = snap.resembleEnhance ? 'Voice Restoration' : 'Voice Isolation';
            stateManager.startProcessing(snap.resembleEnhance ? 'Restoring studio audio clarity...' : 'Isolating voice dialogue...');
            ui.logDebug(`Starting processing (${modeDesc}, ${snap.reductionDb} dB) for: ${source.layerName}`);

            // 1. Prepare layer source path
            const tempDir = (NoiseCleanNode && NoiseCleanNode.paths) ? NoiseCleanNode.paths.tempBaseDir : 'temp';
            const prep = await aeBridge.prepareLayerAudio(tempDir);

            if (!prep.success) {
                throw new Error(prep.error || 'Failed to locate layer audio.');
            }

            // CRITICAL: Determine and pin the TRUE uncleaned original source file
            let trueOriginalSource = originalPathsMap.get(layerKey);

            if (prep.originalPath && !prep.originalPath.includes('_Cleaned') && !prep.originalPath.includes('_StudioCleaned') && !prep.originalPath.includes('_RestoredCleaned') && !prep.originalPath.includes('NoiseClean')) {
                trueOriginalSource = prep.originalPath;
            } else if (prep.audioPath && !prep.audioPath.includes('_Cleaned') && !prep.audioPath.includes('_StudioCleaned') && !prep.audioPath.includes('_RestoredCleaned') && !prep.audioPath.includes('NoiseClean') && !prep.audioPath.includes('output.wav')) {
                trueOriginalSource = prep.audioPath;
            }

            // Intelligent disk recovery if After Effects had already replaced footage before restart
            if (!trueOriginalSource && prep.audioPath && (prep.audioPath.includes('NoiseClean') || prep.audioPath.includes('_Cleaned') || prep.audioPath.includes('_StudioCleaned') || prep.audioPath.includes('_RestoredCleaned'))) {
                try {
                    const nodeFs = require('fs');
                    const nodePath = require('path');
                    const base = nodePath.basename(prep.audioPath).replace(/(_StudioCleaned|_Cleaned|_RestoredCleaned|_ResembleCleaned|_ResembleStudioCleaned).*$/, '');
                    const home = require('os').homedir();
                    const searchFolders = [
                        nodePath.join(home, 'Downloads'),
                        nodePath.join(home, 'Videos'),
                        nodePath.join(home, 'Documents'),
                        nodePath.join(home, 'Desktop')
                    ];
                    
                    const extensions = ['.mp4', '.mov', '.wav', '.mp3', '.m4a', ''];
                    let found = null;
                    for (const folder of searchFolders) {
                        for (const ext of extensions) {
                            const cand = nodePath.join(folder, base + ext);
                            if (nodeFs.existsSync(cand)) {
                                found = cand;
                                break;
                            }
                        }
                        if (found) break;
                    }
                    if (found) {
                        trueOriginalSource = found;
                        ui.logDebug(`Recovered original media source: ${found}`);
                    }
                } catch (eRec) {}
            }

            if (trueOriginalSource) {
                originalPathsMap.set(layerKey, trueOriginalSource);
            }

            // workingSource MUST always be the uncleaned original to prevent compounding/double-processing!
            const workingSource = trueOriginalSource || prep.audioPath;
            let workingAudioPath = workingSource;

            // 2. Demux / extract 48 kHz uncompressed WAV from the pristine original source
            stateManager.updateProgress(20, 'Extracting 48 kHz audio track from original source...');
            if (NoiseCleanNode && NoiseCleanNode.demuxer && (prep.isVideo || prep.needsTranscode || !workingAudioPath.toLowerCase().endsWith('.wav'))) {
                const path = require('path');
                const safeClipName = (source.layerName || 'clip').replace(/[^a-zA-Z0-9_\-]/g, '_');
                const outWav = path.join(tempDir, `${safeClipName}_extracted_48k.wav`);
                ui.logDebug(`Demuxing audio with FFmpeg from original: ${workingSource}`);
                workingAudioPath = await NoiseCleanNode.demuxer.extractAudioToWav(workingSource, outWav);
                ui.logDebug(`Audio extracted successfully in milliseconds.`);
            }

            // 3. Process through AI Engine (Resemble AI GPU if enabled, else DeepFilterNet)
            let chosenEngine = 'deepfilternet';
            const isolationDb = snap.reductionDb || 80;
            let engineOptions = { attenuationDb: isolationDb, clipName: `${source.layerName}_${isolationDb}dB` };

            if (snap.resembleEnhance) {
                if (snap.resembleStatus && snap.resembleStatus.ready) {
                    chosenEngine = 'resemble';
                    engineOptions = {
                        mode: 'enhance',
                        device: 'cuda',
                        nfe: 32,
                        lambd: 0.5,
                        clipName: `${source.layerName}_Restored`
                    };
                    stateManager.updateProgress(40, `Restoring broadcast voice clarity...`);
                    ui.logDebug('Processing Voice Restoration...');
                } else {
                    ui.logDebug('Voice Restoration standby, isolating voice dialogue...');
                    stateManager.updateProgress(40, `Isolating voice dialogue...`);
                    ui.logDebug('Processing voice isolation...');
                }
            } else {
                stateManager.updateProgress(45, `Isolating voice dialogue...`);
                ui.logDebug('Processing voice isolation...');
            }

            const procResult = await NoiseCleanNode.processAudio(
                workingAudioPath,
                chosenEngine,
                engineOptions,
                (progress) => {
                    const msg = progress.message || (chosenEngine === 'resemble' ? 'Restoring vocal harmonics & studio clarity...' : 'Isolating voice dialogue...');
                    stateManager.updateProgress(progress.progress ? Math.min(80, Math.max(30, progress.progress)) : 65, msg);
                }
            );

            ui.logDebug(`Cleaned in ${procResult.elapsedMs}ms (RTF: ${procResult.rtf.toFixed(2)}x)`);

            const finalCleanAudioWav = procResult.outputWavPath;

            // Unique run identifier prevents Windows file-lock collisions with files open in After Effects
            const fileUid = Date.now().toString(36);
            let finalReplacementPath = finalCleanAudioWav;

            // 4. If video: losslessly stream-copy remux video from the ORIGINAL VIDEO + clean audio (no video re-encoding, ~200ms)
            if (prep.isVideo && NoiseCleanNode && NoiseCleanNode.demuxer) {
                stateManager.updateProgress(85, 'Losslessly remuxing audio into video...');
                const path = require('path');
                const origExt = path.extname(workingSource) || '.mp4';
                const safeClipName = (source.layerName || 'clip').replace(/[^a-zA-Z0-9_\-]/g, '_');
                const fileTag = (chosenEngine === 'resemble') ? '_RestoredCleaned' : '_Cleaned';

                // Save to persistent project media directory so After Effects NEVER loses media on project reopen!
                const targetMediaDir = (NoiseCleanNode && NoiseCleanNode.paths && NoiseCleanNode.paths.getCleanedMediaDir)
                    ? NoiseCleanNode.paths.getCleanedMediaDir(workingSource)
                    : tempDir;
                const remuxVideoPath = path.join(targetMediaDir, `${safeClipName}${fileTag}_${snap.reductionDb}dB_${fileUid}${origExt}`);

                ui.logDebug(`Remuxing video with FFmpeg stream-copy from original: ${workingSource}`);
                finalReplacementPath = await NoiseCleanNode.demuxer.remuxVideoWithAudio(
                    workingSource,
                    finalCleanAudioWav,
                    remuxVideoPath
                );
                ui.logDebug(`Video remuxed losslessly in milliseconds.`);
            }

            // 5. Update After Effects timeline in-place
            stateManager.updateProgress(95, 'Updating timeline in-place...');
            const applyRes = await aeBridge.applyNoiseClean(
                prep.compId,
                prep.layerIndex,
                finalReplacementPath,
                prep.isVideo,
                workingSource
            );

            if (!applyRes.success) {
                throw new Error(applyRes.error || 'Failed to update layer in After Effects.');
            }

            // Clean up previous temporary file for this layer once AE drops its lock
            const prevFile = lastAppliedFilesMap.get(layerKey);
            lastAppliedFilesMap.set(layerKey, finalReplacementPath);
            if (prevFile && prevFile !== finalReplacementPath) {
                try {
                    const nodeFs = require('fs');
                    if (nodeFs.existsSync(prevFile)) {
                        nodeFs.unlink(prevFile, () => {});
                    }
                } catch (eCleanOld) {}
            }

            // Immediately reclaim disk space: delete intermediate extracted 48k WAV once video is remuxed
            if (prep.isVideo && workingAudioPath && workingAudioPath !== workingSource && workingAudioPath.includes('extracted_48k')) {
                try {
                    const nodeFs = require('fs');
                    if (nodeFs.existsSync(workingAudioPath)) {
                        nodeFs.unlink(workingAudioPath, () => {});
                    }
                } catch (eCleanWav) {}
            }

            // Finalize job workspace
            if (procResult && procResult.jobId && NoiseCleanNode && NoiseCleanNode.finalizeJob) {
                NoiseCleanNode.finalizeJob(procResult.jobId);
            }

            // Cache cleaned result for instant re-enabling at this strength and profile
            const cacheEntry = {
                cleanedPath: finalReplacementPath,
                cleanedWavPath: finalCleanAudioWav,
                reductionDb: snap.reductionDb,
                resembleEnhance: snap.resembleEnhance,
                sourcePath: prep.audioPath,
                isVideo: prep.isVideo
            };
            cleanedCache.set(dbCacheKey, cacheEntry);
            cleanedCache.set(`${layerKey}_${snap.reductionDb}dB_${engineTag}`, cacheEntry);

            ui.logDebug(`Processing completed successfully in-place (${modeDesc}, ${snap.reductionDb} dB).`);
            stateManager.setCompleted(true);

            // Brief delay then refresh layer info
            setTimeout(refreshSelection, 400);

        } catch (err) {
            ui.logDebug(`Error: ${err.message}`);
            const safeMsg = (ui && ui.formatUserErrorMessage) ? ui.formatUserErrorMessage(err.message) : err.message;
            stateManager.setError(safeMsg);
            // Reset toggle state to false on failure
            const toggle = document.getElementById('noise-toggle');
            if (toggle) toggle.checked = false;
        }
    }

    async function revertNoiseCleanAction() {
        const snap = stateManager.getStateSnapshot();
        const source = snap.sourceInfo;
        const layerKey = `${source.compId}_${source.layerIndex}`;
        const originalPath = originalPathsMap.get(layerKey) || source.sourcePath;

        try {
            ui.logDebug(`Reverting noise reduction for layer: ${source.layerName}`);
            const res = await aeBridge.revertNoiseClean(
                source.compId,
                source.layerIndex,
                originalPath,
                source.isVideo
            );

            if (!res.success) {
                throw new Error(res.error || 'Failed to revert layer.');
            }

            ui.logDebug('Reverted to original audio successfully.');
            stateManager.setCompleted(false);

            // Clear cache for this layer so subsequent adjustments reprocess fresh
            for (const k of Array.from(cleanedCache.keys())) {
                if (k.startsWith(layerKey) || (originalPath && k.startsWith(originalPath))) {
                    cleanedCache.delete(k);
                }
            }

            setTimeout(refreshSelection, 400);
        } catch (err) {
            ui.logDebug(`Revert error: ${err.message}`);
            const safeMsg = (ui && ui.formatUserErrorMessage) ? ui.formatUserErrorMessage(err.message) : err.message;
            stateManager.setError(safeMsg);
            const toggle = document.getElementById('noise-toggle');
            if (toggle) toggle.checked = true;
        }
    }

    async function handleSplitStemsAction() {
        const snap = stateManager.getStateSnapshot();
        const source = snap.sourceInfo;
        if (!source || !source.hasSelection) return;

        try {
            stateManager.startStemSplitting('Analyzing source audio mix...');
            ui.logDebug(`Starting 4-Stem separation for: ${source.layerName}`);

            const tempDir = (NoiseCleanNode && NoiseCleanNode.paths) ? NoiseCleanNode.paths.tempBaseDir : 'temp';
            const prep = await aeBridge.prepareLayerAudio(tempDir);

            if (!prep.success) {
                throw new Error(prep.error || 'Failed to prepare audio track from layer.');
            }

            let workingSource = prep.originalPath || prep.audioPath || source.sourcePath;
            let workingAudioPath = workingSource;

            // Demux to 48kHz uncompressed WAV if needed
            if (NoiseCleanNode && NoiseCleanNode.demuxer && (prep.isVideo || prep.needsTranscode || !workingAudioPath.toLowerCase().endsWith('.wav'))) {
                stateManager.updateStemProgress(12, 'Extracting 48 kHz uncompressed WAV track with FFmpeg...');
                const path = require('path');
                const safeClipName = (source.layerName || 'clip').replace(/[^a-zA-Z0-9_\-]/g, '_');
                const outWav = path.join(tempDir, `${safeClipName}_extracted_stems_48k.wav`);
                ui.logDebug(`Demuxing audio with FFmpeg from: ${workingSource}`);
                workingAudioPath = await NoiseCleanNode.demuxer.extractAudioToWav(workingSource, outWav);
            }

            // Run 4-Stem separation
            stateManager.updateStemProgress(20, 'Neural AI isolating vocal & dialogue stem...');
            const stemResults = await NoiseCleanNode.splitAudioStems(
                workingAudioPath,
                workingSource,
                source.layerName || 'clip',
                (prog) => {
                    stateManager.updateStemProgress(prog.percent, prog.message);
                }
            );

            ui.logDebug('4 Stems separated successfully!');

            // Load into StemPlayer for synchronized multi-track preview
            stateManager.updateStemProgress(95, 'Loading stems into preview player...');
            if (stemPlayer) {
                await stemPlayer.loadStems(stemResults);
            }

            stateManager.setStemsReady(stemResults);
            ui.logDebug('Stems ready in player. You can preview, solo/mute, or add directly to AE timeline!');

        } catch (err) {
            ui.logDebug(`Stem Split Error: ${err.message}`);
            const safeMsg = (ui && ui.formatUserErrorMessage) ? ui.formatUserErrorMessage(err.message) : err.message;
            stateManager.setStemError(safeMsg);
        }
    }

    async function handleAddSingleStem(stemType) {
        const snap = stateManager.getStateSnapshot();
        const source = snap.sourceInfo;
        const stems = snap.stemsState.stems;
        const key = stemType.toLowerCase();
        if (!source || !stems || !stems[key]) {
            ui.logDebug(`Cannot add ${stemType} stem: file not ready.`);
            return;
        }

        const stemPath = stems[key];
        try {
            ui.logDebug(`Adding ${stemType} stem into After Effects composition...`);
            const res = await aeBridge.importStemLayer(stemPath, stemType, source.layerIndex, source.compId);
            if (!res.success) {
                throw new Error(res.error || `Failed to add ${stemType} stem.`);
            }
            ui.logDebug(`Added ${stemType} stem to timeline (Layer ${res.layerIndex}: ${res.layerName}). Original audio muted.`);
            setTimeout(() => refreshSelection(true), 350);
        } catch (err) {
            ui.logDebug(`Add Stem Error: ${err.message}`);
            stateManager.setError(err.message);
        }
    }

    async function handleAddAllStems() {
        const snap = stateManager.getStateSnapshot();
        const source = snap.sourceInfo;
        const stems = snap.stemsState.stems;
        if (!source || !stems) {
            ui.logDebug('Cannot add stems: please separate stems first.');
            return;
        }

        try {
            ui.logDebug('Adding all 4 stems into After Effects timeline in microsecond sync...');
            const res = await aeBridge.importAllStems(stems, source.layerIndex, source.compId);
            if (!res.success) {
                throw new Error(res.error || 'Failed to add stems to composition.');
            }
            ui.logDebug(`Successfully injected ${res.count} stems into timeline! Original audio muted.`);
            setTimeout(() => refreshSelection(true), 350);
        } catch (err) {
            ui.logDebug(`Add All Stems Error: ${err.message}`);
            stateManager.setError(err.message);
        }
    }
})();
