/**
 * AudioPro Tool — Studio Console & Showcase Script
 * Architected & Developed by Md Mahadi
 * Features:
 * - Native After Effects Extension Console Simulation (Voice Isolation & Restoration Toggles)
 * - Real-Time A/B Audio Switcher (Instantly toggle Clean vs Raw Audio with zero pops)
 * - Live Dual Waveform & 16-Band Frequency Spectrum Visualizer
 * - Responsive Keyboard Shortcuts (Space: Play/Pause, 1 or A: Raw, 2 or B: Clean)
 * - FAQ Accordion
 * - Animated Metric Counters via ScrollTrigger (Opacity remains 100% visible)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Audio Elements
  const audioEnhanced = document.getElementById('audio-enhanced');
  const audioOriginal = document.getElementById('audio-original');

  // Interactive UI Controls
  const toggleIsolation = document.getElementById('ui-toggle-isolation');
  const toggleRestoration = document.getElementById('ui-toggle-restoration');
  const isoDesc = document.getElementById('ui-iso-desc');
  const restoDesc = document.getElementById('ui-resto-desc');

  // Studio Console A/B Switcher & Chips
  const btnModeRaw = document.getElementById('btn-mode-raw');
  const btnModeClean = document.getElementById('btn-mode-clean');
  const chipFast = document.getElementById('chip-fast');
  const chipSpectral = document.getElementById('chip-spectral');

  // Master Play Controls
  const playPauseBtn = document.getElementById('audio-play-pause-btn');
  const playIcon = document.getElementById('audio-play-icon');
  const pauseIcon = document.getElementById('audio-pause-icon');
  const playText = document.getElementById('ui-play-text');
  const statusPill = document.getElementById('ui-status-pill');
  const modeText = document.getElementById('ui-mode-text');
  const liveBars = document.getElementById('ui-live-bars');
  const btnHeroListen = document.getElementById('btn-hero-listen');

  // State
  let currentMode = 'clean'; // 'clean' or 'raw'
  let isPlaying = false;
  let audioCtx = null;
  let gainEnhanced = null;
  let gainOriginal = null;

  // Initialize Web Audio API on first user gesture
  function initAudioContext() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      if (audioEnhanced && audioOriginal) {
        const sourceEnhanced = audioCtx.createMediaElementSource(audioEnhanced);
        const sourceOriginal = audioCtx.createMediaElementSource(audioOriginal);

        gainEnhanced = audioCtx.createGain();
        gainOriginal = audioCtx.createGain();

        sourceEnhanced.connect(gainEnhanced);
        sourceOriginal.connect(gainOriginal);

        gainEnhanced.connect(audioCtx.destination);
        gainOriginal.connect(audioCtx.destination);
      }

      updateAudioRouting();
    } catch (e) {
      console.warn('Web Audio API initialized in fallback mode:', e);
    }
  }

  // Update audio routing smoothly with 20ms linear ramp
  function updateAudioRouting() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (gainEnhanced && gainOriginal) {
      const now = audioCtx.currentTime;
      if (currentMode === 'clean') {
        gainEnhanced.gain.cancelScheduledValues(now);
        gainEnhanced.gain.setValueAtTime(gainEnhanced.gain.value, now);
        gainEnhanced.gain.linearRampToValueAtTime(1.0, now + 0.02);

        gainOriginal.gain.cancelScheduledValues(now);
        gainOriginal.gain.setValueAtTime(gainOriginal.gain.value, now);
        gainOriginal.gain.linearRampToValueAtTime(0, now + 0.02);
      } else {
        gainOriginal.gain.cancelScheduledValues(now);
        gainOriginal.gain.setValueAtTime(gainOriginal.gain.value, now);
        gainOriginal.gain.linearRampToValueAtTime(1.0, now + 0.02);

        gainEnhanced.gain.cancelScheduledValues(now);
        gainEnhanced.gain.setValueAtTime(gainEnhanced.gain.value, now);
        gainEnhanced.gain.linearRampToValueAtTime(0, now + 0.02);
      }
    } else if (audioEnhanced && audioOriginal) {
      if (currentMode === 'clean') {
        audioEnhanced.muted = false;
        audioOriginal.muted = true;
      } else {
        audioOriginal.muted = false;
        audioEnhanced.muted = true;
      }
    }
  }

  // Switch Audio Mode (Clean vs Raw)
  function setAudioMode(mode) {
    currentMode = mode;
    const isClean = (mode === 'clean');

    // Update Switch Checkbox
    if (toggleIsolation && toggleIsolation.checked !== isClean) {
      toggleIsolation.checked = isClean;
    }

    // Update Dedicated A/B Buttons
    if (btnModeRaw && btnModeClean) {
      if (isClean) {
        btnModeClean.classList.add('active');
        btnModeRaw.classList.remove('active');
      } else {
        btnModeRaw.classList.add('active');
        btnModeClean.classList.remove('active');
      }
    }

    // Update UI Descriptions & Indicators
    if (isClean) {
      if (isoDesc) isoDesc.textContent = 'Active • Studio voice isolation • Real-time AI';
      if (statusPill) {
        statusPill.classList.remove('raw-mode');
        statusPill.classList.add('clean-mode');
      }
      if (modeText) modeText.textContent = 'AudioPro Clean (-52dB Noise Cut)';
    } else {
      if (isoDesc) isoDesc.textContent = 'Bypassed • Raw Camera Noise (HVAC Drone & Reverb)';
      if (statusPill) {
        statusPill.classList.remove('clean-mode');
        statusPill.classList.add('raw-mode');
      }
      if (modeText) modeText.textContent = 'Raw Camera Noise Audio';
    }

    updateAudioRouting();

    // Auto-start playback if currently paused on toggle click
    if (!isPlaying && audioEnhanced && audioOriginal) {
      startPlayback();
    }
  }

  // Play / Pause Synchronized Audio
  function toggleAudioPlay() {
    initAudioContext();
    if (!audioEnhanced || !audioOriginal) return;

    if (audioEnhanced.paused) {
      startPlayback();
    } else {
      pausePlayback();
    }
  }

  function startPlayback() {
    initAudioContext();
    if (!audioEnhanced || !audioOriginal) return;

    audioOriginal.currentTime = audioEnhanced.currentTime;
    Promise.all([audioEnhanced.play(), audioOriginal.play()]).then(() => {
      isPlaying = true;
      updatePlayControls(true);
    }).catch(err => {
      console.warn('Playback error:', err);
    });
  }

  function pausePlayback() {
    if (!audioEnhanced || !audioOriginal) return;
    audioEnhanced.pause();
    audioOriginal.pause();
    isPlaying = false;
    updatePlayControls(false);
  }

  function updatePlayControls(playing) {
    if (playIcon && pauseIcon) {
      if (playing) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
      } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
      }
    }
    if (playText) {
      playText.textContent = playing ? 'Pause Demo' : 'Listen Audio Demo';
    }
    if (liveBars) {
      if (playing) {
        liveBars.classList.add('animating');
      } else {
        liveBars.classList.remove('animating');
      }
    }
    const waveBars = document.querySelectorAll('.track-wave-bars');
    waveBars.forEach(wb => {
      if (playing) {
        wb.classList.add('animating');
      } else {
        wb.classList.remove('animating');
      }
    });
  }

  // Loop & Sync Handler
  if (audioEnhanced) {
    audioEnhanced.addEventListener('timeupdate', () => {
      if (audioOriginal && Math.abs(audioOriginal.currentTime - audioEnhanced.currentTime) > 0.04) {
        audioOriginal.currentTime = audioEnhanced.currentTime;
      }
    });

    audioEnhanced.addEventListener('ended', () => {
      audioEnhanced.currentTime = 0;
      if (audioOriginal) audioOriginal.currentTime = 0;
      startPlayback();
    });
  }

  // Listeners
  if (toggleIsolation) {
    toggleIsolation.addEventListener('change', () => {
      initAudioContext();
      setAudioMode(toggleIsolation.checked ? 'clean' : 'raw');
    });
  }

  if (toggleRestoration) {
    toggleRestoration.addEventListener('change', () => {
      initAudioContext();
      const isActive = toggleRestoration.checked;
      if (restoDesc) {
        restoDesc.textContent = isActive 
          ? 'Active • 48kHz Harmonic overtone reconstruction'
          : 'Broadcast clarity & harmonic reconstruction';
      }
    });
  }

  if (btnModeRaw) {
    btnModeRaw.addEventListener('click', () => {
      initAudioContext();
      setAudioMode('raw');
    });
  }

  if (btnModeClean) {
    btnModeClean.addEventListener('click', () => {
      initAudioContext();
      setAudioMode('clean');
    });
  }

  if (chipFast && chipSpectral) {
    chipFast.addEventListener('click', () => {
      chipFast.classList.add('active');
      chipSpectral.classList.remove('active');
    });
    chipSpectral.addEventListener('click', () => {
      chipSpectral.classList.add('active');
      chipFast.classList.remove('active');
    });
  }

  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', toggleAudioPlay);
  }

  if (btnHeroListen) {
    btnHeroListen.addEventListener('click', (e) => {
      e.preventDefault();
      initAudioContext();
      if (!isPlaying) {
        startPlayback();
      }
      const demo = document.getElementById('interactive-demo');
      if (demo) {
        demo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  // FAQ Accordion
  const faqItems = document.querySelectorAll('.cog-faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.cog-faq-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(i => i.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      toggleAudioPlay();
    } else if (e.key === 'a' || e.key === 'A' || e.key === '1') {
      initAudioContext();
      setAudioMode('raw');
    } else if (e.key === 'b' || e.key === 'B' || e.key === '2') {
      initAudioContext();
      setAudioMode('clean');
    }
  });

  // Animated Metric Counters (Only numbers animate, no card opacity hiding)
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    const counters = document.querySelectorAll('.counter');
    counters.forEach(counter => {
      const target = +counter.getAttribute('data-target');
      ScrollTrigger.create({
        trigger: counter,
        start: 'top 92%',
        onEnter: () => {
          gsap.to(counter, {
            innerText: target,
            duration: 1.0,
            snap: { innerText: 1 },
            ease: 'power2.out'
          });
        }
      });
    });
  }
});
