/**
 * NoiseClean - ExtendScript Audio Export / Preparation Module
 * ES3 Syntax for After Effects Host Compatibility
 */

var NoiseCleanExport = (function() {
    "use strict";

    function isDirectAudioFile(filePath) {
        if (!filePath) return false;
        var lower = filePath.toLowerCase();
        return lower.lastIndexOf(".wav") === lower.length - 4;
    }

    function isSupportedAudioFormat(filePath) {
        if (!filePath) return false;
        var lower = filePath.toLowerCase();
        return lower.lastIndexOf(".wav") === lower.length - 4 ||
               lower.lastIndexOf(".mp3") === lower.length - 4 ||
               lower.lastIndexOf(".aif") === lower.length - 4 ||
               lower.lastIndexOf(".aiff") === lower.length - 5 ||
               lower.lastIndexOf(".m4a") === lower.length - 4 ||
               lower.lastIndexOf(".aac") === lower.length - 4 ||
               lower.lastIndexOf(".flac") === lower.length - 5 ||
               lower.lastIndexOf(".ogg") === lower.length - 4;
    }

    function findDeepFootageInComp(compItem, depth) {
        if (!compItem || !(compItem instanceof CompItem)) return null;
        if (typeof depth === "undefined") depth = 0;
        if (depth > 5) return null;

        // Pass 1: active footage layer with audio enabled
        for (var i = 1; i <= compItem.numLayers; i++) {
            var sub = compItem.layer(i);
            if (sub.enabled && sub.audioEnabled && sub.hasAudio && sub.source && sub.source instanceof FootageItem && sub.source.mainSource && sub.source.mainSource.file) {
                return sub;
            }
        }
        // Pass 2: nested pre-comp recursion
        for (var j = 1; j <= compItem.numLayers; j++) {
            var sub2 = compItem.layer(j);
            if (sub2.enabled && sub2.source && sub2.source instanceof CompItem) {
                var deep = findDeepFootageInComp(sub2.source, depth + 1);
                if (deep) return deep;
            }
        }
        // Pass 3: any footage layer with audio or video
        for (var k = 1; k <= compItem.numLayers; k++) {
            var sub3 = compItem.layer(k);
            if (sub3.source && sub3.source instanceof FootageItem && sub3.source.mainSource && sub3.source.mainSource.file) {
                if (sub3.hasAudio || sub3.hasVideo) {
                    return sub3;
                }
            }
        }
        return null;
    }

    /**
     * Prepares audio from the selected layer.
     * If the layer references a direct audio file, returns its path directly (zero transcoding).
     * If the layer is a pre-comp, drills down to find the underlying source footage directly.
     * If the layer is video with audio or an empty comp layer, renders audio via Render Queue.
     */
    function prepareLayerAudio(targetDir) {
        if (!app.project) {
            return JSON.stringify({ success: false, error: "No active project found in After Effects." });
        }

        var activeItem = app.project.activeItem;
        if (!activeItem || !(activeItem instanceof CompItem)) {
            return JSON.stringify({ success: false, error: "Please open and select a composition." });
        }

        var selectedLayers = activeItem.selectedLayers;
        if (!selectedLayers || selectedLayers.length === 0) {
            return JSON.stringify({ success: false, error: "Select an audio layer in the active composition." });
        }

        var layer = selectedLayers[0];
        var isFootageWithFile = (layer.source && layer.source instanceof FootageItem && layer.source.mainSource && layer.source.mainSource.file);
        var isPrecomp = (layer.source && layer.source instanceof CompItem);

        if (!layer.hasAudio && !isFootageWithFile && !isPrecomp) {
            return JSON.stringify({ success: false, error: "Selected layer does not contain usable audio." });
        }

        var layerName = layer.name || "Audio_Layer";
        var sourceFile = null;

        var targetFootageLayer = null;
        if (isFootageWithFile) {
            targetFootageLayer = layer;
        } else if (isPrecomp) {
            targetFootageLayer = findDeepFootageInComp(layer.source);
        }

        if (targetFootageLayer && targetFootageLayer.source && targetFootageLayer.source instanceof FootageItem && targetFootageLayer.source.mainSource && targetFootageLayer.source.mainSource.file) {
            sourceFile = targetFootageLayer.source.mainSource.file.fsName;

            var trueOriginal = null;
            // 1. Check target footage item comment
            if (targetFootageLayer.source.comment && targetFootageLayer.source.comment.indexOf("ORIG_FILE:") === 0) {
                var storedOrig = targetFootageLayer.source.comment.substring(10);
                if (new File(storedOrig).exists) {
                    trueOriginal = storedOrig;
                }
            }
            // 2. Check target timeline layer comment
            if (!trueOriginal && targetFootageLayer.comment && targetFootageLayer.comment.indexOf("ORIG_FILE:") === 0) {
                var storedLayerOrig = targetFootageLayer.comment.substring(10);
                if (new File(storedLayerOrig).exists) {
                    trueOriginal = storedLayerOrig;
                }
            }
            // 3. Check outer precomp layer comment
            if (!trueOriginal && layer.comment && layer.comment.indexOf("ORIG_FILE:") === 0) {
                var storedOuterOrig = layer.comment.substring(10);
                if (new File(storedOuterOrig).exists) {
                    trueOriginal = storedOuterOrig;
                }
            }
            // 4. Fallback: if sourceFile is not in temporary cleaned folder
            if (!trueOriginal && sourceFile && sourceFile.indexOf("_Cleaned") === -1 && sourceFile.indexOf("_StudioCleaned") === -1 && sourceFile.indexOf("NoiseClean") === -1 && sourceFile.indexOf("output.wav") === -1) {
                trueOriginal = sourceFile;
            }

            var resolvedAudioPath = trueOriginal || sourceFile;
            var isWav = isDirectAudioFile(resolvedAudioPath);
            var isAudio = isSupportedAudioFormat(resolvedAudioPath);
            var isVideo = targetFootageLayer.hasVideo || layer.hasVideo;

            return JSON.stringify({
                success: true,
                directAccess: isWav,
                needsTranscode: !isWav,
                isVideo: isVideo,
                audioPath: resolvedAudioPath,
                originalPath: trueOriginal,
                layerName: layerName,
                layerIndex: layer.index,
                compId: activeItem.id,
                compName: activeItem.name,
                isPrecomp: isPrecomp,
                duration: layer.outPoint - layer.inPoint
            });
        }

        // If direct access is not possible (e.g. video file with embedded audio or comp layer):
        // Export layer audio to targetDir using Render Queue
        try {
            var tempFolder = new Folder(targetDir);
            if (!tempFolder.exists) {
                tempFolder.create();
            }

            var safeName = layerName.replace(/[^a-zA-Z0-9_\-]/g, "_");
            var outWavFile = new File(tempFolder.fsName + "/" + safeName + "_export.wav");

            // Solo this layer temporarily in a temporary duplicate or work area
            var origSolo = layer.solo;
            layer.solo = true;

            var rqItem = app.project.renderQueue.items.add(activeItem);
            var om = rqItem.outputModule(1);

            // Configure WAV audio export robustly
            var applied = false;
            var preferredTemplates = ["WAV", "Waveform Audio", "Lossless Audio", "Audio Only", "AIFF"];
            for (var i = 0; i < preferredTemplates.length; i++) {
                try {
                    om.applyTemplate(preferredTemplates[i]);
                    applied = true;
                    break;
                } catch(e) {}
            }

            // Fallback: search all available templates dynamically for audio-related names
            if (!applied && om.templates) {
                for (var j = 0; j < om.templates.length; j++) {
                    var tName = om.templates[j].toLowerCase();
                    if (tName.indexOf("wav") !== -1 || tName.indexOf("audio") !== -1) {
                        try {
                            om.applyTemplate(om.templates[j]);
                            applied = true;
                            break;
                        } catch(e) {}
                    }
                }
            }

            if (!applied) {
                rqItem.remove();
                return JSON.stringify({
                    success: false,
                    error: "Could not find a WAV or Audio output template in After Effects. Please create a 'WAV' template in the Render Queue."
                });
            }

            om.file = outWavFile;
            
            // Set render work area to layer bounds safely
            var origWorkAreaStart = activeItem.workAreaStart;
            var origWorkAreaDuration = activeItem.workAreaDuration;

            var newStart = layer.inPoint;
            if (newStart < 0) newStart = 0;
            if (newStart > activeItem.duration) newStart = activeItem.duration;

            var newEnd = layer.outPoint;
            if (newEnd > activeItem.duration) newEnd = activeItem.duration;
            if (newEnd < newStart) newEnd = newStart;

            var newDuration = newEnd - newStart;
            // Prevent AE error by shrinking duration before moving start time
            activeItem.workAreaDuration = activeItem.frameDuration || 0.01;
            activeItem.workAreaStart = newStart;
            if (newDuration > 0) {
                // Sometimes float precision causes issues at the very end of the comp
                try {
                    activeItem.workAreaDuration = newDuration;
                } catch(e) {
                    activeItem.workAreaDuration = newDuration - 0.01;
                }
            }

            // Render
            app.project.renderQueue.render();

            // Restore comp and layer settings safely
            layer.solo = origSolo;
            activeItem.workAreaDuration = activeItem.frameDuration || 0.01;
            activeItem.workAreaStart = origWorkAreaStart;
            activeItem.workAreaDuration = origWorkAreaDuration;
            rqItem.remove();

            if (!outWavFile.exists || outWavFile.length < 44) {
                return JSON.stringify({
                    success: false,
                    error: "NoiseClean couldn't export audio from this layer (render queue failed)."
                });
            }

            return JSON.stringify({
                success: true,
                directAccess: false,
                audioPath: outWavFile.fsName,
                layerName: layerName,
                layerIndex: layer.index,
                compId: activeItem.id,
                compName: activeItem.name,
                duration: layer.outPoint - layer.inPoint
            });
        } catch (renderErr) {
            return JSON.stringify({
                success: false,
                error: "Audio export failed: " + renderErr.toString()
            });
        }
    }

    return {
        prepareLayerAudio: prepareLayerAudio,
        isDirectAudioFile: isDirectAudioFile,
        isSupportedAudioFormat: isSupportedAudioFormat,
        findDeepFootageInComp: findDeepFootageInComp
    };
})();
