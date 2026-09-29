/**
 * NoiseClean - ExtendScript Host Bridge
 * Provides asynchronous, promise-based communication with After Effects.
 */

class AEBridge {
    constructor() {
        this.csInterface = null;
        this.isAvailable = false;
        this.init();
    }

    init() {
        if (typeof CSInterface !== 'undefined') {
            try {
                this.csInterface = new CSInterface();
                this.isAvailable = true;
            } catch (e) {
                console.warn('[AEBridge] CSInterface present but initialization failed:', e);
            }
        }
        if (!this.isAvailable) {
            console.log('[AEBridge] Running outside Adobe host application (Dev / Standalone mode).');
        }
    }

    evalScriptAsync(script) {
        return new Promise((resolve, reject) => {
            if (!this.isAvailable) {
                return reject(new Error('CSInterface is not available (not running inside After Effects).'));
            }
            this.csInterface.evalScript(script, (result) => {
                if (result === 'EvalScript error.' || result === undefined) {
                    reject(new Error(`ExtendScript evaluation failed for: ${script}`));
                } else {
                    resolve(result);
                }
            });
        });
    }

    async getSelectedAudioLayer() {
        if (!this.isAvailable) {
            // Mock response for development outside After Effects
            return {
                success: true,
                hasSelection: true,
                layerIndex: 1,
                layerName: 'Voice_Recording_01.wav',
                sourceKind: 'Audio File',
                isDirect: true,
                sourcePath: 'test_noisy_48k_mono.wav',
                audioEnabled: true,
                durationSec: 5.0,
                compId: 1,
                compName: 'Main_Comp'
            };
        }
        const raw = await this.evalScriptAsync('NoiseCleanHost.getSelectedAudioLayer()');
        try {
            return JSON.parse(raw);
        } catch (e) {
            throw new Error(`Failed to parse layer selection response: ${raw}`);
        }
    }

    async prepareLayerAudio(tempDir) {
        if (!this.isAvailable) {
            return {
                success: true,
                directAccess: true,
                audioPath: 'test_noisy_48k_mono.wav',
                layerName: 'Voice_Recording_01.wav',
                layerIndex: 1,
                compId: 1,
                compName: 'Main_Comp',
                duration: 5.0
            };
        }
        const safeDir = JSON.stringify(tempDir);
        const raw = await this.evalScriptAsync(`NoiseCleanHost.prepareLayerAudio(${safeDir})`);
        try {
            return JSON.parse(raw);
        } catch (e) {
            throw new Error(`Failed to parse audio export response: ${raw}`);
        }
    }

    async importCleanedAudio(cleanedPath, originalLayerName, compId, layerIndex) {
        if (!this.isAvailable) {
            return {
                success: true,
                footageId: 101,
                footageName: `${originalLayerName}_Denoised.wav`,
                filePath: cleanedPath,
                duration: 5.0
            };
        }
        const sPath = JSON.stringify(cleanedPath);
        const sName = JSON.stringify(originalLayerName);
        const cId = compId || 0;
        const lIdx = layerIndex || 0;
        const raw = await this.evalScriptAsync(`NoiseCleanHost.importCleanedAudio(${sPath}, ${sName}, ${cId}, ${lIdx})`);
        try {
            return JSON.parse(raw);
        } catch (e) {
            throw new Error(`Failed to parse audio import response: ${raw}`);
        }
    }

    async addFootageToComp(footageId, compId, layerIndex) {
        if (!this.isAvailable) {
            return { success: true, layerIndex: 1, layerName: 'Denoised Layer' };
        }
        const fId = footageId || 0;
        const cId = compId || 0;
        const lIdx = layerIndex || 0;
        const raw = await this.evalScriptAsync(`NoiseCleanHost.addFootageToComp(${fId}, ${cId}, ${lIdx})`);
        try {
            return JSON.parse(raw);
        } catch (e) {
            throw new Error(`Failed to parse addFootageToComp response: ${raw}`);
        }
    }

    async applyNoiseClean(compId, layerIndex, cleanedWavPath, isVideo, originalFilePath = "") {
        if (!this.isAvailable) {
            return { success: true, mode: 'mock' };
        }
        const cId = compId || 0;
        const lIdx = layerIndex || 0;
        const sPath = JSON.stringify(cleanedWavPath);
        const sIsVideo = isVideo ? "true" : "false";
        const sOrig = JSON.stringify(originalFilePath || "");
        const raw = await this.evalScriptAsync(`NoiseCleanHost.applyNoiseClean(${cId}, ${lIdx}, ${sPath}, ${sIsVideo}, ${sOrig})`);
        try {
            return JSON.parse(raw);
        } catch (e) {
            throw new Error(`Failed to parse applyNoiseClean response: ${raw}`);
        }
    }

    async revertNoiseClean(compId, layerIndex, originalPath, isVideo) {
        if (!this.isAvailable) {
            return { success: true };
        }
        const cId = compId || 0;
        const lIdx = layerIndex || 0;
        const sPath = JSON.stringify(originalPath || "");
        const sIsVideo = isVideo ? "true" : "false";
        const raw = await this.evalScriptAsync(`NoiseCleanHost.revertNoiseClean(${cId}, ${lIdx}, ${sPath}, ${sIsVideo})`);
        try {
            return JSON.parse(raw);
        } catch (e) {
            throw new Error(`Failed to parse revertNoiseClean response: ${raw}`);
        }
    }

    async revealFootageInProject(footageId) {
        if (!this.isAvailable) {
            return { success: true };
        }
        const fId = footageId || 0;
        const raw = await this.evalScriptAsync(`NoiseCleanHost.revealFootageInProject(${fId})`);
        try {
            return JSON.parse(raw);
        } catch (e) {
            throw new Error(`Failed to parse revealFootageInProject response: ${raw}`);
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AEBridge;
}
