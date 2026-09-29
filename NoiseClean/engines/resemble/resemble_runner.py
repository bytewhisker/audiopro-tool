"""
NoiseClean - Resemble Enhance Standalone Python Inference Runner
Executes Resemble Enhance (latent CFM vocoder & bandwidth restoration)
Optimized for Windows, NVIDIA CUDA (RTX GPUs), and PyTorch.
Includes zero-dependency DeepSpeed runtime mock for Windows compatibility.
"""

import sys
import os
import json
import time
import argparse
import types
import pathlib
from pathlib import Path
from importlib.machinery import ModuleSpec

# Windows compatibility: OmegaConf yaml loader loads PosixPath from saved linux checkpoints
if hasattr(pathlib, 'WindowsPath'):
    pathlib.PosixPath = pathlib.WindowsPath

# NumPy 2.x / SciPy compatibility: resemble-enhance calls float(fsolve(...)) which fails on NumPy 2.x
try:
    import scipy.optimize
    _orig_fsolve = scipy.optimize.fsolve
    def _fsolve_compat(*args, **kwargs):
        res = _orig_fsolve(*args, **kwargs)
        if hasattr(res, '__len__') and len(res) == 1:
            return float(res[0])
        return res
    scipy.optimize.fsolve = _fsolve_compat
except Exception:
    pass

# ---------------------------------------------------------
# Windows DeepSpeed Mock
# resemble-enhance imports deepspeed in training modules.
# On Windows, deepspeed C++ extensions fail to compile.
# This mock intercepts all deepspeed imports and satisfies
# inference requirements with zero side effects.
# ---------------------------------------------------------
class MockModule(types.ModuleType):
    def __init__(self, name):
        super().__init__(name)
        self.__file__ = 'mock.py'
        self.__path__ = []

    def __getattr__(self, name):
        cls = type(name, (object,), {})
        setattr(self, name, cls)
        return cls

class MockLoader:
    def create_module(self, spec):
        return MockModule(spec.name)

    def exec_module(self, mod):
        pass

class MockFinder:
    def find_spec(self, fullname, path, target=None):
        if fullname == 'deepspeed' or fullname.startswith('deepspeed.'):
            return ModuleSpec(fullname, MockLoader())
        return None

sys.meta_path.insert(0, MockFinder())

# ---------------------------------------------------------
# Helper Functions & Environment Check
# ---------------------------------------------------------
def emit_json(data):
    """Outputs a single-line JSON message to stdout for Node.js IPC."""
    sys.stdout.write(json.dumps(data) + "\n")
    sys.stdout.flush()

def apply_broadcast_mastering(audio_tensor, sr, target_peak=0.707):
    """
    Applies Adobe-matched studio broadcast mastering curve and red-line ceiling protection:
    1. 70 Hz high-pass (Butterworth 2nd-order) cuts mic handling & sub-room rumble
    2. 15.5 kHz low-pass (Butterworth 2nd-order) eliminates synthetic vocoder fizz
    3. 450 Hz dip (-2.0 dB) clears boxy room resonance
    4. 5500 Hz de-harshing (-2.5 dB) smooths sibilance for buttery broadcast dialogue
    5. Capped strictly at target_peak (-3.0 dBTP / 0.707) to never exceed the red line in AE/Premiere.
    """
    import torch
    import numpy as np
    import scipy.signal as signal

    audio_np = audio_tensor.numpy()

    # 1. High-pass filter at 70 Hz
    sos_hp = signal.butter(2, 70.0, 'hp', fs=sr, output='sos')
    filtered = signal.sosfilt(sos_hp, audio_np, axis=-1)

    # 2. Low-pass filter at 15500 Hz
    sos_lp = signal.butter(2, 15500.0, 'lp', fs=sr, output='sos')
    filtered = signal.sosfilt(sos_lp, filtered, axis=-1)

    # 3. Parametric EQ: Room mud / boxiness cut at 450 Hz (-2.0 dB, Q=1.0)
    gain_db = -2.0
    A = 10.0 ** (gain_db / 40.0)
    omega = 2.0 * np.pi * 450.0 / sr
    alpha = np.sin(omega) / (2.0 * 1.0)
    b0 = 1.0 + alpha * A
    b1 = -2.0 * np.cos(omega)
    b2 = 1.0 - alpha * A
    a0 = 1.0 + alpha / A
    a1 = -2.0 * np.cos(omega)
    a2 = 1.0 - alpha / A
    filtered = signal.lfilter([b0/a0, b1/a0, b2/a0], [1.0, a1/a0, a2/a0], filtered, axis=-1)

    # 4. Parametric EQ: De-harshing / presence de-sibilance at 5500 Hz (-2.5 dB, Q=1.2)
    gain_db = -2.5
    A = 10.0 ** (gain_db / 40.0)
    omega = 2.0 * np.pi * 5500.0 / sr
    alpha = np.sin(omega) / (2.0 * 1.2)
    b0 = 1.0 + alpha * A
    b1 = -2.0 * np.cos(omega)
    b2 = 1.0 - alpha * A
    a0 = 1.0 + alpha / A
    a1 = -2.0 * np.cos(omega)
    a2 = 1.0 - alpha / A
    filtered = signal.lfilter([b0/a0, b1/a0, b2/a0], [1.0, a1/a0, a2/a0], filtered, axis=-1)

    # 5. Broadcast Red-Line Protection & Headroom Ceiling
    # Prevents timeline meters in After Effects and Premiere Pro from entering the red zone (> -3.0 dBTP).
    curr_peak = np.abs(filtered).max()
    if curr_peak > target_peak:
        filtered = filtered * (target_peak / curr_peak)
    elif curr_peak > 0.05 and curr_peak < 0.60:
        # Gentle lift for quiet dialogue up to standard broadcast range
        gain_lift = min(0.65 / curr_peak, 2.0)
        filtered = filtered * gain_lift

    final_peak = np.abs(filtered).max()
    if final_peak > target_peak:
        filtered = filtered * (target_peak / final_peak)

    return torch.from_numpy(filtered.astype(np.float32))

