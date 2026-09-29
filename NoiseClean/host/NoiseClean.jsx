/**
 * NoiseClean - Host ExtendScript Main Entry Point
 * Adobe After Effects CEP Integration Layer
 */

#include "json2.jsx"
#include "audio-export.jsx"
#include "audio-import.jsx"

var NoiseCleanHost = (function() {
    "use strict";

    /**
     * Inspects active composition and returns detailed info about the currently selected audio layer.
     */
    function getSelectedAudioLayer() {
        if (!app.project) {
            return JSON.stringify({
                success: true,
                hasSelection: false,
                reason: "NO_PROJECT",
                message: "No project currently open."
            });
        }

        var activeItem = app.project.activeItem;
        if (!activeItem || !(activeItem instanceof CompItem)) {
            return JSON.stringify({
                success: true,
                hasSelection: false,
                reason: "NO_COMP",
                message: "Open a composition to select an audio layer."
            });
        }

        var selectedLayers = activeItem.selectedLayers;
        if (!selectedLayers || selectedLayers.length === 0) {
            return JSON.stringify({
                success: true,
                hasSelection: false,
                reason: "NO_LAYER",
                message: "Select an audio layer in After Effects."
            });
        }

        var layer = selectedLayers[0];
        var isFootageWithFile = (layer.source && layer.source instanceof FootageItem && layer.source.mainSource && layer.source.mainSource.file);
        var isPrecomp = (layer.source && layer.source instanceof CompItem);

        if (!layer.hasAudio && !isFootageWithFile && !isPrecomp) {
            return JSON.stringify({
                success: true,
                hasSelection: false,
                reason: "NO_AUDIO",
                layerName: layer.name,
                message: "Selected layer does not contain usable audio."
            });
        }

        var sourcePath = null;
        var isDirect = false;
        var sourceKind = isPrecomp ? "Pre-comp Audio" : "Synthesized Audio";

        var isVideo = layer.hasVideo;
        var isCleaned = NoiseCleanImport.isLayerCleaned(activeItem.id, layer.index);

        if (layer.source && layer.source instanceof FootageItem && layer.source.mainSource && layer.source.mainSource.file) {
            sourcePath = layer.source.mainSource.file.fsName;
            isDirect = NoiseCleanExport.isDirectAudioFile(sourcePath);
            var isAudio = NoiseCleanExport.isSupportedAudioFormat(sourcePath);
            if (isDirect) {
                sourceKind = "WAV Audio";
                isVideo = false;
            } else if (isAudio) {
                sourceKind = "Audio File";
                isVideo = false;
            } else {
                sourceKind = "Video Audio";
                isVideo = true;
            }
        } else if (isPrecomp) {
            var deepFootage = NoiseCleanExport.findDeepFootageInComp(layer.source);
            if (deepFootage && deepFootage.source && deepFootage.source.mainSource && deepFootage.source.mainSource.file) {
                sourcePath = deepFootage.source.mainSource.file.fsName;
                isDirect = NoiseCleanExport.isDirectAudioFile(sourcePath);
                isVideo = deepFootage.hasVideo || layer.hasVideo;
                sourceKind = isVideo ? "Pre-comp Video" : "Pre-comp Audio";
            }
        }

        var duration = (layer.outPoint - layer.inPoint);

        return JSON.stringify({
            success: true,
            hasSelection: true,
            layerIndex: layer.index,
            layerName: layer.name,
            sourceKind: sourceKind,
            isVideo: isVideo,
            isCleaned: isCleaned,
            isDirect: isDirect,
            sourcePath: sourcePath,
            audioEnabled: layer.audioEnabled,
            durationSec: duration,
            compId: activeItem.id,
            compName: activeItem.name
        });
    }

    /**
     * Reveals a footage item in the Project panel.
     */
    function revealFootageInProject(footageId) {
        if (!app.project) return JSON.stringify({ success: false });
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item.id === footageId) {
                // Focus and select the item in the project panel
                for (var j = 1; j <= app.project.numItems; j++) {
                    app.project.item(j).selected = false;
                }
                item.selected = true;
                return JSON.stringify({ success: true, footageName: item.name });
            }
        }
        return JSON.stringify({ success: false, error: "Footage item not found." });
    }

    /**
     * Bridge heartbeat / ping.
     */
    function ping() {
        return JSON.stringify({
            status: "ok",
            app: app.name,
            version: app.version,
            os: $.os
        });
    }

    return {
        ping: ping,
        getSelectedAudioLayer: getSelectedAudioLayer,
        prepareLayerAudio: NoiseCleanExport.prepareLayerAudio,
        importCleanedAudio: NoiseCleanImport.importCleanedAudio,
        addFootageToComp: NoiseCleanImport.addFootageToComp,
        applyNoiseClean: NoiseCleanImport.applyNoiseClean,
        revertNoiseClean: NoiseCleanImport.revertNoiseClean,
        isLayerCleaned: NoiseCleanImport.isLayerCleaned,
        revealFootageInProject: revealFootageInProject,
        importStemLayer: NoiseCleanImport.importStemLayer,
        importAllStems: NoiseCleanImport.importAllStems
    };
})();
