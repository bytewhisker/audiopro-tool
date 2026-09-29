/**
 * AudioPro Tool — Interactive Showcase Script
 * Features:
 * - Dual Synchronized Video A/B Audio Switcher (0ms instant crossfade)
 * - Real-Time Web Audio API Frequency Spectrum Visualizer
 * - Timeline Scrubber with Snap Marker (0:08)
 * - Keyboard Shortcuts (Space, A, B, S, M)
 * - FAQ Accordion & Smooth Navigation
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const videoEnhanced = document.getElementById('video-enhanced');
  const videoOriginal = document.getElementById('video-original');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const bigPlayBtn = document.getElementById('big-play-btn');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const muteBtn = document.getElementById('mute-btn');
  const timeDisplay = document.getElementById('time-display');
  const timelineBar = document.getElementById('timeline-bar');
  const timelineProgress = document.getElementById('timeline-progress');
  const snapJumpBtn = document.getElementById('snap-jump-btn');

  const abSwitchInput = document.getElementById('ab-switch-input');
  const btnModeRaw = document.getElementById('btn-mode-raw');
  const btnModeEnhanced = document.getElementById('btn-mode-enhanced');
  const badgeEnhanced = document.getElementById('badge-enhanced');
  const badgeOriginal = document.getElementById('badge-original');
  const visStatus = document.getElementById('vis-status');
  const canvas = document.getElementById('visualizer-canvas');
  const canvasCtx = canvas.getContext('2d');

  // State
  let currentMode = 'enhanced'; // 'enhanced' or 'raw'
  let isPlaying = false;
  let isMuted = false;
  let audioCtx = null;
  let analyser = null;
  let sourceEnhanced = null;
  let sourceOriginal = null;
  let gainEnhanced = null;
  let gainOriginal = null;
  let animFrameId = null;

  // Resize canvas display buffer
  function resizeCanvas() {
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Initialize Web Audio API on first user gesture
  function initAudioContext() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;

      // Connect video elements
      sourceEnhanced = audioCtx.createMediaElementSource(videoEnhanced);
      sourceOriginal = audioCtx.createMediaElementSource(videoOriginal);

      gainEnhanced = audioCtx.createGain();
      gainOriginal = audioCtx.createGain();

      sourceEnhanced.connect(gainEnhanced);
      sourceOriginal.connect(gainOriginal);

      // Connect gains to analyser and destination
      gainEnhanced.connect(analyser);
      gainOriginal.connect(analyser);
      analyser.connect(audioCtx.destination);

      updateAudioRouting();
      startVisualizer();
    } catch (e) {
      console.warn('Web Audio API initialized in fallback mode:', e);
      startFallbackVisualizer();
    }
  }

  // Update audio levels based on active mode
  function updateAudioRouting() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (gainEnhanced && gainOriginal) {
      const now = audioCtx.currentTime;
      if (currentMode === 'enhanced') {
        gainEnhanced.gain.cancelScheduledValues(now);
        gainEnhanced.gain.setValueAtTime(gainEnhanced.gain.value, now);
        gainEnhanced.gain.linearRampToValueAtTime(isMuted ? 0 : 1.0, now + 0.04);

        gainOriginal.gain.cancelScheduledValues(now);
        gainOriginal.gain.setValueAtTime(gainOriginal.gain.value, now);
        gainOriginal.gain.linearRampToValueAtTime(0, now + 0.04);
      } else {
        gainOriginal.gain.cancelScheduledValues(now);
        gainOriginal.gain.setValueAtTime(gainOriginal.gain.value, now);
        gainOriginal.gain.linearRampToValueAtTime(isMuted ? 0 : 1.0, now + 0.04);

        gainEnhanced.gain.cancelScheduledValues(now);
        gainEnhanced.gain.setValueAtTime(gainEnhanced.gain.value, now);
        gainEnhanced.gain.linearRampToValueAtTime(0, now + 0.04);
      }
    } else {
      // Direct media element fallback
      if (currentMode === 'enhanced') {
        videoEnhanced.muted = isMuted;
        videoOriginal.muted = true;
      } else {
        videoOriginal.muted = isMuted;
        videoEnhanced.muted = true;
      }
    }
  }

  // Switch Mode (A/B)
  function setMode(mode) {
    currentMode = mode;
    const isEnhanced = (mode === 'enhanced');

    abSwitchInput.checked = isEnhanced;

    if (isEnhanced) {
      btnModeEnhanced.classList.add('active');
      btnModeRaw.classList.remove('active');
      badgeEnhanced.classList.remove('hidden');
      badgeOriginal.classList.add('hidden');
      visStatus.textContent = 'MONITORING: AUDIOPRO ENHANCED (VOCALS ISOLATED)';
      visStatus.style.color = 'var(--accent-cyan)';
      videoOriginal.style.opacity = '0';
    } else {
      btnModeRaw.classList.add('active');
      btnModeEnhanced.classList.remove('active');
      badgeOriginal.classList.remove('hidden');
      badgeEnhanced.classList.add('hidden');
      visStatus.textContent = 'MONITORING: RAW CAMERA AUDIO (NOISY CAFE + REVERB)';
      visStatus.style.color = '#FB7185';
      videoOriginal.style.opacity = '1';
    }

    updateAudioRouting();
  }

  // Event Listeners for A/B buttons
  btnModeRaw.addEventListener('click', () => {
    initAudioContext();
    setMode('raw');
  });

  btnModeEnhanced.addEventListener('click', () => {
    initAudioContext();
    setMode('enhanced');
  });

  abSwitchInput.addEventListener('change', (e) => {
    initAudioContext();
    setMode(e.target.checked ? 'enhanced' : 'raw');
  });

  // Play / Pause Synchronized Videos
  function togglePlay() {
    initAudioContext();

    if (videoEnhanced.paused) {
      // Sync timestamps before starting
      videoOriginal.currentTime = videoEnhanced.currentTime;
      Promise.all([videoEnhanced.play(), videoOriginal.play()]).then(() => {
        isPlaying = true;
        updatePlayState();
      }).catch(err => {
        console.warn('Playback error:', err);
      });
    } else {
      videoEnhanced.pause();
      videoOriginal.pause();
      isPlaying = false;
      updatePlayState();
    }
  }

  function updatePlayState() {
    if (isPlaying) {
      playIcon.classList.add('hidden');
      pauseIcon.classList.remove('hidden');
      bigPlayBtn.classList.add('hidden');
    } else {
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
      bigPlayBtn.classList.remove('hidden');
    }
  }

  playPauseBtn.addEventListener('click', togglePlay);
  bigPlayBtn.addEventListener('click', togglePlay);
  videoEnhanced.addEventListener('click', togglePlay);

  // Time Updates and Continuous Synchronization Check
  videoEnhanced.addEventListener('timeupdate', () => {
    const cur = videoEnhanced.currentTime;
    const dur = videoEnhanced.duration || 20.0;

    // Keep secondary video tightly synced within 0.04s (1 frame)
    if (Math.abs(videoOriginal.currentTime - cur) > 0.04) {
      videoOriginal.currentTime = cur;
    }

    // Update progress bar
    const pct = (cur / dur) * 100;
    timelineProgress.style.width = `${pct}%`;

    // Format time
    timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
  });

  // When video loops or finishes
  videoEnhanced.addEventListener('ended', () => {
    videoEnhanced.currentTime = 0;
    videoOriginal.currentTime = 0;
    videoEnhanced.play();
    videoOriginal.play();
  });

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // Scrubber / Seek
  timelineBar.addEventListener('click', (e) => {
    initAudioContext();
    const rect = timelineBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const targetTime = pos * (videoEnhanced.duration || 20);

    videoEnhanced.currentTime = targetTime;
    videoOriginal.currentTime = targetTime;
  });

  // Snap Bookmark Jump (0:08)
  snapJumpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    initAudioContext();
    // Jump right before the snap moment at 0:07.5
    videoEnhanced.currentTime = 7.5;
    videoOriginal.currentTime = 7.5;
    if (videoEnhanced.paused) {
      videoEnhanced.play();
      videoOriginal.play();
      isPlaying = true;
      updatePlayState();
    }
  });

  // Mute / Unmute
  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    updateAudioRouting();
    muteBtn.style.opacity = isMuted ? '0.5' : '1';
  });

  // Real-Time Visualizer Animation
  function startVisualizer() {
    if (!analyser) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      animFrameId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      canvasCtx.clearRect(0, 0, width, height);

      const barCount = 36;
      const barWidth = (width / barCount) - 4;
      let x = 2;

      for (let i = 0; i < barCount; i++) {
        // Sample frequencies with emphasis on speech band
        const index = Math.floor(i * (bufferLength / barCount) * 0.75);
        const value = isPlaying ? dataArray[index] : 0;
        const barHeight = (value / 255) * height * 0.88;

        const isEnh = (currentMode === 'enhanced');

        // Dynamic gradients
        const gradient = canvasCtx.createLinearGradient(0, height, 0, height - barHeight);
        if (isEnh) {
          gradient.addColorStop(0, '#00F5D4');
          gradient.addColorStop(1, '#00B4D8');
        } else {
          gradient.addColorStop(0, '#F43F5E');
          gradient.addColorStop(1, '#FB7185');
        }

        canvasCtx.fillStyle = gradient;
        canvasCtx.beginPath();
        canvasCtx.roundRect(x, height - Math.max(barHeight, 3), barWidth, Math.max(barHeight, 3), [2, 2, 0, 0]);
        canvasCtx.fill();

        x += barWidth + 4;
      }
    }

    draw();
  }

  // Fallback visualizer if Web Audio is blocked
  function startFallbackVisualizer() {
    function drawFallback() {
      animFrameId = requestAnimationFrame(drawFallback);
      const width = canvas.width;
      const height = canvas.height;
      canvasCtx.clearRect(0, 0, width, height);

      const barCount = 36;
      const barWidth = (width / barCount) - 4;
      let x = 2;

      for (let i = 0; i < barCount; i++) {
        let barHeight = 4;
        if (isPlaying) {
          const factor = (currentMode === 'enhanced') ? 0.6 : 0.95;
          barHeight = (Math.sin(Date.now() / 150 + i * 0.5) * 0.5 + 0.5) * height * factor * 0.75;
        }

        canvasCtx.fillStyle = (currentMode === 'enhanced') ? '#00F5D4' : '#F43F5E';
        canvasCtx.fillRect(x, height - Math.max(barHeight, 3), barWidth, Math.max(barHeight, 3));
        x += barWidth + 4;
      }
    }
    drawFallback();
  }

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Avoid interfering if focus is in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'a' || e.key === 'A' || e.key === '1') {
      initAudioContext();
      setMode('raw');
    } else if (e.key === 'b' || e.key === 'B' || e.key === '2') {
      initAudioContext();
      setMode('enhanced');
    } else if (e.key === 's' || e.key === 'S') {
      snapJumpBtn.click();
    } else if (e.key === 'm' || e.key === 'M') {
      muteBtn.click();
    }
  });

  // FAQ Accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach(i => i.classList.remove('active'));
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // Auto-pause video when scrolled out of viewport
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting && isPlaying) {
        videoEnhanced.pause();
        videoOriginal.pause();
        isPlaying = false;
        updatePlayState();
      }
    });
  }, { threshold: 0.2 });

  observer.observe(document.getElementById('player-container'));
});