def find_model_dir():
    """Locate the enhancer_stage2 model directory."""
    # 1. Local workspace models directory
    script_dir = Path(__file__).resolve().parent
    candidates = [
        script_dir.parent.parent / "models" / "resemble_enhance" / "enhancer_stage2",
        Path.home() / ".cache" / "resemble_enhance" / "enhancer_stage2",
    ]
    # 2. Python site-packages model_repo
    try:
        import resemble_enhance
        pkg_dir = Path(resemble_enhance.__file__).resolve().parent
        candidates.append(pkg_dir / "model_repo" / "enhancer_stage2")
    except Exception:
        pass

    for cand in candidates:
        state_file = cand / "ds" / "G" / "default" / "mp_rank_00_model_states.pt"
        hparams_file = cand / "hparams.yaml"
        if cand.exists() and hparams_file.exists() and state_file.exists() and state_file.stat().st_size >= 700000000:
            return cand
    return None

def check_env():
    """Validates PyTorch, CUDA, resemble-enhance, and model availability."""
    info = {
        "ready": False,
        "hasTorch": False,
        "torchVersion": None,
        "hasCuda": False,
        "cudaVersion": None,
        "deviceName": None,
        "hasResemble": False,
        "hasModel": False,
        "modelPath": None,
        "error": None
    }

    try:
        import torch
        info["hasTorch"] = True
        info["torchVersion"] = torch.__version__
        info["hasCuda"] = torch.cuda.is_available()
        if info["hasCuda"]:
            info["cudaVersion"] = torch.version.cuda
            info["deviceName"] = torch.cuda.get_device_name(0)
    except Exception as e:
        info["error"] = f"Torch error: {str(e)}"
        emit_json(info)
        return

    try:
        import resemble_enhance
        info["hasResemble"] = True
    except Exception as e:
        info["error"] = f"Resemble Enhance not imported: {str(e)}"
        emit_json(info)
        return

    model_dir = find_model_dir()
    if model_dir:
        info["hasModel"] = True
        info["modelPath"] = str(model_dir)
        info["ready"] = True
    else:
        info["error"] = "Model weights not downloaded yet."

    emit_json(info)

