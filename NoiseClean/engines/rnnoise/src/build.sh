#!/usr/bin/env bash
# Build script for RNNoise standalone CLI for macOS (Universal arm64/x86_64) and Linux
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building RNNoise CLI..."

if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Detected macOS: Building Universal 2 binary (arm64 + x86_64)..."
    mkdir -p ../mac
    clang -O3 -arch arm64 -arch x86_64 \
        rnnoise_cli.c celt_lpc.c denoise.c kiss_fft.c pitch.c rnn.c rnn_data.c rnn_reader.c \
        -I. -lm -o ../mac/rnnoise
    chmod +x ../mac/rnnoise
    echo "Successfully built ../mac/rnnoise (Universal Binary)"
    file ../mac/rnnoise
else
    echo "Building for Linux / POSIX..."
    gcc -O3 \
        rnnoise_cli.c celt_lpc.c denoise.c kiss_fft.c pitch.c rnn.c rnn_data.c rnn_reader.c \
        -I. -lm -o rnnoise
    chmod +x rnnoise
    echo "Successfully built rnnoise"
fi
