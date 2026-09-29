const fs = require('fs');

function writeWav(filename, sampleRate, numChannels, samples) {
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    // fmt sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size for PCM
    buffer.writeUInt16LE(1, 20);  // AudioFormat 1 = PCM
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bytesPerSample * 8, 34);

    // data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        let s = samples[i];
        if (s > 1.0) s = 1.0;
        if (s < -1.0) s = -1.0;
        buffer.writeInt16LE(Math.round(s * 32767), offset);
        offset += 2;
    }

    fs.writeFileSync(filename, buffer);
    console.log(`Wrote ${filename}: ${sampleRate} Hz, ${numChannels} ch, ${(samples.length / numChannels / sampleRate).toFixed(2)}s, ${buffer.length} bytes`);
}

// 1. Generate 48kHz mono test (5 seconds)
{
    const sr = 48000;
    const ch = 1;
    const duration = 5.0;
    const totalFrames = Math.floor(sr * duration);
    const samples = new Float32Array(totalFrames * ch);

    for (let i = 0; i < totalFrames; i++) {
        const t = i / sr;
        // Speech formant simulation: 3 bursts of voice-like harmonic signal
        let voice = 0;
        if ((t >= 0.5 && t <= 1.8) || (t >= 2.5 && t <= 4.2)) {
            const f0 = 180 + 30 * Math.sin(2 * Math.PI * 1.5 * t);
            voice = 0.35 * Math.sin(2 * Math.PI * f0 * t)
                  + 0.25 * Math.sin(2 * Math.PI * 2 * f0 * t)
                  + 0.15 * Math.sin(2 * Math.PI * 3 * f0 * t)
                  + 0.10 * Math.sin(2 * Math.PI * 5 * f0 * t);
            // Apply envelope
            const env = Math.sin(Math.PI * ((t % 1.5) / 1.5));
            voice *= Math.max(0, env);
        }

        // Noise: continuous broadband white noise + 120Hz hum
        const whiteNoise = (Math.random() * 2 - 1) * 0.15;
        const hum = 0.08 * Math.sin(2 * Math.PI * 120 * t);

        samples[i] = voice + whiteNoise + hum;
    }

    writeWav('test_noisy_48k_mono.wav', sr, ch, samples);
}

// 2. Generate 44.1kHz stereo test (5 seconds)
{
    const sr = 44100;
    const ch = 2;
    const duration = 5.0;
    const totalFrames = Math.floor(sr * duration);
    const samples = new Float32Array(totalFrames * ch);

    for (let i = 0; i < totalFrames; i++) {
        const t = i / sr;
        let voiceL = 0, voiceR = 0;
        if ((t >= 0.8 && t <= 2.0) || (t >= 2.8 && t <= 4.5)) {
            const f0 = 220 + 20 * Math.sin(2 * Math.PI * 2 * t);
            const v = 0.4 * Math.sin(2 * Math.PI * f0 * t) + 0.2 * Math.sin(2 * Math.PI * 2 * f0 * t);
            voiceL = v * 0.8;
            voiceR = v * 0.6;
        }

        const noiseL = (Math.random() * 2 - 1) * 0.18 + 0.05 * Math.sin(2 * Math.PI * 60 * t);
        const noiseR = (Math.random() * 2 - 1) * 0.18 + 0.05 * Math.sin(2 * Math.PI * 60 * t);

        samples[i * 2 + 0] = voiceL + noiseL;
        samples[i * 2 + 1] = voiceR + noiseR;
    }

    writeWav('test_noisy_44k_stereo.wav', sr, ch, samples);
}
