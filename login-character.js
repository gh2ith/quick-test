/**
 * ============================================================================
 * LOGIN CHARACTER ASSISTANT ENGINE (login-character.js)
 * ============================================================================
 * ROLE: Presentation-only interactive visual assistant ("Sam").
 * 
 * STRICT COMPLIANCE & PRIVACY RULES:
 * 1. PRESENTATION ONLY: Never reads, logs, stores, or transmits password values.
 * 2. ZERO AUTH TOUCH: Does not call auth functions, redirect, or replace submit handlers.
 * 3. ARIA & A11Y SAFE: Character SVG is aria-hidden="true" and pointer-events: none.
 * 4. DERIVED STATE: State is derived from live DOM focus and attributes, not event order.
 * ============================================================================
 */

(function () {
  'use strict';

  // 1. Element References (Read-only UI binding)
  const characterRoot = document.getElementById('loginCharacter');
  const speechBubble = document.getElementById('characterSpeech');
  const speechText = document.getElementById('speechText');
  const passwordInput = document.getElementById('loginPassword');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const emailInput = document.getElementById('loginEmail');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');

  // Vector Sub-parts
  const charHead = document.getElementById('charHead');
  const charBody = document.getElementById('charBody');
  const charLeftPupil = document.getElementById('charLeftPupilGroup');
  const charRightPupil = document.getElementById('charRightPupilGroup');
  const charEyesOpen = document.querySelectorAll('.char-eye-open');

  if (!characterRoot) return;

  // Media Query Checks
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)');

  // 2. Mouse Tracking Engine State
  let cachedCenterX = 0;
  let cachedCenterY = 0;
  let targetX = 0;
  let targetY = 0;
  let currentHeadX = 0;
  let currentHeadY = 0;
  let currentHeadRot = 0;
  let currentPupilX = 0;
  let currentPupilY = 0;
  let currentBodyX = 0;
  let rafId = null;
  let isRafRunning = false;

  // Timers & Observers
  let blinkTimer = null;
  let peekTimer = null;
  let errorTimer = null;
  let isPeekingActive = false;

  // ==========================================================================
  // CACHED METRICS & RESIZE OBSERVER
  // ==========================================================================
  function updateCachedCenter() {
    if (!characterRoot) return;
    const rect = characterRoot.getBoundingClientRect();
    cachedCenterX = rect.left + rect.width / 2;
    cachedCenterY = rect.top + rect.height * 0.45;
  }

  // Cache on resize & scroll without layout thrashing inside frame loop
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(updateCachedCenter);
    ro.observe(characterRoot);
  }
  window.addEventListener('resize', updateCachedCenter, { passive: true });
  window.addEventListener('scroll', updateCachedCenter, { passive: true });
  updateCachedCenter();

  // ==========================================================================
  // BLINKING ENGINE (Random 3–6s, ~120ms duration)
  // ==========================================================================
  function scheduleNextBlink() {
    clearTimeout(blinkTimer);
    if (prefersReducedMotion.matches) return;

    // Do not blink if currently in private state (eyes already shut)
    const currentState = characterRoot.getAttribute('data-state');
    if (currentState === 'private' || currentState === 'peek') return;

    const delay = Math.floor(Math.random() * 3000) + 3000; // 3000ms – 6000ms
    blinkTimer = setTimeout(() => {
      triggerBlink();
      scheduleNextBlink();
    }, delay);
  }

  function triggerBlink() {
    const currentState = characterRoot.getAttribute('data-state');
    if (currentState === 'private' || currentState === 'peek') return;

    charEyesOpen.forEach((eye) => eye.classList.add('char-eye-blink'));
    setTimeout(() => {
      charEyesOpen.forEach((eye) => eye.classList.remove('char-eye-blink'));
    }, 120);
  }

  // ==========================================================================
  // MOUSE TRACKING ENGINE (Lerp factor ≈ 0.12, clamped, stops when settled)
  // ==========================================================================
  function onPointerMove(e) {
    if (prefersReducedMotion.matches || coarsePointer.matches || document.hidden) return;

    targetX = e.clientX;
    targetY = e.clientY;

    if (!isRafRunning) {
      isRafRunning = true;
      rafId = requestAnimationFrame(tickLerp);
    }
  }

  function tickLerp() {
    if (document.hidden || prefersReducedMotion.matches || coarsePointer.matches) {
      isRafRunning = false;
      return;
    }

    const state = characterRoot.getAttribute('data-state');

    // Vector from cached center to cursor
    const vx = targetX - cachedCenterX;
    const vy = targetY - cachedCenterY;
    const maxRadius = Math.max(window.innerWidth, window.innerHeight) * 0.45 || 1;

    // Normalized & clamped with smooth distance falloff
    let normX = Math.max(-1, Math.min(1, vx / maxRadius));
    let normY = Math.max(-1, Math.min(1, vy / maxRadius));

    // Limits according to specification:
    // pupils ±5 SVG units, head ±3px and ±4° rotation, body ±1.5px
    let targetPupilX = normX * 5.0;
    let targetPupilY = normY * 4.0;
    let targetHeadX = normX * 3.0;
    let targetHeadY = normY * 2.5;
    let targetHeadRot = normX * 4.0;
    let targetBodyX = normX * 1.5;

    // When in private state:
    // Hands stay fixed; head/body react at ~35% amplitude and never turn toward form (x/rot <= 0)
    if (state === 'private') {
      const clampedAwayX = Math.min(0, normX); // Never turn right toward form
      targetHeadX = clampedAwayX * 3.0 * 0.35 - 2.0;
      targetHeadY = normY * 2.5 * 0.35;
      targetHeadRot = clampedAwayX * 4.0 * 0.35 - 2.5;
      targetBodyX = clampedAwayX * 1.5 * 0.35;
      targetPupilX = 0;
      targetPupilY = 0;
    } else if (state === 'peek') {
      // Peeking: glance directly at the password field (to the right)
      targetPupilX = 5.0;
      targetPupilY = 1.0;
      targetHeadX = 1.0;
      targetHeadRot = 1.5;
    }

    // Lerp smoothing (factor = 0.12)
    const lerpFactor = 0.12;
    currentHeadX += (targetHeadX - currentHeadX) * lerpFactor;
    currentHeadY += (targetHeadY - currentHeadY) * lerpFactor;
    currentHeadRot += (targetHeadRot - currentHeadRot) * lerpFactor;
    currentPupilX += (targetPupilX - currentPupilX) * lerpFactor;
    currentPupilY += (targetPupilY - currentPupilY) * lerpFactor;
    currentBodyX += (targetBodyX - currentBodyX) * lerpFactor;

    // Apply transforms
    if (charHead && state !== 'private') {
      charHead.style.transform = `translate(${currentHeadX.toFixed(2)}px, ${currentHeadY.toFixed(2)}px) rotate(${currentHeadRot.toFixed(2)}deg)`;
    }
    if (charBody) {
      charBody.style.transform = `translate(${currentBodyX.toFixed(2)}px, 0)`;
    }
    if (charLeftPupil && charRightPupil && state !== 'private') {
      charLeftPupil.style.transform = `translate(${currentPupilX.toFixed(2)}px, ${currentPupilY.toFixed(2)}px)`;
      charRightPupil.style.transform = `translate(${currentPupilX.toFixed(2)}px, ${currentPupilY.toFixed(2)}px)`;
    }

    // Settled check: stop loop when idle and deltas are negligible
    const delta = Math.abs(targetHeadX - currentHeadX) +
                  Math.abs(targetHeadY - currentHeadY) +
                  Math.abs(targetPupilX - currentPupilX);

    if (delta < 0.01) {
      isRafRunning = false;
      return;
    }

    rafId = requestAnimationFrame(tickLerp);
  }

  // ==========================================================================
  // STATE MANAGEMENT (Single data-state attribute drives CSS)
  // ==========================================================================
  function setCharacterState(state, customSpeech) {
    if (!characterRoot) return;

    characterRoot.setAttribute('data-state', state);

    if (speechText) {
      if (customSpeech) {
        speechText.textContent = customSpeech;
      } else {
        switch (state) {
          case 'idle':
          case 'blur':
            speechText.textContent = '🔒 "Your credentials are safe & confidential."';
            break;
          case 'tracking':
            speechText.textContent = '👀 "Searching corporate employee directory..."';
            break;
          case 'private':
            speechText.textContent = '🙈 "I\'m not looking! Your password is confidential."';
            break;
          case 'peek':
            speechText.textContent = '👀 "Just a peek! Make sure no one\'s looking."';
            break;
          case 'error':
            speechText.textContent = '⚠️ "Please verify highlighted credentials."';
            break;
        }
      }
    }

    if (state === 'idle' || state === 'tracking' || state === 'blur') {
      scheduleNextBlink();
    } else {
      clearTimeout(blinkTimer);
    }
  }

  // Password Group Detection (input or toggle button has focus)
  function isPasswordGroupFocused() {
    const active = document.activeElement;
    return active === passwordInput || active === togglePasswordBtn;
  }

  // Derive state strictly from active focus & input visibility
  function deriveCurrentState() {
    if (isPasswordGroupFocused()) {
      if (passwordInput && passwordInput.type === 'text') {
        if (!isPeekingActive) {
          triggerPeekSequence();
        }
        return 'peek';
      }
      isPeekingActive = false;
      return 'private';
    }

    isPeekingActive = false;
    if (document.activeElement === emailInput) {
      return 'tracking';
    }
    return 'idle';
  }

  function syncState() {
    const nextState = deriveCurrentState();
    if (nextState !== 'peek') {
      setCharacterState(nextState);
    }
  }

  // Peek sequence: peek for ~800ms, then head turns away & eyes cover again
  function triggerPeekSequence() {
    isPeekingActive = true;
    setCharacterState('peek', '👀 "Just a peek! Make sure no one\'s looking."');

    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => {
      // After 800ms, if still in password group and password still visible, return to covered private state
      if (isPasswordGroupFocused() && passwordInput && passwordInput.type === 'text') {
        setCharacterState('private', '🙈 "Keeping watch while you type."');
      }
    }, 800);
  }

  // ==========================================================================
  // EVENT LISTENERS & FOCUS DELEGATION
  // ==========================================================================

  // focusin / focusout handles tab, click, touch, and autofill seamlessly
  document.addEventListener('focusin', () => {
    syncState();
  });

  document.addEventListener('focusout', () => {
    // Delay slightly to evaluate if focus shifted within the password group (e.g. to toggle btn)
    setTimeout(() => {
      syncState();
    }, 40);
  });

  // Track password input type changes via MutationObserver without touching toggle logic
  if (passwordInput && window.MutationObserver) {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'type') {
          if (isPasswordGroupFocused()) {
            if (passwordInput.type === 'text') {
              triggerPeekSequence();
            } else {
              isPeekingActive = false;
              setCharacterState('private', '🙈 "Protected again! Safe and hidden."');
            }
          }
        }
      }
    });
    observer.observe(passwordInput, { attributes: true, attributeFilter: ['type'] });
  }

  // Observe existing error elements to trigger brief concerned head-shake on error
  function setupErrorObserver(errorEl) {
    if (!errorEl || !window.MutationObserver) return;
    const obs = new MutationObserver(() => {
      const isVisible = errorEl.style.display !== 'none' && errorEl.textContent.trim().length > 0;
      if (isVisible) {
        setCharacterState('error');
        clearTimeout(errorTimer);
        errorTimer = setTimeout(() => {
          syncState();
        }, 650);
      }
    });
    obs.observe(errorEl, { attributes: true, attributeFilter: ['style', 'class'], childList: true });
  }
  setupErrorObserver(emailError);
  setupErrorObserver(passwordError);

  // Passive PointerMove Listener
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  // VisibilityChange to pause RAF and save battery
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (isRafRunning) {
        cancelAnimationFrame(rafId);
        isRafRunning = false;
      }
      clearTimeout(blinkTimer);
    } else {
      updateCachedCenter();
      scheduleNextBlink();
    }
  });

  // Initial Sync (autofill, pre-focused field, pageshow/bfcache)
  window.addEventListener('pageshow', () => {
    updateCachedCenter();
    syncState();
    scheduleNextBlink();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateCachedCenter();
      syncState();
      scheduleNextBlink();
    });
  } else {
    updateCachedCenter();
    syncState();
    scheduleNextBlink();
  }

})();
