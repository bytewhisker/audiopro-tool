#define MINIAUDIO_IMPLEMENTATION
#define MA_NO_DEVICE_IO
#define MA_NO_THREADING
#include "miniaudio.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "rnnoise.h"

#define RNNOISE_FRAME_SIZE 480
#define RNNOISE_SAMPLE_RATE 48000

static void print_usage(const char *prog) {
    fprintf(stderr, "NoiseClean RNNoise CLI v1.0.0\n");
    fprintf(stderr, "Usage: %s <input.wav> <output.wav>\n", prog);
    fprintf(stderr, "Options:\n");
    fprintf(stderr, "  -h, --help    Show this help message\n");
}

int main(int argc, char *argv[]) {
    if (argc >= 2 && (strcmp(argv[1], "-h") == 0 || strcmp(argv[1], "--help") == 0)) {
        print_usage(argv[0]);
        return 0;
    }

    if (argc < 3) {
        print_usage(argv[0]);
        return 1;
    }

    const char *input_path = argv[1];
    const char *output_path = argv[2];

    /* 1. Decode input audio file */
    ma_decoder decoder;
    ma_decoder_config decoder_config = ma_decoder_config_init(ma_format_f32, 0, 0);
    ma_result result = ma_decoder_init_file(input_path, &decoder_config, &decoder);
    if (result != MA_SUCCESS) {
        fprintf(stderr, "Error: Failed to open/decode input file: %s (error code %d)\n", input_path, result);
        return 2;
    }

    ma_uint32 in_channels = decoder.outputChannels;
    ma_uint32 in_sample_rate = decoder.outputSampleRate;

    if (in_channels < 1 || in_channels > 2) {
        fprintf(stderr, "Error: Unsupported channel count: %u (only mono and stereo supported)\n", in_channels);
        ma_decoder_uninit(&decoder);
        return 3;
    }

    /* Read all frames */
    ma_uint64 total_in_frames = 0;
    ma_result length_res = ma_decoder_get_length_in_pcm_frames(&decoder, &total_in_frames);
    if (length_res != MA_SUCCESS || total_in_frames == 0) {
        /* If length not known, read in chunks */
        total_in_frames = 0;
    }

    /* Allocate buffer for input audio in float32 */
    ma_uint64 capacity_frames = total_in_frames > 0 ? total_in_frames : 48000 * 60;
    float *in_pcm = (float *)malloc(capacity_frames * in_channels * sizeof(float));
    if (!in_pcm) {
        fprintf(stderr, "Error: Failed to allocate memory for input audio\n");
        ma_decoder_uninit(&decoder);
        return 4;
    }

    ma_uint64 frames_read_total = 0;
    while (1) {
        ma_uint64 frames_to_read = 4096;
        if (frames_read_total + frames_to_read > capacity_frames) {
            capacity_frames = (capacity_frames * 3) / 2 + frames_to_read;
            float *new_buf = (float *)realloc(in_pcm, capacity_frames * in_channels * sizeof(float));
            if (!new_buf) {
                fprintf(stderr, "Error: Out of memory reading audio\n");
                free(in_pcm);
                ma_decoder_uninit(&decoder);
                return 4;
            }
            in_pcm = new_buf;
        }
        ma_uint64 frames_read = 0;
        result = ma_decoder_read_pcm_frames(&decoder, in_pcm + (frames_read_total * in_channels), frames_to_read, &frames_read);
        frames_read_total += frames_read;
        if (frames_read == 0 || result != MA_SUCCESS) {
            break;
        }
    }
    ma_decoder_uninit(&decoder);

    if (frames_read_total == 0) {
        fprintf(stderr, "Error: Input audio file contains no usable audio frames\n");
        free(in_pcm);
        return 5;
    }

    fprintf(stderr, "[NoiseClean] Input: %s\n", input_path);
    fprintf(stderr, "[NoiseClean] Format: %u Hz, %s, %llu frames (%.2f s)\n",
            in_sample_rate, in_channels == 1 ? "Mono" : "Stereo",
            (unsigned long long)frames_read_total,
            (double)frames_read_total / (double)in_sample_rate);

    /* 2. Resample to 48kHz if required */
    float *proc_pcm = NULL;
    ma_uint64 proc_frames = 0;
    int needs_resample = (in_sample_rate != RNNOISE_SAMPLE_RATE);

    if (needs_resample) {
        fprintf(stderr, "[NoiseClean] Resampling input from %u Hz to 48000 Hz...\n", in_sample_rate);
        ma_resampler_config resamp_cfg = ma_resampler_config_init(
            ma_format_f32,
            in_channels,
            in_sample_rate,
            RNNOISE_SAMPLE_RATE,
            ma_resample_algorithm_linear
        );
        resamp_cfg.linear.lpfOrder = 4; /* Low-pass filter order for clean resampling */

        ma_resampler resampler;
        result = ma_resampler_init(&resamp_cfg, NULL, &resampler);
        if (result != MA_SUCCESS) {
            fprintf(stderr, "Error: Failed to initialize resampler (code %d)\n", result);
            free(in_pcm);
            return 6;
        }

        /* Estimate output frame count */
        ma_uint64 est_out_frames = (ma_uint64)ceil((double)frames_read_total * (double)RNNOISE_SAMPLE_RATE / (double)in_sample_rate) + 2048;
        proc_pcm = (float *)malloc(est_out_frames * in_channels * sizeof(float));
        if (!proc_pcm) {
            fprintf(stderr, "Error: Memory allocation failed for resampled audio\n");
            ma_resampler_uninit(&resampler, NULL);
            free(in_pcm);
            return 4;
        }

        ma_uint64 in_frames_processed = frames_read_total;
        proc_frames = est_out_frames;
        result = ma_resampler_process_pcm_frames(&resampler, in_pcm, &in_frames_processed, proc_pcm, &proc_frames);
        ma_resampler_uninit(&resampler, NULL);

        if (result != MA_SUCCESS) {
            fprintf(stderr, "Error: Resampling process failed (code %d)\n", result);
            free(in_pcm);
            free(proc_pcm);
            return 6;
        }
        fprintf(stderr, "[NoiseClean] Resampled to 48000 Hz: %llu frames\n", (unsigned long long)proc_frames);
    } else {
        proc_pcm = in_pcm;
        proc_frames = frames_read_total;
    }

    /* 3. Denoise with RNNoise */
    fprintf(stderr, "[NoiseClean] Processing with RNNoise engine...\n");
    float *denoised_pcm = (float *)malloc(proc_frames * in_channels * sizeof(float));
    if (!denoised_pcm) {
        fprintf(stderr, "Error: Out of memory allocating denoised buffer\n");
        if (needs_resample) free(proc_pcm);
        free(in_pcm);
        return 4;
    }

    if (in_channels == 1) {
        DenoiseState *st = rnnoise_create(NULL);
        if (!st) {
            fprintf(stderr, "Error: Failed to create RNNoise state\n");
            free(denoised_pcm);
            if (needs_resample) free(proc_pcm);
            free(in_pcm);
            return 7;
        }

        float in_frame[RNNOISE_FRAME_SIZE];
        float out_frame[RNNOISE_FRAME_SIZE];

        ma_uint64 offset = 0;
        while (offset < proc_frames) {
            ma_uint64 chunk = proc_frames - offset;
            if (chunk > RNNOISE_FRAME_SIZE) chunk = RNNOISE_FRAME_SIZE;

            for (ma_uint64 i = 0; i < chunk; i++) {
                in_frame[i] = proc_pcm[offset + i] * 32768.0f;
            }
            for (ma_uint64 i = chunk; i < RNNOISE_FRAME_SIZE; i++) {
                in_frame[i] = 0.0f;
            }

            rnnoise_process_frame(st, out_frame, in_frame);

            for (ma_uint64 i = 0; i < chunk; i++) {
                float s = out_frame[i] / 32768.0f;
                if (s > 1.0f) s = 1.0f;
                if (s < -1.0f) s = -1.0f;
                denoised_pcm[offset + i] = s;
            }

            offset += chunk;
        }
        rnnoise_destroy(st);
    } else if (in_channels == 2) {
        /* Stereo: Dual DenoiseState */
        DenoiseState *st_left = rnnoise_create(NULL);
        DenoiseState *st_right = rnnoise_create(NULL);
        if (!st_left || !st_right) {
            fprintf(stderr, "Error: Failed to create RNNoise stereo states\n");
            if (st_left) rnnoise_destroy(st_left);
            if (st_right) rnnoise_destroy(st_right);
            free(denoised_pcm);
            if (needs_resample) free(proc_pcm);
            free(in_pcm);
            return 7;
        }

        float in_l[RNNOISE_FRAME_SIZE], in_r[RNNOISE_FRAME_SIZE];
        float out_l[RNNOISE_FRAME_SIZE], out_r[RNNOISE_FRAME_SIZE];

        ma_uint64 offset = 0;
        while (offset < proc_frames) {
            ma_uint64 chunk = proc_frames - offset;
            if (chunk > RNNOISE_FRAME_SIZE) chunk = RNNOISE_FRAME_SIZE;

            for (ma_uint64 i = 0; i < chunk; i++) {
                in_l[i] = proc_pcm[(offset + i) * 2 + 0] * 32768.0f;
                in_r[i] = proc_pcm[(offset + i) * 2 + 1] * 32768.0f;
            }
            for (ma_uint64 i = chunk; i < RNNOISE_FRAME_SIZE; i++) {
                in_l[i] = 0.0f;
                in_r[i] = 0.0f;
            }

            rnnoise_process_frame(st_left, out_l, in_l);
            rnnoise_process_frame(st_right, out_r, in_r);

            for (ma_uint64 i = 0; i < chunk; i++) {
                float sl = out_l[i] / 32768.0f;
                float sr = out_r[i] / 32768.0f;
                if (sl > 1.0f) sl = 1.0f;
                if (sl < -1.0f) sl = -1.0f;
                if (sr > 1.0f) sr = 1.0f;
                if (sr < -1.0f) sr = -1.0f;
                denoised_pcm[(offset + i) * 2 + 0] = sl;
                denoised_pcm[(offset + i) * 2 + 1] = sr;
            }

            offset += chunk;
        }
        rnnoise_destroy(st_left);
        rnnoise_destroy(st_right);
    }

    if (needs_resample) {
        free(proc_pcm);
    }

    /* 4. Resample back to original sample rate if needed to preserve exact sync */
    float *final_pcm = NULL;
    ma_uint64 final_frames = 0;

    if (needs_resample) {
        fprintf(stderr, "[NoiseClean] Resampling output back to original %u Hz...\n", in_sample_rate);
        ma_resampler_config resamp_cfg = ma_resampler_config_init(
            ma_format_f32,
            in_channels,
            RNNOISE_SAMPLE_RATE,
            in_sample_rate,
            ma_resample_algorithm_linear
        );
        resamp_cfg.linear.lpfOrder = 4;

        ma_resampler resampler;
        result = ma_resampler_init(&resamp_cfg, NULL, &resampler);
        if (result != MA_SUCCESS) {
            fprintf(stderr, "Error: Failed to init output resampler\n");
            free(denoised_pcm);
            free(in_pcm);
            return 6;
        }

        ma_uint64 est_back_frames = (ma_uint64)ceil((double)proc_frames * (double)in_sample_rate / (double)RNNOISE_SAMPLE_RATE) + 2048;
        final_pcm = (float *)malloc(est_back_frames * in_channels * sizeof(float));
        if (!final_pcm) {
            fprintf(stderr, "Error: Memory allocation failed for output resample\n");
            ma_resampler_uninit(&resampler, NULL);
            free(denoised_pcm);
            free(in_pcm);
            return 4;
        }

        ma_uint64 in_frames_p = proc_frames;
        final_frames = est_back_frames;
        result = ma_resampler_process_pcm_frames(&resampler, denoised_pcm, &in_frames_p, final_pcm, &final_frames);
        ma_resampler_uninit(&resampler, NULL);
        free(denoised_pcm);

        if (result != MA_SUCCESS) {
            fprintf(stderr, "Error: Back-resampling failed\n");
            free(final_pcm);
            free(in_pcm);
            return 6;
        }

        /* Enforce exact frame count matching original input to preserve sample-accurate sync */
        if (final_frames > frames_read_total) {
            final_frames = frames_read_total;
        }
    } else {
        final_pcm = denoised_pcm;
        final_frames = frames_read_total;
    }

    free(in_pcm);

    /* 5. Encode output WAV file */
    fprintf(stderr, "[NoiseClean] Writing cleaned audio to %s...\n", output_path);
    ma_encoder_config encoder_config = ma_encoder_config_init(
        ma_encoding_format_wav,
        ma_format_s16, /* 16-bit PCM WAV for maximum Adobe AE compatibility */
        in_channels,
        in_sample_rate
    );

    ma_encoder encoder;
    result = ma_encoder_init_file(output_path, &encoder_config, &encoder);
    if (result != MA_SUCCESS) {
        fprintf(stderr, "Error: Failed to initialize output WAV encoder for %s (code %d)\n", output_path, result);
        free(final_pcm);
        return 8;
    }

    /* Convert float32 to int16 */
    ma_int16 *out_s16 = (ma_int16 *)malloc(final_frames * in_channels * sizeof(ma_int16));
    if (!out_s16) {
        fprintf(stderr, "Error: Out of memory allocating s16 output\n");
        ma_encoder_uninit(&encoder);
        free(final_pcm);
        return 4;
    }

    for (ma_uint64 i = 0; i < final_frames * in_channels; i++) {
        float s = final_pcm[i];
        if (s > 1.0f) s = 1.0f;
        if (s < -1.0f) s = -1.0f;
        out_s16[i] = (ma_int16)(s * 32767.0f);
    }

    ma_uint64 frames_written = 0;
    result = ma_encoder_write_pcm_frames(&encoder, out_s16, final_frames, &frames_written);
    ma_encoder_uninit(&encoder);
    free(out_s16);
    free(final_pcm);

    if (result != MA_SUCCESS || frames_written != final_frames) {
        fprintf(stderr, "Error: Failed to write all PCM frames to output (wrote %llu of %llu)\n",
                (unsigned long long)frames_written, (unsigned long long)final_frames);
        return 8;
    }

    fprintf(stderr, "[NoiseClean] Success! Output: %llu frames written (%.2f s)\n",
            (unsigned long long)frames_written, (double)frames_written / (double)in_sample_rate);
    return 0;
}
