/**
 * AudioPro Tool — Clean SaaS Interactions & Live Audio Demo
 * Developed by Md Mahadi
 */

document.addEventListener('DOMContentLoaded', () => {
  // Audio Elements
  const audioEnhanced = document.getElementById('audio-enhanced');
  const audioOriginal = document.getElementById('audio-original');

  // A/B Tabs & Play Controls
  const btnModeRaw = document.getElementById('btn-mode-raw');
  const btnModeClean = document.getElementById('btn-mode-clean');
  const playPauseBtn = document.getElementById('audio-play-pause-btn');
  const playIcon = document.getElementById('audio-play-icon');
  const pauseIcon = document.getElementById('audio-pause-icon');
  const playText = document.getElementById('ui-play-text');
  const modeText = document.getElementById('ui-mode-text');
  const barsRaw = document.getElementById('bars-raw');
  const barsClean = document.getElementById('bars-clean');

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

  // Smooth 20ms linear ramp between stems
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

  // Switch A/B Mode
  function setAudioMode(mode) {
    currentMode = mode;
    const isClean = (mode === 'clean');

    if (btnModeRaw && btnModeClean) {
      if (isClean) {
        btnModeClean.classList.add('active');
        btnModeRaw.classList.remove('active');
      } else {
        btnModeRaw.classList.add('active');
        btnModeClean.classList.remove('active');
      }
    }

    if (modeText) {
      modeText.textContent = isClean 
        ? 'Mode: AudioPro Clean (Isolated Dialogue)' 
        : 'Mode: Raw Camera Audio (HVAC & Reverb)';
    }

    updateAudioRouting();

    if (!isPlaying && audioEnhanced && audioOriginal) {
      startPlayback();
    }
  }

  // Play / Pause
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
      playText.textContent = playing ? 'Pause Preview' : 'Listen Audio Preview';
    }
    if (barsRaw && barsClean) {
      if (playing) {
        barsRaw.classList.add('animating');
        barsClean.classList.add('animating');
      } else {
        barsRaw.classList.remove('animating');
        barsClean.classList.remove('animating');
      }
    }
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

  // Event Listeners
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

  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', toggleAudioPlay);
  }

  // FAQ Accordion (First item open by default)
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const trigger = item.querySelector('.faq-trigger');
    if (trigger) {
      trigger.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(i => i.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
  });

  // Keyboard Shortcuts (Space for Play/Pause, 1 or A for Raw, 2 or B for Clean)
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
});
