/**
 * NoiseClean - Universal Audio Demuxer / Extractor
 * Uses bundled FFmpeg to rapidly demux and convert any video or audio format (.mp4, .mov, .mp3, etc.)
 * into standardized uncompressed 48 kHz 16-bit PCM stereo WAV in milliseconds.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const paths = require('./paths');

function extractAudioToWav(inputPath, outputWavPath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(inputPath)) {
            return reject(new Error('Input media file could not be found.'));
        }

        // Always ensure output directory exists
        paths.ensureDir(path.dirname(outputWavPath));

        const ffmpegBin = paths.getFFmpegPath();
        const args = [
            '-y',
            '-i', inputPath,
            '-vn',
            '-acodec', 'pcm_s16le',
            '-ar', '48000',
            '-ac', '2',
            outputWavPath
        ];

        const proc = spawn(ffmpegBin, args);
        let stderr = '';

        proc.stderr.on('data', (d) => {
            stderr += d.toString();
        });

        proc.on('close', (code) => {
            if (code === 0 && fs.existsSync(outputWavPath) && fs.statSync(outputWavPath).size > 44) {
                resolve(outputWavPath);
            } else {
                if (stderr.includes('does not contain any stream') || stderr.includes('Output file is empty')) {
                    reject(new Error('The selected video file does not contain an audio track.'));
                } else if (stderr.includes('No space left on device') || stderr.includes('ENOSPC')) {
                    reject(new Error('Your hard drive is low on storage space. Please free up space on your primary drive (C:) to continue.'));
                } else {
                    reject(new Error('Could not extract audio from this media clip. Please verify the file is supported and not corrupted.'));
                }
            }
        });

        proc.on('error', (err) => {
            reject(new Error('Audio extraction utility could not be started. Please check system permissions.'));
        });
    });
}

/**
 * Losslessly remuxes the original video stream with the newly cleaned audio track.
 * Uses stream-copy (-c:v copy) to bypass video re-encoding completely (finishes in ~200-400ms).
 */
function remuxVideoWithAudio(originalVideoPath, cleanedWavPath, outputVideoPath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(originalVideoPath)) {
            return reject(new Error('Original video file could not be found.'));
        }
        if (!fs.existsSync(cleanedWavPath)) {
            return reject(new Error('Cleaned audio track was not found.'));
        }

        // Always ensure destination directory exists
        paths.ensureDir(path.dirname(outputVideoPath));

        const ffmpegBin = paths.getFFmpegPath();
        const ext = path.extname(originalVideoPath).toLowerCase();

        // Audio codec selection by container format
        const audioArgs = (ext === '.mov')
            ? ['-c:a', 'pcm_s24le']
            : ['-c:a', 'aac', '-b:a', '320k'];

        const formatFlags = (ext === '.mp4' || ext === '.mov' || ext === '.m4v')
            ? ['-movflags', '+faststart']
            : [];

        const args = [
            '-y',
            '-i', originalVideoPath,
            '-i', cleanedWavPath,
            '-c:v', 'copy',
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-map_metadata', '0',
            ...audioArgs,
            ...formatFlags,
            '-shortest',
            outputVideoPath
        ];

        const proc = spawn(ffmpegBin, args);
        let stderr = '';

        proc.stderr.on('data', (d) => {
            stderr += d.toString();
        });

        proc.on('close', (code) => {
            if (code === 0 && fs.existsSync(outputVideoPath) && fs.statSync(outputVideoPath).size > 500) {
                resolve(outputVideoPath);
            } else {
                if (stderr.includes('Permission denied')) {
                    // Windows file-lock detected: host app has the destination file open.
                    // Automatically retry with a fresh unique filename to bypass the lock seamlessly.
                    const parsed = path.parse(outputVideoPath);
                    const fallbackPath = path.join(parsed.dir, `${parsed.name}_${Date.now().toString(36)}${parsed.ext}`);
                    remuxVideoWithAudio(originalVideoPath, cleanedWavPath, fallbackPath)
                        .then(resolve)
                        .catch(reject);
                    return;
                }
                if (stderr.includes('No space left on device') || stderr.includes('ENOSPC')) {
                    return reject(new Error('Your hard drive is low on storage space. Please free up space on your primary drive (C:) to continue.'));
                }
                reject(new Error('Video remuxing failed. Please ensure the media file is not write-protected.'));
            }
        });

        proc.on('error', (err) => {
            reject(new Error('Video processing utility could not be started. Please check system permissions.'));
        });
    });
}

module.exports = {
    extractAudioToWav,
    remuxVideoWithAudio
};

