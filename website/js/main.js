/**
 * AudioPro Tool — Minimalist Showcase Script with GSAP & ScrollTrigger
 * Features:
 * - Interactive After Effects Extension Simulator with GSAP Animations
 * - Dual Synchronized Audio A/B Crossfader (0ms instant click-free transition)
 * - Hardware Frequency Spectrum Monitor with live FFT Analyzer
 * - Responsive 65x Real-Time Neural Inference Simulation
 * - GSAP Scroll-Triggered Reveals & Animated Number Counters
 * - Mousemove Subtle Card Spotlight Sheen
 * - 2-Column FAQ Accordion
 * - Keyboard Shortcuts (Space, 1/A, 2/B, S, M)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Audio & Controls Elements
  const audioEnhanced = document.getElementById('audio-enhanced');
  const audioOriginal = document.getElementById('audio-original');
  const audioPlayPauseBtn = document.getElementById('audio-play-pause-btn');
  const audioPlayIcon = document.getElementById('audio-play-icon');
  const audioPauseIcon = document.getElementById('audio-pause-icon');
  const btnAudioRaw = document.getElementById('btn-audio-raw');
  const btnAudioClean = document.getElementById('btn-audio-clean');
  const audioTimelineBar = document.getElementById('audio-timeline-bar');
  const audioTimelineProgress = document.getElementById('audio-timeline-progress');
  const audioTimeDisplay = document.getElementById('audio-time-display');
  const audioSnapJumpBtn = document.getElementById('audio-snap-jump-btn');
  const audioMuteBtn = document.getElementById('audio-mute-btn');
  const canvas = document.getElementById('visualizer-canvas');
  const canvasCtx = canvas ? canvas.getContext('2d') : null;

  // Interactive After Effects Extension Widget Elements
  const toggleIsolation = document.getElementById('toggle-isolation');
  const badgeIsoStatus = document.getElementById('badge-iso-status');
  const descIsolation = document.getElementById('desc-isolation');
  const toggleRestoration = document.getElementById('toggle-restoration');
  const badgeRestoStatus = document.getElementById('badge-resto-status');
  const descRestoration = document.getElementById('desc-restoration');
  const procFillBar = document.getElementById('proc-fill-bar');
  const procStatusText = document.getElementById('proc-status-text');
  const btnReprocess = document.getElementById('btn-reprocess');

  // State
  let currentMode = 'clean'; // 'clean' or 'raw'
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
    if (!canvas) return;
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
      analyser.smoothingTimeConstant = 0.85;

      if (audioEnhanced && audioOriginal) {
        sourceEnhanced = audioCtx.createMediaElementSource(audioEnhanced);
        sourceOriginal = audioCtx.createMediaElementSource(audioOriginal);

        gainEnhanced = audioCtx.createGain();
        gainOriginal = audioCtx.createGain();

        sourceEnhanced.connect(gainEnhanced);
        sourceOriginal.connect(gainOriginal);

        gainEnhanced.connect(analyser);
        gainOriginal.connect(analyser);
        analyser.connect(audioCtx.destination);
      }

      updateAudioRouting();
      startVisualizer();
    } catch (e) {
      console.warn('Web Audio API initialized in fallback mode:', e);
      startFallbackVisualizer();
    }
  }

  // Update audio routing and levels
  function updateAudioRouting() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (gainEnhanced && gainOriginal) {
      const now = audioCtx.currentTime;
      if (currentMode === 'clean') {
        gainEnhanced.gain.cancelScheduledValues(now);
        gainEnhanced.gain.setValueAtTime(gainEnhanced.gain.value, now);
        gainEnhanced.gain.linearRampToValueAtTime(isMuted ? 0 : 1.0, now + 0.03);

        gainOriginal.gain.cancelScheduledValues(now);
        gainOriginal.gain.setValueAtTime(gainOriginal.gain.value, now);
        gainOriginal.gain.linearRampToValueAtTime(0, now + 0.03);
      } else {
        gainOriginal.gain.cancelScheduledValues(now);
        gainOriginal.gain.setValueAtTime(gainOriginal.gain.value, now);
        gainOriginal.gain.linearRampToValueAtTime(isMuted ? 0 : 1.0, now + 0.03);

        gainEnhanced.gain.cancelScheduledValues(now);
        gainEnhanced.gain.setValueAtTime(gainEnhanced.gain.value, now);
        gainEnhanced.gain.linearRampToValueAtTime(0, now + 0.03);
      }
    } else if (audioEnhanced && audioOriginal) {
      if (currentMode === 'clean') {
        audioEnhanced.muted = isMuted;
        audioOriginal.muted = true;
      } else {
        audioOriginal.muted = isMuted;
        audioEnhanced.muted = true;
      }
    }
  }

  // Switch Mode (Clean vs Raw)
  function setAudioMode(mode, fromToggle = false) {
    currentMode = mode;
    const isClean = (mode === 'clean');

    if (btnAudioClean && btnAudioRaw) {
      if (isClean) {
        btnAudioClean.classList.add('active');
        btnAudioRaw.classList.remove('active');
        btnAudioClean.setAttribute('aria-selected', 'true');
        btnAudioRaw.setAttribute('aria-selected', 'false');
      } else {
        btnAudioRaw.classList.add('active');
        btnAudioClean.classList.remove('active');
        btnAudioRaw.setAttribute('aria-selected', 'true');
        btnAudioClean.setAttribute('aria-selected', 'false');
      }
    }

    // Synchronize the AE Widget Toggle
    if (!fromToggle && toggleIsolation) {
      toggleIsolation.checked = isClean;
      updateWidgetStatus(isClean);
    }

    updateAudioRouting();
  }

  // Update AE Widget Status and trigger GSAP Speed Simulation
  function updateWidgetStatus(isClean) {
    if (badgeIsoStatus) {
      if (isClean) {
        badgeIsoStatus.textContent = 'ACTIVE';
        badgeIsoStatus.classList.add('active');
        if (descIsolation) descIsolation.textContent = 'Active • Studio voice isolation • merged_media_fixed.mp4';
      } else {
        badgeIsoStatus.textContent = 'BYPASS';
        badgeIsoStatus.classList.remove('active');
        if (descIsolation) descIsolation.textContent = 'Bypassed • Raw timeline audio pass-through';
      }
    }

    // Trigger high-speed 65x GSAP progress animation
    if (isClean && procFillBar && window.gsap) {
      if (procStatusText) {
        procStatusText.textContent = '⚡ RNNoise Recurrent Model (65x speed): Processing...';
      }
      gsap.fromTo(procFillBar, 
        { width: '0%' }, 
        { 
          width: '100%', 
          duration: 0.35, 
          ease: 'power2.out',
          onComplete: () => {
            if (procStatusText) {
              procStatusText.textContent = '⚡ RNNoise Recurrent Model (65x speed): Processed in 0.35s';
            }
          }
        }
      );
    } else if (!isClean && procFillBar) {
      procFillBar.style.width = '0%';
      if (procStatusText) {
        procStatusText.textContent = 'Audio processing bypassed (Raw camera audio active)';
      }
    }
  }

  // Toggle Isolation Switch Listener
  if (toggleIsolation) {
    toggleIsolation.addEventListener('change', () => {
      initAudioContext();
      setAudioMode(toggleIsolation.checked ? 'clean' : 'raw', true);
      updateWidgetStatus(toggleIsolation.checked);
    });
  }

  // Toggle Voice Restoration Switch Listener
  if (toggleRestoration) {
    toggleRestoration.addEventListener('change', () => {
      initAudioContext();
      const isActive = toggleRestoration.checked;
      if (badgeRestoStatus) {
        badgeRestoStatus.textContent = isActive ? 'ACTIVE' : 'STANDBY';
        if (isActive) {
          badgeRestoStatus.classList.add('active');
          if (descRestoration) descRestoration.textContent = 'Active • 48kHz Harmonic overtone reconstruction';
          if (window.gsap && procFillBar) {
            gsap.fromTo(procFillBar, { width: '0%' }, { width: '100%', duration: 0.45, ease: 'power2.out' });
            if (procStatusText) procStatusText.textContent = '✨ DeepFilterNet 3: Harmonic reconstruction completed in 0.45s';
          }
        } else {
          badgeRestoStatus.classList.remove('active');
          if (descRestoration) descRestoration.textContent = 'Broadcast clarity & harmonic reconstruction';
        }
      }
    });
  }

  // Re-process Button Listener
  if (btnReprocess) {
    btnReprocess.addEventListener('click', () => {
      initAudioContext();
      if (window.gsap && procFillBar) {
        if (procStatusText) procStatusText.textContent = '⚡ Recalculating neural weights (65x speed)...';
        gsap.fromTo(procFillBar, 
          { width: '0%' }, 
          { 
            width: '100%', 
            duration: 0.35, 
            ease: 'power2.out',
            onComplete: () => {
              if (procStatusText) procStatusText.textContent = '⚡ RNNoise Recurrent Model (65x speed): Processed in 0.35s';
            }
          }
        );
      }
    });
  }

  // Segment Buttons Listeners
  if (btnAudioRaw) {
    btnAudioRaw.addEventListener('click', () => {
      initAudioContext();
      setAudioMode('raw');
    });
  }

  if (btnAudioClean) {
    btnAudioClean.addEventListener('click', () => {
      initAudioContext();
      setAudioMode('clean');
    });
  }

  // Play / Pause Synchronized Audio
  function toggleAudioPlay() {
    initAudioContext();

    if (!audioEnhanced || !audioOriginal) return;

    if (audioEnhanced.paused) {
      audioOriginal.currentTime = audioEnhanced.currentTime;
      Promise.all([audioEnhanced.play(), audioOriginal.play()]).then(() => {
        isPlaying = true;
        updateAudioPlayState();
      }).catch(err => {
        console.warn('Playback error:', err);
      });
    } else {
      audioEnhanced.pause();
      audioOriginal.pause();
      isPlaying = false;
      updateAudioPlayState();
    }
  }

  function updateAudioPlayState() {
    if (!audioPlayIcon || !audioPauseIcon) return;
    if (isPlaying) {
      audioPlayIcon.classList.add('hidden');
      audioPauseIcon.classList.remove('hidden');
    } else {
      audioPlayIcon.classList.remove('hidden');
      audioPauseIcon.classList.add('hidden');
    }
  }

  if (audioPlayPauseBtn) {
    audioPlayPauseBtn.addEventListener('click', toggleAudioPlay);
  }

  // Time Updates and Continuous Synchronization
  if (audioEnhanced) {
    audioEnhanced.addEventListener('timeupdate', () => {
      const cur = audioEnhanced.currentTime;
      const dur = audioEnhanced.duration || 20.0;

      // Keep secondary audio tightly synced within 0.03s
      if (audioOriginal && Math.abs(audioOriginal.currentTime - cur) > 0.03) {
        audioOriginal.currentTime = cur;
      }

      // Update progress bar
      if (audioTimelineProgress) {
        const pct = (cur / dur) * 100;
        audioTimelineProgress.style.width = `${pct}%`;
      }

      // Format timecode
      if (audioTimeDisplay) {
        audioTimeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
      }
    });

    audioEnhanced.addEventListener('ended', () => {
      audioEnhanced.currentTime = 0;
      if (audioOriginal) audioOriginal.currentTime = 0;
      audioEnhanced.play();
      if (audioOriginal) audioOriginal.play();
    });
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // Scrubber / Seek
  if (audioTimelineBar && audioEnhanced) {
    audioTimelineBar.addEventListener('click', (e) => {
      initAudioContext();
      const rect = audioTimelineBar.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const targetTime = pos * (audioEnhanced.duration || 20);

      audioEnhanced.currentTime = targetTime;
      if (audioOriginal) audioOriginal.currentTime = targetTime;
    });
  }

  // Snap Bookmark Jump (0:08)
  if (audioSnapJumpBtn && audioEnhanced) {
    audioSnapJumpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      initAudioContext();
      audioEnhanced.currentTime = 7.5;
      if (audioOriginal) audioOriginal.currentTime = 7.5;
      if (audioEnhanced.paused) {
        audioEnhanced.play();
        if (audioOriginal) audioOriginal.play();
        isPlaying = true;
        updateAudioPlayState();
      }
    });
  }

  // Mute / Unmute
  if (audioMuteBtn) {
    audioMuteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      updateAudioRouting();
      audioMuteBtn.style.opacity = isMuted ? '0.45' : '1';
    });
  }

  // Real-Time Minimal Spectrum Visualizer
  function startVisualizer() {
    if (!analyser || !canvas || !canvasCtx) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      animFrameId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      canvasCtx.clearRect(0, 0, width, height);

      const barCount = 48;
      const barWidth = (width / barCount) - 2;
      let x = 1;

      for (let i = 0; i < barCount; i++) {
        const index = Math.floor(i * (bufferLength / barCount) * 0.75);
        const value = isPlaying ? dataArray[index] : 0;
        const barHeight = (value / 255) * height * 0.85;
        const isClean = (currentMode === 'clean');

        canvasCtx.fillStyle = isClean ? '#00F0FF' : '#FF3B30';
        canvasCtx.fillRect(x, height - Math.max(barHeight, 2), barWidth, Math.max(barHeight, 2));

        x += barWidth + 2;
      }
    }

    draw();
  }

  function startFallbackVisualizer() {
    if (!canvas || !canvasCtx) return;
    function drawFallback() {
      animFrameId = requestAnimationFrame(drawFallback);
      const width = canvas.width;
      const height = canvas.height;
      canvasCtx.clearRect(0, 0, width, height);

      const barCount = 48;
      const barWidth = (width / barCount) - 2;
      let x = 1;

      for (let i = 0; i < barCount; i++) {
        let barHeight = 2;
        if (isPlaying) {
          const factor = (currentMode === 'clean') ? 0.6 : 0.95;
          barHeight = (Math.sin(Date.now() / 160 + i * 0.4) * 0.5 + 0.5) * height * factor * 0.8;
        }

        canvasCtx.fillStyle = (currentMode === 'clean') ? '#00F0FF' : '#FF3B30';
        canvasCtx.fillRect(x, height - Math.max(barHeight, 2), barWidth, Math.max(barHeight, 2));
        x += barWidth + 2;
      }
    }
    drawFallback();
  }

  // Card Mouse Spotlight Sheen
  const cards = document.querySelectorAll('.sup-bento-card, .sup-pricing-card, .testimonial-card');
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const glow = card.querySelector('.card-inner-glow, .pricing-card-glow');
      if (glow) {
        glow.style.background = `radial-gradient(circle 180px at ${x}px ${y}px, rgba(255, 255, 255, 0.12) 0%, transparent 100%)`;
      }
    });

    card.addEventListener('mouseleave', () => {
      const glow = card.querySelector('.card-inner-glow, .pricing-card-glow');
      if (glow) {
        glow.style.background = '';
      }
    });
  });

  // 2-Column FAQ Accordion
  const faqItems = document.querySelectorAll('.sup-faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.sup-faq-btn');
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
    } else if (e.key === 's' || e.key === 'S') {
      if (audioSnapJumpBtn) audioSnapJumpBtn.click();
    } else if (e.key === 'm' || e.key === 'M') {
      if (audioMuteBtn) audioMuteBtn.click();
    }
  });

  // ==========================================================================
  // GSAP 3 & ScrollTrigger Animations
  // ==========================================================================
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // Hero Stagger Entrance
    gsap.from('.gs-hero-elem', {
      opacity: 0,
      y: 24,
      duration: 0.9,
      stagger: 0.12,
      ease: 'power3.out'
    });

    // Floating Cards Entrance
    gsap.from('.gs-float', {
      opacity: 0,
      scale: 0.92,
      duration: 1.1,
      stagger: 0.15,
      ease: 'power2.out',
      delay: 0.3
    });

    // Scroll Reveals
    gsap.utils.toArray('.gs-reveal').forEach(elem => {
      gsap.from(elem, {
        scrollTrigger: {
          trigger: elem,
          start: 'top 85%',
          toggleActions: 'play none none none'
        },
        opacity: 0,
        y: 28,
        duration: 0.8,
        ease: 'power2.out'
      });
    });

    // Bento & Pricing Cards Stagger
    ScrollTrigger.batch('.gs-card', {
      start: 'top 85%',
      onEnter: batch => gsap.from(batch, {
        opacity: 0,
        y: 30,
        stagger: 0.12,
        duration: 0.75,
        ease: 'power2.out',
        overwrite: true
      })
    });

    // Three Column Features Stagger
    ScrollTrigger.batch('.gs-col', {
      start: 'top 85%',
      onEnter: batch => gsap.from(batch, {
        opacity: 0,
        y: 25,
        stagger: 0.14,
        duration: 0.75,
        ease: 'power2.out',
        overwrite: true
      })
    });

    // Animated Metric Counters
    const counters = document.querySelectorAll('.counter');
    counters.forEach(counter => {
      const target = +counter.getAttribute('data-target');
      ScrollTrigger.create({
        trigger: counter,
        start: 'top 90%',
        onEnter: () => {
          gsap.to(counter, {
            innerText: target,
            duration: 1.8,
            snap: { innerText: 1 },
            ease: 'power2.out'
          });
        }
      });
    });
  }
});
