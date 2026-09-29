/**
 * NoiseClean - ExtendScript Audio Import & Project Management Module
 * ES3 Syntax for After Effects Host Compatibility
 */

var NoiseCleanImport = (function() {
    "use strict";

    /**
     * Imports the cleaned WAV file as a project footage item,
     * organizes it into the original footage's bin/folder, and names it OriginalName_Denoised.wav.
     * @param {string} cleanedWavPath Absolute path to the cleaned WAV
     * @param {string} originalLayerName Name of the source layer
     * @param {number} compId Target composition ID (optional)
     * @param {number} layerIndex Target layer index (optional)
     */
    function importCleanedAudio(cleanedWavPath, originalLayerName, compId, layerIndex) {
        if (!app.project) {
            return JSON.stringify({ success: false, error: "No active project in After Effects." });
        }

        var importFile = new File(cleanedWavPath);
        if (!importFile.exists) {
            return JSON.stringify({ success: false, error: "Cleaned audio file not found on disk: " + cleanedWavPath });
        }

        try {
            app.beginUndoGroup("NoiseClean: Import Denoised Audio");

            // 1. Import footage item
            var importOptions = new ImportOptions(importFile);
            var importedFootage = app.project.importFile(importOptions);

            if (!importedFootage) {
                app.endUndoGroup();
                return JSON.stringify({ success: false, error: "After Effects failed to import cleaned audio file." });
            }

            // 2. Set clear professional name: OriginalName_Denoised.wav
            var baseName = originalLayerName || "Audio";
            baseName = baseName.replace(/\.[a-zA-Z0-9]+$/, ""); // strip extension if present
            var denoisedName = baseName + "_Denoised.wav";
            importedFootage.name = denoisedName;

            // 3. Place in the same project folder / bin as the original source footage if available
            var targetFolder = app.project.rootFolder;
            if (layerIndex && compId) {
                var comp = null;
                if (app.project.activeItem && app.project.activeItem instanceof CompItem && app.project.activeItem.id === compId) {
                    comp = app.project.activeItem;
                } else {
                    for (var i = 1; i <= app.project.numItems; i++) {
                        if (app.project.item(i).id === compId && app.project.item(i) instanceof CompItem) {
                            comp = app.project.item(i);
                            break;
                        }
                    }
                }
                if (comp && layerIndex <= comp.numLayers) {
                    var origLayer = comp.layer(layerIndex);
                    if (origLayer && origLayer.source && origLayer.source.parentFolder) {
                        targetFolder = origLayer.source.parentFolder;
                    }
                }
            }

            if (targetFolder && targetFolder !== app.project.rootFolder) {
                importedFootage.parentFolder = targetFolder;
            }

            app.endUndoGroup();

            return JSON.stringify({
                success: true,
                footageId: importedFootage.id,
                footageName: importedFootage.name,
                filePath: cleanedWavPath,
                duration: importedFootage.duration
            });
        } catch (err) {
            try { app.endUndoGroup(); } catch (e) {}
            return JSON.stringify({
                success: false,
                error: "Failed to import cleaned audio: " + err.toString()
            });
        }
    }

    /**
     * Adds the imported denoised audio footage as a new layer to the active composition.
     * Aligns inPoint, outPoint, and startTime with the original layer.
     */
    function addFootageToComp(footageId, compId, originalLayerIndex) {
        if (!app.project) {
            return JSON.stringify({ success: false, error: "No active project." });
        }

        try {
            app.beginUndoGroup("NoiseClean: Add Denoised Audio to Comp");

            // Locate footage item
            var footage = null;
            for (var i = 1; i <= app.project.numItems; i++) {
                if (app.project.item(i).id === footageId) {
                    footage = app.project.item(i);
                    break;
                }
            }
            if (!footage) {
                app.endUndoGroup();
                return JSON.stringify({ success: false, error: "Cleaned footage item not found in project." });
            }

            // Locate comp
            var comp = null;
            if (compId) {
                for (var j = 1; j <= app.project.numItems; j++) {
                    if (app.project.item(j).id === compId && app.project.item(j) instanceof CompItem) {
                        comp = app.project.item(j);
                        break;
                    }
                }
            }
            if (!comp) {
                comp = app.project.activeItem;
            }
            if (!comp || !(comp instanceof CompItem)) {
                app.endUndoGroup();
                return JSON.stringify({ success: false, error: "Target composition not found." });
            }

            // Locate original layer BEFORE adding new footage to comp
            var origLayer = null;
            if (originalLayerIndex && originalLayerIndex <= comp.numLayers) {
                origLayer = comp.layer(originalLayerIndex);
            }

            // Add new cleaned layer to comp
            var newLayer = comp.layers.add(footage);
            newLayer.audioEnabled = true;

            // Match original layer timing and mute original layer
            if (origLayer) {
                newLayer.startTime = origLayer.startTime;
                newLayer.inPoint = origLayer.inPoint;
                newLayer.outPoint = origLayer.outPoint;
                // Move new layer directly above original layer
                newLayer.moveBefore(origLayer);
            }

            app.endUndoGroup();

            return JSON.stringify({
                success: true,
                layerIndex: newLayer.index,
                layerName: newLayer.name
            });
        } catch (err) {
            try { app.endUndoGroup(); } catch (e) {}
            return JSON.stringify({
                success: false,
                error: "Failed to add layer to comp: " + err.toString()
            });
        }
    }

    /**
     * Applies noise reduction in-place.
     * For audio files: replaces footage source directly (0 new layers, 0 duplicate tracks).
     * For video files: creates a linked parented companion audio layer and mutes original video audio.
     */
    function applyNoiseClean(compId, layerIndex, cleanedWavPath, isVideo, originalFilePath) {
        if (!app.project) return JSON.stringify({ success: false, error: "No active project." });

        try {
            app.beginUndoGroup("NoiseClean: Reduce Noise");

            var comp = null;
            if (app.project.activeItem && app.project.activeItem instanceof CompItem && (!compId || app.project.activeItem.id === compId)) {
                comp = app.project.activeItem;
            } else if (compId) {
                for (var i = 1; i <= app.project.numItems; i++) {
                    if (app.project.item(i).id === compId && app.project.item(i) instanceof CompItem) {
                        comp = app.project.item(i);
                        break;
                    }
                }
            }
            if (!comp || layerIndex > comp.numLayers) {
                app.endUndoGroup();
                return JSON.stringify({ success: false, error: "Layer not found in composition." });
            }

            var origLayer = comp.layer(layerIndex);
            if (!origLayer) {
                app.endUndoGroup();
                return JSON.stringify({ success: false, error: "Original layer reference lost." });
            }

            var cleanedFile = new File(cleanedWavPath);
            if (!cleanedFile.exists) {
                app.endUndoGroup();
                return JSON.stringify({ success: false, error: "Cleaned WAV file does not exist on disk." });
            }

            // Target either the footage layer directly, or if it's a pre-comp, drill down to its nested footage layer!
            var targetLayer = origLayer;
            var isPrecomp = (origLayer.source && origLayer.source instanceof CompItem);
            if (isPrecomp && typeof NoiseCleanExport !== "undefined" && NoiseCleanExport.findDeepFootageInComp) {
                var nestedFootage = NoiseCleanExport.findDeepFootageInComp(origLayer.source);
                if (nestedFootage) {
                    targetLayer = nestedFootage;
                }
            }

            if (targetLayer.source && targetLayer.source instanceof FootageItem) {
                // In-place source replacement for both audio and video files (CapCut style)
                var origPath = targetLayer.source.mainSource.file ? targetLayer.source.mainSource.file.fsName : null;
                var origFootageName = targetLayer.source.name;
                var origLayerName = targetLayer.name;

                // CRITICAL: Determine true original path before replacing
                var trueOriginalPath = (originalFilePath && typeof originalFilePath === "string" && originalFilePath.length > 0) ? originalFilePath : null;
                if (!trueOriginalPath && targetLayer.source.comment && targetLayer.source.comment.indexOf("ORIG_FILE:") === 0) {
                    trueOriginalPath = targetLayer.source.comment.substring(10);
                }
                if (!trueOriginalPath && targetLayer.comment && targetLayer.comment.indexOf("ORIG_FILE:") === 0) {
                    trueOriginalPath = targetLayer.comment.substring(10);
                }
                if (!trueOriginalPath && origLayer.comment && origLayer.comment.indexOf("ORIG_FILE:") === 0) {
                    trueOriginalPath = origLayer.comment.substring(10);
                }
                if (!trueOriginalPath && origPath && origPath.indexOf("_Cleaned") === -1 && origPath.indexOf("_StudioCleaned") === -1 && origPath.indexOf("NoiseClean") === -1 && origPath.indexOf("output.wav") === -1) {
                    trueOriginalPath = origPath;
                }

                targetLayer.source.replace(cleanedFile);
                try { targetLayer.source.reload(); } catch (eRel) {}

                // Set ORIG_FILE: AFTER replace on source, target layer, AND outer pre-comp layer!
                if (trueOriginalPath) {
                    try { targetLayer.source.comment = "ORIG_FILE:" + trueOriginalPath; } catch (eC1) {}
                    try { targetLayer.comment = "ORIG_FILE:" + trueOriginalPath; } catch (eC2) {}
                    if (isPrecomp) {
                        try { origLayer.comment = "ORIG_FILE:" + trueOriginalPath; } catch (eC3) {}
                    }
                }

                // Preserve exact original names so AE does not rename footage or layer
                try {
                    targetLayer.source.name = origFootageName;
                    targetLayer.name = origLayerName;
                } catch (eName) {}

                // Always ensure timeline layer audio is active (never muted)
                try { targetLayer.audioEnabled = true; } catch (eAud) {}
                try { origLayer.audioEnabled = true; } catch (eAud2) {}

                app.endUndoGroup();
                return JSON.stringify({
                    success: true,
                    mode: isVideo ? "in_place_video_remux" : "in_place_audio_replace",
                    layerIndex: origLayer.index,
                    isPrecomp: isPrecomp,
                    originalPath: trueOriginalPath || origPath
                });
            } else {
                app.endUndoGroup();
                return JSON.stringify({ success: false, error: "Selected layer is not a footage or supported pre-comp layer." });
            }
        } catch (err) {
            try { app.endUndoGroup(); } catch (e) {}
            return JSON.stringify({ success: false, error: "Apply failed: " + err.toString() });
        }
    }

    /**
     * Reverts noise reduction back to original audio or video.
     */
    function revertNoiseClean(compId, layerIndex, originalPath, isVideo) {
        if (!app.project) return JSON.stringify({ success: false, error: "No active project." });

        try {
            app.beginUndoGroup("NoiseClean: Revert Noise Reduction");

            var comp = null;
            if (app.project.activeItem && app.project.activeItem instanceof CompItem && (!compId || app.project.activeItem.id === compId)) {
                comp = app.project.activeItem;
            } else if (compId) {
                for (var i = 1; i <= app.project.numItems; i++) {
                    if (app.project.item(i).id === compId && app.project.item(i) instanceof CompItem) {
                        comp = app.project.item(i);
                        break;
                    }
                }
            }
            if (!comp || layerIndex > comp.numLayers) {
                app.endUndoGroup();
                return JSON.stringify({ success: false, error: "Layer not found." });
            }

            var origLayer = comp.layer(layerIndex);
            if (!origLayer) {
                app.endUndoGroup();
                return JSON.stringify({ success: false, error: "Original layer not found." });
            }

            // Remove any legacy companion layers if present
            var companionName = "[NoiseClean] " + origLayer.name;
            for (var k = comp.numLayers; k >= 1; k--) {
                if (comp.layer(k).name === companionName || (comp.layer(k).parent === origLayer && comp.layer(k).name.indexOf("[NoiseClean]") !== -1)) {
                    try { comp.layer(k).remove(); } catch(eRem) {}
                }
            }
            origLayer.audioEnabled = true;

            // Target either the footage layer directly, or if it's a pre-comp, drill down to its nested footage layer!
            var targetLayer = origLayer;
            var isPrecomp = (origLayer.source && origLayer.source instanceof CompItem);
            if (isPrecomp && typeof NoiseCleanExport !== "undefined" && NoiseCleanExport.findDeepFootageInComp) {
                var nestedFootage = NoiseCleanExport.findDeepFootageInComp(origLayer.source);
                if (nestedFootage) {
                    targetLayer = nestedFootage;
                }
            }

            if (targetLayer.source && targetLayer.source instanceof FootageItem) {
                var pathToRestore = null;
                var origFootageName = targetLayer.source.name;
                var origLayerName = targetLayer.name;

                if (targetLayer.source.comment && targetLayer.source.comment.indexOf("ORIG_FILE:") === 0) {
                    pathToRestore = targetLayer.source.comment.substring(10);
                }
                if (!pathToRestore && targetLayer.comment && targetLayer.comment.indexOf("ORIG_FILE:") === 0) {
                    pathToRestore = targetLayer.comment.substring(10);
                }
                if (!pathToRestore && origLayer.comment && origLayer.comment.indexOf("ORIG_FILE:") === 0) {
                    pathToRestore = origLayer.comment.substring(10);
                }
                if (!pathToRestore && originalPath && originalPath.indexOf("_Denoised") === -1 && originalPath.indexOf("_Cleaned") === -1 && originalPath.indexOf("_StudioCleaned") === -1 && originalPath.indexOf("NoiseClean") === -1 && originalPath.indexOf("output.wav") === -1) {
                    pathToRestore = originalPath;
                }

                if (pathToRestore) {
                    var origFile = new File(pathToRestore);
                    if (origFile.exists) {
                        targetLayer.source.replace(origFile);
                        try { targetLayer.source.reload(); } catch (eRel) {}
                        try { targetLayer.source.comment = ""; } catch (eC1) {}
                        try { targetLayer.comment = ""; } catch (eC2) {}
                        if (isPrecomp) {
                            try { origLayer.comment = ""; } catch (eC3) {}
                        }
                        try {
                            targetLayer.source.name = origFootageName;
                            targetLayer.name = origLayerName;
                        } catch (eName) {}

                        // Always ensure timeline layer audio is active (never muted)
                        try { targetLayer.audioEnabled = true; } catch (eAud) {}
                        try { origLayer.audioEnabled = true; } catch (eAud2) {}

                        app.endUndoGroup();
                        return JSON.stringify({ success: true, mode: "revert_in_place", restoredPath: pathToRestore });
                    } else {
                        app.endUndoGroup();
                        return JSON.stringify({ success: false, error: "Original media file not found on disk: " + pathToRestore });
                    }
                } else {
                    app.endUndoGroup();
                    return JSON.stringify({ success: false, error: "Could not locate original file path to restore." });
                }
            }

            app.endUndoGroup();
            return JSON.stringify({ success: true });
        } catch (err) {
            try { app.endUndoGroup(); } catch (e) {}
            return JSON.stringify({ success: false, error: "Revert failed: " + err.toString() });
        }
    }

    /**
     * Checks if a layer currently has NoiseClean active.
     */
    function isLayerCleaned(compId, layerIndex) {
        if (!app.project) return false;
        var comp = null;
        if (app.project.activeItem && app.project.activeItem instanceof CompItem && (!compId || app.project.activeItem.id === compId)) {
            comp = app.project.activeItem;
        } else if (compId) {
            for (var i = 1; i <= app.project.numItems; i++) {
                if (app.project.item(i).id === compId && app.project.item(i) instanceof CompItem) {
                    comp = app.project.item(i);
                    break;
                }
            }
        }
        if (!comp || layerIndex > comp.numLayers) return false;

        var layer = comp.layer(layerIndex);
        if (!layer) return false;

        // Check if source file or layer has ORIG_FILE comment (O(1))
        if (layer.source && layer.source.comment && layer.source.comment.indexOf("ORIG_FILE:") === 0) {
            return true;
        }
        if (layer.comment && layer.comment.indexOf("ORIG_FILE:") === 0) {
            return true;
        }
        if (layer.source && layer.source.mainSource && layer.source.mainSource.file) {
            var fName = layer.source.mainSource.file.fsName;
            if (fName.indexOf("_Denoised") !== -1 || fName.indexOf("_Cleaned") !== -1 || fName.indexOf("_StudioCleaned") !== -1 || fName.indexOf("NoiseClean") !== -1) {
                return true;
            }
        }

        // If pre-comp, check nested footage
        if (layer.source && layer.source instanceof CompItem && typeof NoiseCleanExport !== "undefined" && NoiseCleanExport.findDeepFootageInComp) {
            var nested = NoiseCleanExport.findDeepFootageInComp(layer.source);
            if (nested) {
                if (nested.comment && nested.comment.indexOf("ORIG_FILE:") === 0) return true;
                if (nested.source && nested.source.comment && nested.source.comment.indexOf("ORIG_FILE:") === 0) return true;
                if (nested.source && nested.source.mainSource && nested.source.mainSource.file) {
                    var nName = nested.source.mainSource.file.fsName;
                    if (nName.indexOf("_Denoised") !== -1 || nName.indexOf("_Cleaned") !== -1 || nName.indexOf("_StudioCleaned") !== -1 || nName.indexOf("NoiseClean") !== -1) {
                        return true;
                    }
                }
            }
        }
        if (layer.source && layer.source.mainSource && layer.source.mainSource.file) {
            var fName = layer.source.mainSource.file.fsName;
            if (fName.indexOf("_Denoised") !== -1 || fName.indexOf("_Cleaned") !== -1 || fName.indexOf("_StudioCleaned") !== -1 || fName.indexOf("NoiseClean") !== -1) {
                return true;
            }
        }

        return false;
    }

    /**
     * Gets or creates a project bin folder for audio stems.
     */
    function getOrCreateStemsFolder(parentFolder) {
        var folderName = "AudioPro Stems";
        var targetParent = parentFolder || app.project.rootFolder;
        for (var i = 1; i <= targetParent.numItems; i++) {
            var item = targetParent.item(i);
            if (item instanceof FolderItem && item.name === folderName) {
                return item;
            }
        }
        var newFolder = app.project.items.addFolder(folderName);
        if (targetParent !== app.project.rootFolder) {
            newFolder.parentFolder = targetParent;
        }
        return newFolder;
    }

    /**
     * Maps stem type to AE layer label index:
     * Voice -> 2 (Yellow)
     * Music -> 8 (Blue/Cyan)
     * Noise -> 1 (Red/Peach)
     */
    function getStemLabelIndex(stemType) {
        var lower = (stemType || "").toLowerCase();
        if (lower.indexOf("voice") !== -1 || lower.indexOf("vocal") !== -1 || lower.indexOf("speech") !== -1) return 2; // Yellow
        if (lower.indexOf("music") !== -1 || lower.indexOf("melody") !== -1 || lower.indexOf("inst") !== -1) return 8; // Cyan / Blue
        if (lower.indexOf("noise") !== -1 || lower.indexOf("room") !== -1 || lower.indexOf("amb") !== -1 || lower.indexOf("sfx") !== -1) return 1; // Red / Peach
        return 5; // Lavender
    }

    /**
     * Imports a single stem WAV and adds it to the timeline above the original layer.
     * Aligns timing, sets label color, and mutes original layer audio.
     */
    function importStemLayer(stemWavPath, stemType, originalLayerIndex, compId) {
        if (!app.project) {
            return JSON.stringify({ success: false, error: "No active project in After Effects." });
        }

        var stemFile = new File(stemWavPath);
        if (!stemFile.exists) {
            return JSON.stringify({ success: false, error: "Stem WAV file does not exist: " + stemWavPath });
        }

        try {
            app.beginUndoGroup("AudioPro: Add " + stemType + " Stem");

            // Locate comp
            var comp = null;
            if (app.project.activeItem && app.project.activeItem instanceof CompItem && (!compId || app.project.activeItem.id === compId)) {
                comp = app.project.activeItem;
            } else if (compId) {
                for (var i = 1; i <= app.project.numItems; i++) {
                    if (app.project.item(i).id === compId && app.project.item(i) instanceof CompItem) {
                        comp = app.project.item(i);
                        break;
                    }
                }
            }
            if (!comp) {
                comp = app.project.activeItem;
            }
            if (!comp || !(comp instanceof CompItem)) {
                app.endUndoGroup();
                return JSON.stringify({ success: false, error: "Target composition not found." });
            }

            var origLayer = null;
            if (originalLayerIndex && originalLayerIndex <= comp.numLayers) {
                origLayer = comp.layer(originalLayerIndex);
            }

            // 1. Import footage item
            var importOptions = new ImportOptions(stemFile);
            var footage = app.project.importFile(importOptions);
            if (!footage) {
                app.endUndoGroup();
                return JSON.stringify({ success: false, error: "After Effects failed to import stem WAV." });
            }

            // Clean footage name
            var baseName = (origLayer ? origLayer.name : "Clip").replace(/\.[a-zA-Z0-9]+$/, "");
            footage.name = baseName + "_" + stemType + ".wav";

            // Move to Stems bin
            var parentFolder = (origLayer && origLayer.source && origLayer.source.parentFolder) ? origLayer.source.parentFolder : app.project.rootFolder;
            var stemsBin = getOrCreateStemsFolder(parentFolder);
            footage.parentFolder = stemsBin;

            // 2. Add layer to composition
            var newLayer = comp.layers.add(footage);
            newLayer.name = baseName + " [" + stemType + "]";
            newLayer.audioEnabled = true;

            // 3. Align timeline timing and position
            if (origLayer) {
                newLayer.startTime = origLayer.startTime;
                newLayer.inPoint = origLayer.inPoint;
                newLayer.outPoint = origLayer.outPoint;
                newLayer.moveBefore(origLayer);
                // Non-destructively mute original layer to prevent phase doubling
                origLayer.audioEnabled = false;
            }

            // 4. Color-code layer label
            try {
                newLayer.label = getStemLabelIndex(stemType);
            } catch (eLbl) {}

            // Select only the new stem layer
            for (var s = 1; s <= comp.numLayers; s++) {
                comp.layer(s).selected = false;
            }
            newLayer.selected = true;

            app.endUndoGroup();

            return JSON.stringify({
                success: true,
                layerIndex: newLayer.index,
                layerName: newLayer.name,
                stemType: stemType,
                footageId: footage.id
            });
        } catch (err) {
            try { app.endUndoGroup(); } catch (e) {}
            return JSON.stringify({ success: false, error: "Failed to import stem: " + err.toString() });
        }
    }

    /**
     * Imports all 3 stems in a single batch, positions them synchronously above the original layer,
     * assigns individual label colors, and mutes original layer audio.
     */
    function importAllStems(stemsDataJson, originalLayerIndex, compId) {
        if (!app.project) {
            return JSON.stringify({ success: false, error: "No active project in After Effects." });
        }

        var stemsData = stemsDataJson;
        if (typeof stemsData === "string") {
            try {
                stemsData = JSON.parse(stemsDataJson);
            } catch (e) {
                return JSON.stringify({ success: false, error: "Invalid stems JSON data." });
            }
        }

        try {
            app.beginUndoGroup("AudioPro: Split & Add 3 Stems to Timeline");

            var comp = null;
            if (app.project.activeItem && app.project.activeItem instanceof CompItem && (!compId || app.project.activeItem.id === compId)) {
                comp = app.project.activeItem;
            } else if (compId) {
                for (var i = 1; i <= app.project.numItems; i++) {
                    if (app.project.item(i).id === compId && app.project.item(i) instanceof CompItem) {
                        comp = app.project.item(i);
                        break;
                    }
                }
            }
            if (!comp) {
                comp = app.project.activeItem;
            }
            if (!comp || !(comp instanceof CompItem)) {
                app.endUndoGroup();
                return JSON.stringify({ success: false, error: "Target composition not found." });
            }

            var origLayer = null;
            if (originalLayerIndex && originalLayerIndex <= comp.numLayers) {
                origLayer = comp.layer(originalLayerIndex);
            }

            var baseName = (origLayer ? origLayer.name : "Clip").replace(/\.[a-zA-Z0-9]+$/, "");
            var parentFolder = (origLayer && origLayer.source && origLayer.source.parentFolder) ? origLayer.source.parentFolder : app.project.rootFolder;
            var stemsBin = getOrCreateStemsFolder(parentFolder);

            // Import sequence: Noise on bottom, Music in middle, Voice on top
            var stemList = [
                { type: "Noise", path: stemsData.noise || stemsData.sfx },
                { type: "Music", path: stemsData.music },
                { type: "Voice", path: stemsData.voice || stemsData.vocals }
            ];

            var addedLayers = [];

            // Deselect all existing layers
            for (var d = 1; d <= comp.numLayers; d++) {
                comp.layer(d).selected = false;
            }

            for (var k = 0; k < stemList.length; k++) {
                var item = stemList[k];
                if (!item.path) continue;
                var f = new File(item.path);
                if (!f.exists) continue;

                var impOpt = new ImportOptions(f);
                var ftg = app.project.importFile(impOpt);
                if (!ftg) continue;

                ftg.name = baseName + "_" + item.type + ".wav";
                ftg.parentFolder = stemsBin;

                var ly = comp.layers.add(ftg);
                ly.name = baseName + " [" + item.type + "]";
                ly.audioEnabled = true;

                if (origLayer) {
                    ly.startTime = origLayer.startTime;
                    ly.inPoint = origLayer.inPoint;
                    ly.outPoint = origLayer.outPoint;
                    ly.moveBefore(origLayer);
                }

                try {
                    ly.label = getStemLabelIndex(item.type);
                } catch (eL) {}

                ly.selected = true;
                addedLayers.push({
                    stemType: item.type,
                    layerIndex: ly.index,
                    layerName: ly.name
                });
            }

            // Non-destructively mute original layer
            if (origLayer) {
                origLayer.audioEnabled = false;
            }

            app.endUndoGroup();

            return JSON.stringify({
                success: true,
                count: addedLayers.length,
                layers: addedLayers
            });
        } catch (err) {
            try { app.endUndoGroup(); } catch (e) {}
            return JSON.stringify({ success: false, error: "Failed to add stems to comp: " + err.toString() });
        }
    }

    return {
        importCleanedAudio: importCleanedAudio,
        addFootageToComp: addFootageToComp,
        applyNoiseClean: applyNoiseClean,
        revertNoiseClean: revertNoiseClean,
        isLayerCleaned: isLayerCleaned,
        importStemLayer: importStemLayer,
        importAllStems: importAllStems
    };
})();