def run_inference_low_memory(model, dwav, orig_sr, device, chunk_seconds=5.0, overlap_seconds=1.0, vad_threshold=0.012, vad_rms=0.002):
    import torch
    import torch.nn.functional as F
    from resemble_enhance.inference import inference_chunk, merge_chunks, remove_weight_norm_recursively
    from torchaudio.functional import resample

    remove_weight_norm_recursively(model)
    hp = model.hp

    # Resample to model native sample rate (44100 Hz)
    dwav = resample(
        dwav,
        orig_freq=orig_sr,
        new_freq=hp.wav_rate,
        lowpass_filter_width=64,
        rolloff=0.9475937167399596,
        resampling_method="sinc_interp_kaiser",
        beta=14.769656459379492,
    )
    sr = hp.wav_rate

    track_peak = dwav.abs().max().item()

    chunk_length = int(sr * chunk_seconds)
    overlap_length = int(sr * overlap_seconds)
    hop_length = chunk_length - overlap_length

    total_len = dwav.shape[-1]
    starts = list(range(0, total_len, hop_length))
    total_chunks = len(starts)

    chunks = []
    current_device = device

    for idx, start in enumerate(starts):
        sub_chunk = dwav[start : start + chunk_length]
        chunk_len = sub_chunk.shape[-1]
        chunk_peak = sub_chunk.abs().max().item()

        # Sliding window analysis: 100ms frames to detect active vocal/speech bursts
        frame_size = int(sr * 0.1)  # 100ms
        step_size = frame_size // 2
        if chunk_len >= frame_size:
            unfolded = sub_chunk.unfold(0, frame_size, step_size)
            frame_peaks = unfolded.abs().max(dim=-1).values
            max_frame_peak = frame_peaks.max().item()
            frame_rms = torch.sqrt(torch.mean(unfolded ** 2, dim=-1))
            max_frame_rms = frame_rms.max().item()
        else:
            max_frame_peak = chunk_peak
            max_frame_rms = torch.sqrt(torch.mean(sub_chunk ** 2)).item()

        # Silence / Empty Audio Gate:
        # Prevent normalizing background silence or room tone up to full scale,
        # which creates hallucinated bubbling/static. Only run neural synthesis
        # on chunks containing audible vocal/speech energy.
        has_speech = (max_frame_peak >= vad_threshold and max_frame_rms >= vad_rms)
        if track_peak > 0.04 and max_frame_peak < (0.04 * track_peak) and max_frame_peak < 0.025:
            has_speech = False

        if not has_speech:
            # Empty / silent audio chunk: bypass neural vocoder to preserve pristine silence
            gain = min(1.0, max(0.1, (max_frame_peak / 0.015) ** 1.5)) if max_frame_peak < 0.015 else 1.0
            chunk_out = (sub_chunk.cpu() * gain)
            chunks.append(chunk_out)

            pct = int(30 + ((idx + 1) / total_chunks) * 55)
            emit_json({
                "type": "progress",
                "percent": pct,
                "message": f"Restoring vocal clarity: {pct}% (chunk {idx + 1}/{total_chunks})..."
            })
            continue

        try:
            chunk_out = inference_chunk(model, sub_chunk, sr, current_device)
        except (torch.cuda.OutOfMemoryError, RuntimeError) as oom_err:
            if ("out of memory" in str(oom_err).lower() or "cuda" in str(oom_err).lower()) and current_device == "cuda":
                # VRAM pressure from host (After Effects): seamlessly switch to CPU
                torch.cuda.empty_cache()
                emit_json({
                    "type": "progress",
                    "percent": int(30 + (idx / total_chunks) * 55),
                    "message": "GPU memory tight, continuing seamlessly on CPU..."
                })
                model.to("cpu")
                current_device = "cpu"
                chunk_out = inference_chunk(model, sub_chunk, sr, "cpu")
            else:
                raise oom_err

        chunks.append(chunk_out)

        if current_device == "cuda":
            torch.cuda.empty_cache()

        pct = int(30 + ((idx + 1) / total_chunks) * 55)
        emit_json({
            "type": "progress",
            "percent": pct,
            "message": "Restoring vocal harmonics & studio clarity..."
        })

    hwav = merge_chunks(chunks, chunk_length, hop_length, sr=sr, length=total_len)

    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    return hwav, sr

