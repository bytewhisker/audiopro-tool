/**
 * AudioPro Tool — Interactive Video & Native Plugin UI Demo
 * Developed by Md Mahadi
 */

document.addEventListener('DOMContentLoaded', () => {
  // Media Elements
  const video = document.getElementById('demo-video');
  const audioEnhanced = document.getElementById('audio-enhanced');
  const audioOriginal = document.getElementById('audio-original');

  // Video Overlay
  const videoOverlay = document.getElementById('video-overlay');
  const btnVideoOverlay = document.getElementById('video-overlay-play-btn');

  // AudioPro Tool Panel Elements
  const toggleIsolation = document.getElementById('demo-isolation-toggle');
  const isolationBadge = document.getElementById('isolation-state-badge');
  const rowIsolation = document.getElementById('row-isolation');
  const isoDescText = document.getElementById('iso-desc-text');

  const toggleRestoration = document.getElementById('demo-restoration-toggle');
  const restorationBadge = document.getElementById('restoration-state-badge');
  const rowRestoration = document.getElementById('row-restoration');

  // Transport Controls
  const btnTransportPlay = document.getElementById('audio-play-pause-btn');
  const iconPlay = document.getElementById('transport-play-icon');
  const iconPause = document.getElementById('transport-pause-icon');
  const timelineTrack = document.getElementById('timeline-track');
  const timelineBar = document.getElementById('timeline-bar');
  const timeCurrent = document.getElementById('time-current');
  const timeTotal = document.getElementById('time-total');

  // Audio Graph State
  let audioCtx = null;
  let gainEnhanced = null;
  let gainOriginal = null;
  let isPlaying = false;
  let isClean = true;

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

      applyAudioRouting();
    } catch (e) {
      console.warn('Web Audio API initialized in fallback mode:', e);
    }
  }

  // Smooth linear audio crossfade
  function applyAudioRouting() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (gainEnhanced && gainOriginal) {
      const now = audioCtx.currentTime;
      if (isClean) {
        gainEnhanced.gain.cancelScheduledValues(now);
        gainEnhanced.gain.setValueAtTime(gainEnhanced.gain.value, now);
        gainEnhanced.gain.linearRampToValueAtTime(1.0, now + 0.02);

        gainOriginal.gain.cancelScheduledValues(now);
        gainOriginal.gain.setValueAtTime(gainOriginal.gain.value, now);
        gainOriginal.gain.linearRampToValueAtTime(0.0, now + 0.02);
      } else {
        gainOriginal.gain.cancelScheduledValues(now);
        gainOriginal.gain.setValueAtTime(gainOriginal.gain.value, now);
        gainOriginal.gain.linearRampToValueAtTime(1.0, now + 0.02);

        gainEnhanced.gain.cancelScheduledValues(now);
        gainEnhanced.gain.setValueAtTime(gainEnhanced.gain.value, now);
        gainEnhanced.gain.linearRampToValueAtTime(0.0, now + 0.02);
      }
    } else if (audioEnhanced && audioOriginal) {
      audioEnhanced.muted = !isClean;
      audioOriginal.muted = isClean;
    }
  }

  // Update UI for Voice Isolation Toggle
  function updateIsolationUI(active) {
    isClean = active;
    if (toggleIsolation) toggleIsolation.checked = active;

    if (isolationBadge) {
      isolationBadge.textContent = active ? 'ON' : 'OFF';
      if (active) {
        isolationBadge.classList.remove('is-off');
      } else {
        isolationBadge.classList.add('is-off');
      }
    }

    if (rowIsolation) {
      if (active) {
        rowIsolation.classList.add('active');
      } else {
        rowIsolation.classList.remove('active');
      }
    }

    if (isoDescText) {
      isoDescText.textContent = active 
        ? 'Studio background noise & echo removal' 
        : 'Bypassed • Raw uncleaned camera audio';
    }

    applyAudioRouting();

    // If media is paused when user clicks switch, start playback automatically so they hear the difference immediately
    if (!isPlaying) {
      startPlayback();
    }
  }

  // Playback Control
  function startPlayback() {
    initAudioContext();

    if (video) {
      if (audioEnhanced) audioEnhanced.currentTime = video.currentTime;
      if (audioOriginal) audioOriginal.currentTime = video.currentTime;

      Promise.all([
        video.play().catch(() => {}),
        audioEnhanced ? audioEnhanced.play().catch(() => {}) : Promise.resolve(),
        audioOriginal ? audioOriginal.play().catch(() => {}) : Promise.resolve()
      ]).then(() => {
        isPlaying = true;
        updateTransportUI(true);
      });
    }
  }

  function pausePlayback() {
    if (video) video.pause();
    if (audioEnhanced) audioEnhanced.pause();
    if (audioOriginal) audioOriginal.pause();
    isPlaying = false;
    updateTransportUI(false);
  }

  function togglePlayback() {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }

  function updateTransportUI(playing) {
    if (iconPlay && iconPause) {
      if (playing) {
        iconPlay.classList.add('hidden');
        iconPause.classList.remove('hidden');
      } else {
        iconPlay.classList.remove('hidden');
        iconPause.classList.add('hidden');
      }
    }

    if (videoOverlay) {
      if (playing) {
        videoOverlay.classList.add('is-hidden');
      } else {
        videoOverlay.classList.remove('is-hidden');
      }
    }
  }

  function formatTime(seconds) {
    const s = Math.floor(seconds || 0);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Timeupdate Synchronization
  if (video) {
    video.addEventListener('timeupdate', () => {
      const cur = video.currentTime;
      const dur = video.duration || 20;

      // Update progress bar
      if (timelineBar) {
        const pct = (cur / dur) * 100;
        timelineBar.style.width = `${pct}%`;
      }

      // Update time display
      if (timeCurrent) {
        timeCurrent.textContent = formatTime(cur);
      }
      if (timeTotal && dur) {
        timeTotal.textContent = formatTime(dur);
      }

      // Sync drift check with audio
      if (audioEnhanced && Math.abs(audioEnhanced.currentTime - cur) > 0.08) {
        audioEnhanced.currentTime = cur;
      }
      if (audioOriginal && Math.abs(audioOriginal.currentTime - cur) > 0.08) {
        audioOriginal.currentTime = cur;
      }
    });

    video.addEventListener('loadedmetadata', () => {
      if (timeTotal && video.duration) {
        timeTotal.textContent = formatTime(video.duration);
      }
    });

    video.addEventListener('ended', () => {
      video.currentTime = 0;
      if (audioEnhanced) audioEnhanced.currentTime = 0;
      if (audioOriginal) audioOriginal.currentTime = 0;
      startPlayback();
    });

    // Clicking the video toggles play/pause
    video.addEventListener('click', togglePlayback);
  }

  // Overlay Big Play Button
  if (btnVideoOverlay) {
    btnVideoOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlayback();
    });
  }

  // Transport Play/Pause Button
  if (btnTransportPlay) {
    btnTransportPlay.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlayback();
    });
  }

  // Timeline Scrubber Click & Touch Scrub
  function handleTimelineSeek(clientX) {
    if (!video || !timelineTrack) return;
    const rect = timelineTrack.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = clickRatio * (video.duration || 20);

    video.currentTime = targetTime;
    if (audioEnhanced) audioEnhanced.currentTime = targetTime;
    if (audioOriginal) audioOriginal.currentTime = targetTime;

    if (timelineBar) {
      timelineBar.style.width = `${clickRatio * 100}%`;
    }
    if (timeCurrent) {
      timeCurrent.textContent = formatTime(targetTime);
    }

    if (!isPlaying) {
      startPlayback();
    }
  }

  if (timelineTrack && video) {
    timelineTrack.addEventListener('click', (e) => {
      handleTimelineSeek(e.clientX);
    });

    let isTouchSeeking = false;
    timelineTrack.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length > 0) {
        isTouchSeeking = true;
        handleTimelineSeek(e.touches[0].clientX);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (isTouchSeeking && e.touches && e.touches.length > 0) {
        handleTimelineSeek(e.touches[0].clientX);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      isTouchSeeking = false;
    }, { passive: true });
  }

  // Isolation Toggle Event
  if (toggleIsolation) {
    toggleIsolation.addEventListener('change', () => {
      initAudioContext();
      updateIsolationUI(toggleIsolation.checked);
    });
  }

  // Restoration Toggle Event
  if (toggleRestoration) {
    toggleRestoration.addEventListener('change', () => {
      const active = toggleRestoration.checked;
      if (restorationBadge) {
        restorationBadge.textContent = active ? 'ON' : 'OFF';
        if (active) {
          restorationBadge.classList.remove('is-off');
        } else {
          restorationBadge.classList.add('is-off');
        }
      }
      if (rowRestoration) {
        if (active) {
          rowRestoration.classList.add('active');
        } else {
          rowRestoration.classList.remove('active');
        }
      }
    });
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

  // Mobile Navigation Drawer Controller
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNavDrawer = document.getElementById('mobile-nav-drawer');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link, .btn-mobile-cta');

  function openMobileMenu() {
    if (!mobileNavDrawer || !mobileMenuBtn) return;
    mobileMenuBtn.classList.add('is-active');
    mobileMenuBtn.setAttribute('aria-expanded', 'true');
    mobileNavDrawer.classList.add('is-open');
    mobileNavDrawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('menu-open');
  }

  function closeMobileMenu() {
    if (!mobileNavDrawer || !mobileMenuBtn) return;
    mobileMenuBtn.classList.remove('is-active');
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    mobileNavDrawer.classList.remove('is-open');
    mobileNavDrawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('menu-open');
  }

  function toggleMobileMenu() {
    if (mobileNavDrawer && mobileNavDrawer.classList.contains('is-open')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMobileMenu();
    });
  }

  // Close drawer when any mobile nav link or CTA is clicked
  mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMobileMenu();
    });
  });

  // Close mobile drawer on desktop window resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 860 && mobileNavDrawer && mobileNavDrawer.classList.contains('is-open')) {
      closeMobileMenu();
    }
  }, { passive: true });

  // Close drawer when tapping outside
  document.addEventListener('click', (e) => {
    if (mobileNavDrawer && mobileNavDrawer.classList.contains('is-open')) {
      if (!mobileNavDrawer.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        closeMobileMenu();
      }
    }
  });

  // Keyboard Shortcuts: Space (Play/Pause), 1 (Raw/OFF), 2 (Clean/ON), Escape (Close Menu)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Escape') {
      closeMobileMenu();
    } else if (e.code === 'Space') {
      e.preventDefault();
      togglePlayback();
    } else if (e.key === '1' || e.key === 'a' || e.key === 'A') {
      initAudioContext();
      updateIsolationUI(false);
    } else if (e.key === '2' || e.key === 'b' || e.key === 'B') {
      initAudioContext();
      updateIsolationUI(true);
    }
  });
});