# ---------------------------------------------------------
# Audio Processing Pipeline
# ---------------------------------------------------------
def process_audio(args):
    import torch
    import torchaudio

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        emit_json({"type": "error", "error": f"Input file not found: {input_path}"})
        sys.exit(1)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Free any leftover GPU memory before starting
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    # Determine device
    if args.device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    else:
        device = args.device

    emit_json({
        "type": "progress",
        "percent": 10,
        "message": "Initializing neural audio engine..."
    })

    model_dir = find_model_dir()
    if not model_dir and not args.run_dir:
        emit_json({"type": "error", "error": "Model weights file (mp_rank_00_model_states.pt) not found."})
        sys.exit(1)

    run_dir = Path(args.run_dir) if args.run_dir else model_dir

    t_start = time.time()

    # Load audio
    wav, sr = torchaudio.load(str(input_path))
    num_channels = wav.shape[0]
    total_frames = wav.shape[1]
    duration_sec = total_frames / sr

    emit_json({
        "type": "progress",
        "percent": 25,
        "message": "Analyzing dialogue frequency spectrum..."
    })

    # Resemble enhance expects 1D mono tensor (L,)
    if num_channels > 1:
        # Sum to center mono dialogue with energy balance
        e0 = wav[0].abs().mean().item()
        e1 = wav[1].abs().mean().item()
        if e1 < e0 * 0.05:
            mono_wav = wav[0]
        elif e0 < e1 * 0.05:
            mono_wav = wav[1]
        else:
            mono_wav = 0.5 * (wav[0] + wav[1])
    else:
        mono_wav = wav[0]

    emit_json({
        "type": "progress",
        "percent": 30,
        "message": "Reconstructing high-fidelity speech harmonics..."
    })

    from resemble_enhance.enhancer.inference import load_enhancer
    enhancer = load_enhancer(run_dir, device)

    if args.mode == "denoise":
        target_model = enhancer.denoiser
    else:
        enhancer.configurate_(nfe=args.nfe, solver=args.solver, lambd=args.lambd, tau=args.tau)
        target_model = enhancer

    chunk_sec = getattr(args, 'chunk_seconds', 5.0) or 5.0
    vad_thresh = getattr(args, 'vad_threshold', 0.012) or 0.012
    enhanced_wav, out_sr = run_inference_low_memory(
        model=target_model,
        dwav=mono_wav,
        orig_sr=sr,
        device=device,
        chunk_seconds=chunk_sec,
        vad_threshold=vad_thresh
    )

    emit_json({
        "type": "progress",
        "percent": 85,
        "message": "Finalizing high-frequency synthesis..."
    })

    # Resample to target output sample rate if requested (e.g. 48000 Hz for AE standard)
    if args.output_sr and args.output_sr != out_sr:
        enhanced_wav = torchaudio.functional.resample(
            enhanced_wav.unsqueeze(0),
            orig_freq=out_sr,
            new_freq=args.output_sr
        ).squeeze(0)
        out_sr = args.output_sr

    # Reconstruct original channel layout (duplicate mono to stereo if original was stereo)
    if num_channels > 1:
        out_tensor = torch.stack([enhanced_wav, enhanced_wav], dim=0).cpu()
    else:
        out_tensor = enhanced_wav.unsqueeze(0).cpu()

    emit_json({
        "type": "progress",
        "percent": 90,
        "message": "Applying studio broadcast mastering & red-line protection..."
    })

    # Apply Adobe-matched broadcast mastering & true-peak red-line safety ceiling (-3.0 dBTP)
    target_pk = getattr(args, 'target_peak', 0.707) or 0.707
    out_tensor = apply_broadcast_mastering(out_tensor, out_sr, target_peak=target_pk)

    emit_json({
        "type": "progress",
        "percent": 95,
        "message": "Writing restored master WAV..."
    })

    torchaudio.save(str(output_path), out_tensor, out_sr)

    elapsed_ms = int((time.time() - t_start) * 1000)
    rtf = (elapsed_ms / 1000.0) / duration_sec if duration_sec > 0 else 0

    emit_json({
        "type": "done",
        "success": True,
        "outputPath": str(output_path),
        "durationSec": duration_sec,
        "elapsedMs": elapsed_ms,
        "rtf": rtf,
        "sampleRate": out_sr,
        "channels": num_channels
    })

# ---------------------------------------------------------
# CLI Entrypoint
# ---------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="NoiseClean Voice Restoration Inference Runner")
    parser.add_argument("--check-env", action="store_true", help="Check Python/PyTorch/CUDA/Restoration environment")
    parser.add_argument("--input", type=str, help="Input WAV audio file")
    parser.add_argument("--output", type=str, help="Output destination WAV file")
    parser.add_argument("--mode", type=str, default="enhance", choices=["enhance", "denoise"], help="Inference mode")
    parser.add_argument("--device", type=str, default="auto", choices=["auto", "cuda", "cpu"], help="Inference device")
    parser.add_argument("--nfe", type=int, default=32, help="Number of function evaluations (steps)")
    parser.add_argument("--solver", type=str, default="midpoint", choices=["midpoint", "rk4", "euler"], help="ODE solver")
    parser.add_argument("--lambd", type=float, default=0.5, help="Denoising balance [0.0 - 1.0]")
    parser.add_argument("--tau", type=float, default=0.5, help="Prior temperature [0.0 - 1.0]")
    parser.add_argument("--output-sr", type=int, default=48000, help="Output sample rate (default 48000 for AE)")
    parser.add_argument("--run-dir", type=str, default=None, help="Explicit path to model directory")
    parser.add_argument("--chunk-seconds", type=float, default=5.0, help="Chunk length in seconds for memory safety (default 5.0)")
    parser.add_argument("--vad-threshold", type=float, default=0.012, help="Peak threshold for speech activity detection (default 0.012)")
    parser.add_argument("--target-peak", type=float, default=0.707, help="Maximum true-peak ceiling (default 0.707 / -3.0 dBTP to avoid red line)")

    args = parser.parse_args()

    if args.check_env:
        check_env()
        return

    if not args.input or not args.output:
        parser.print_help()
        sys.exit(1)

    try:
        process_audio(args)
    except Exception as e:
        emit_json({"type": "error", "error": str(e)})
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
