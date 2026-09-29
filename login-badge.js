/**
 * ============================================================================
 * PHYSICS-BASED EMPLOYEE ID BADGE ENGINE (login-badge.js)
 * ============================================================================
 * ROLE: Presentation-only script for the hanging employee ID badge on a lanyard.
 * 
 * STRICT PRIVACY & SECURITY BOUNDARIES:
 * 1. ZERO AUTH TOUCH: Does not validate credentials, store sessions, or touch submit handlers.
 * 2. ZERO PASSWORD READ: Never reads, logs, mirrors, or transmits the password field value.
 * 3. DERIVED STATE: Flip state derived from active DOM focus on password group (input + toggle).
 * 4. ARIA SAFE: Badge and lanyard are aria-hidden="true" with pointer-events: none (except drag).
 * ============================================================================
 */

(function () {
  'use strict';

  // 1. Element References
  const badgePanel = document.querySelector('.lb-badge-panel');
  const badgeAssembly = document.getElementById('badgeAssembly');
  const badgeCard = document.getElementById('badgeCard');
  const badgeName = document.getElementById('badgeName');
  const badgeInitials = document.getElementById('badgeInitials');
  const lanyardLeftStrap = document.getElementById('lanyardLeftStrap');
  const lanyardRightStrap = document.getElementById('lanyardRightStrap');
  const lanyardClip = document.getElementById('lanyardClip');

  // Form Field References (Read-only UI binding)
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');

  if (!badgePanel || !badgeAssembly || !badgeCard) return;

  // Media Query Checks
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  // 2. Physics Simulation State
  let angle = 0;              // Current pendulum angle in degrees
  let velocity = 0;           // Angular velocity in degrees/second
  let tiltX = 0;              // 3D tilt X (pitch, ≤ 8°)
  let tiltY = 0;              // 3D tilt Y (roll, ≤ 8°)
  let targetTiltX = 0;
  let targetTiltY = 0;

  // Simulation Constants
  const springK = 12.0;       // Restoring spring constant
  const dampingC = 1.0;       // Damping constant
  const fixedDt = 1 / 60;     // Fixed timestep accumulator (seconds)

  // Dragging State
  let isDragging = false;
  let isPointerOverPanel = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastPointerTime = performance.now();
  let pointerVx = 0;

  // Cached Geometries (Updated on resize/scroll via ResizeObserver)
  let cachedPivotX = 0;
  let cachedPivotY = 0;
  let cachedBadgeCenterX = 0;
  let cachedBadgeCenterY = 0;

  // Animation Loop Flag
  let rafId = null;
  let isLoopActive = false;

  // ==========================================================================
  // CACHED GEOMETRY & RESIZE OBSERVER
  // ==========================================================================
  function updateCachedMetrics() {
    if (!badgeAssembly || !badgePanel) return;
    const panelRect = badgePanel.getBoundingClientRect();
    const assemblyRect = badgeAssembly.getBoundingClientRect();

    cachedPivotX = assemblyRect.left + assemblyRect.width / 2;
    cachedPivotY = assemblyRect.top;
    cachedBadgeCenterX = assemblyRect.left + assemblyRect.width / 2;
    cachedBadgeCenterY = assemblyRect.top + assemblyRect.height / 2;
  }

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(updateCachedMetrics);
    ro.observe(badgePanel);
    ro.observe(badgeAssembly);
  }
  window.addEventListener('resize', updateCachedMetrics, { passive: true });
  window.addEventListener('scroll', updateCachedMetrics, { passive: true });
  updateCachedMetrics();

  // ==========================================================================
  // LANYARD SVG PATH GENERATOR
  // ==========================================================================
  function updateLanyardVisual(currentAngle) {
    if (!lanyardLeftStrap || !lanyardRightStrap || !lanyardClip) return;

    // Anchor points at top center of panel (viewBox 0 0 400 130)
    const anchorCenterX = 200;
    const anchorY = 0;
    const leftAnchorX = anchorCenterX - 48;
    const rightAnchorX = anchorCenterX + 48;

    // Swivel clip displacement based on current angle
    const length = 98; // Length in SVG units
    const rad = (currentAngle * Math.PI) / 180;
    const clipX = anchorCenterX + length * Math.sin(rad);
    const clipY = length * Math.cos(rad);

    // Left and right curving strap paths with natural drape
    const midY = clipY * 0.52;
    const bendOffset = currentAngle * 0.35;

    const leftD = `M ${leftAnchorX} ${anchorY} Q ${anchorCenterX - 24 + bendOffset} ${midY} ${clipX - 4} ${clipY}`;
    const rightD = `M ${rightAnchorX} ${anchorY} Q ${anchorCenterX + 24 + bendOffset} ${midY} ${clipX + 4} ${clipY}`;

    lanyardLeftStrap.setAttribute('d', leftD);
    lanyardRightStrap.setAttribute('d', rightD);

    // Position swivel clip and ring
    lanyardClip.setAttribute('transform', `translate(${clipX.toFixed(1)}, ${clipY.toFixed(1)}) rotate(${currentAngle.toFixed(1)})`);
  }

  // ==========================================================================
  // PHYSICS SIMULATION LOOP (Fixed 1/60s Timestep, Damped Spring Pendulum)
  // ==========================================================================
  function tickPhysics() {
    if (document.hidden) {
      isLoopActive = false;
      return;
    }

    if (!isDragging) {
      // Damped harmonic pendulum equation: v += (-k*a - c*v) * dt; a += v * dt;
      const acceleration = -springK * angle - dampingC * velocity;
      velocity += acceleration * fixedDt;
      angle += velocity * fixedDt;

      // Smooth tilt lerp
      tiltX += (targetTiltX - tiltX) * 0.12;
      tiltY += (targetTiltY - tiltY) * 0.12;
    }

    // Apply 3D Transform to Badge Assembly
    if (!prefersReducedMotion.matches) {
      badgeAssembly.style.transform = `rotate(${angle.toFixed(2)}deg) rotateX(${(-tiltX).toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
      updateLanyardVisual(angle);
    }

    // Check Settled State: Stop RAF when idle to conserve resources
    const isSettled = Math.abs(angle) < 0.05 &&
                      Math.abs(velocity) < 0.05 &&
                      Math.abs(targetTiltX - tiltX) < 0.05 &&
                      Math.abs(targetTiltY - tiltY) < 0.05;

    if (!isDragging && isSettled) {
      angle = 0;
      velocity = 0;
      tiltX = 0;
      tiltY = 0;
      if (!prefersReducedMotion.matches) {
        badgeAssembly.style.transform = 'rotate(0deg)';
        updateLanyardVisual(0);
      }
      isLoopActive = false;
      return;
    }

    rafId = requestAnimationFrame(tickPhysics);
  }

  function startPhysicsLoop() {
    if (!isLoopActive) {
      isLoopActive = true;
      rafId = requestAnimationFrame(tickPhysics);
    }
  }

  // ==========================================================================
  // LOAD DROP-IN ANIMATION (~900ms Damped Settle on Page Load)
  // ==========================================================================
  function triggerDropIn() {
    if (prefersReducedMotion.matches) {
      updateLanyardVisual(0);
      return;
    }
    // Initial drop impulse
    angle = -18.0;
    velocity = 22.0;
    startPhysicsLoop();
  }

  // ==========================================================================
  // POINTER INTERACTIONS (Tilt, Glare, Velocity Impulse, and Drag)
  // ==========================================================================
  function onPointerMove(e) {
    const now = performance.now();
    const dtSeconds = (now - lastPointerTime) / 1000;
    if (dtSeconds > 0.004) {
      pointerVx = (e.clientX - lastPointerX) / dtSeconds;
    }
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    lastPointerTime = now;

    if (prefersReducedMotion.matches || !finePointer.matches) return;

    // Check if pointer is within the left badge panel
    const rect = badgePanel.getBoundingClientRect();
    isPointerOverPanel = (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom);

    if (isDragging) {
      // Calculate angle from pivot to pointer (clamped ±25°)
      const dx = e.clientX - cachedPivotX;
      const dy = Math.max(20, e.clientY - cachedPivotY);
      const rawAngle = Math.atan2(dx, dy) * (180 / Math.PI);
      angle = Math.max(-25, Math.min(25, rawAngle));
      velocity = 0;
      startPhysicsLoop();
    } else if (isPointerOverPanel) {
      // 3D Lean/Tilt towards cursor (clamped ≤ 8°)
      const deltaX = (e.clientX - cachedBadgeCenterX) / (rect.width / 2);
      const deltaY = (e.clientY - cachedBadgeCenterY) / (rect.height / 2);
      targetTiltY = Math.max(-8, Math.min(8, deltaX * 7.5));
      targetTiltX = Math.max(-8, Math.min(8, deltaY * 7.5));

      // Pointer velocity impulse: v += clamp(pointerVx, ±1500) * 0.03, capped at 60 deg/s
      if (Math.abs(pointerVx) > 120) {
        const clampedVx = Math.max(-1500, Math.min(1500, pointerVx));
        const impulse = clampedVx * 0.025;
        velocity = Math.max(-60, Math.min(60, velocity + impulse));
      }

      // Glare highlight tracking
      const glareX = Math.max(10, Math.min(90, 50 + deltaX * 28));
      const glareY = Math.max(10, Math.min(90, 35 + deltaY * 25));
      badgeCard.style.setProperty('--glare-x', `${glareX}%`);
      badgeCard.style.setProperty('--glare-y', `${glareY}%`);

      startPhysicsLoop();
    } else {
      targetTiltX = 0;
      targetTiltY = 0;
    }
  }

  // Drag Listeners (Fine Pointer Only)
  if (finePointer.matches) {
    badgeAssembly.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || prefersReducedMotion.matches) return; // Primary click only
      isDragging = true;
      try {
        badgeAssembly.setPointerCapture(e.pointerId);
      } catch (_) {}
      startPhysicsLoop();
    });

    badgeAssembly.addEventListener('pointerup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      try {
        badgeAssembly.releasePointerCapture(e.pointerId);
      } catch (_) {}
      // Release impulse from drag velocity
      const releaseImpulse = Math.max(-55, Math.min(55, pointerVx * 0.035));
      velocity = releaseImpulse;
      startPhysicsLoop();
    });

    badgeAssembly.addEventListener('pointercancel', () => {
      isDragging = false;
      startPhysicsLoop();
    });
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });

  // ==========================================================================
  // LIVE EMAIL NAME PREVIEW
  // Formats: "sara.khalid@x.com" → "Sara Khalid", max 22 chars, sets textContent
  // ==========================================================================
  function updateBadgeNameFromEmail() {
    if (!emailInput || !badgeName || !badgeInitials) return;

    const email = emailInput.value.trim();
    if (!email) {
      badgeName.textContent = 'Your name';
      badgeInitials.textContent = 'YN';
      return;
    }

    const localPart = email.split('@')[0] || '';
    if (!localPart) {
      badgeName.textContent = 'Your name';
      badgeInitials.textContent = 'YN';
      return;
    }

    // Split on . _ - +, drop digits, capitalize
    const tokens = localPart
      .split(/[._\-+]+/)
      .map((t) => t.replace(/\d+/g, '').trim())
      .filter((t) => t.length > 0);

    if (tokens.length === 0) {
      badgeName.textContent = 'Your name';
      badgeInitials.textContent = 'YN';
      return;
    }

    const capitalizedTokens = tokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
    let formattedName = capitalizedTokens.join(' ');

    // Max 22 characters with ellipsis
    if (formattedName.length > 22) {
      formattedName = formattedName.slice(0, 21).trim() + '…';
    }

    // Generate Initials
    let initials = '';
    if (capitalizedTokens.length >= 2) {
      initials = capitalizedTokens[0][0] + capitalizedTokens[1][0];
    } else if (capitalizedTokens[0].length >= 1) {
      initials = capitalizedTokens[0].slice(0, 2).toUpperCase();
    } else {
      initials = 'YN';
    }

    badgeName.textContent = formattedName || 'Your name';
    badgeInitials.textContent = initials.toUpperCase() || 'YN';
  }

  if (emailInput) {
    emailInput.addEventListener('input', updateBadgeNameFromEmail);
  }

  // ==========================================================================
  // PASSWORD FOCUS & FLIP STATE MANAGEMENT
  // Uses focusin / focusout on password group (input + toggle button)
  // ==========================================================================
  function isPasswordGroupFocused() {
    const active = document.activeElement;
    return active === passwordInput || active === togglePasswordBtn;
  }

  function syncBadgeFlipState() {
    if (!badgeCard) return;

    const shouldFlip = isPasswordGroupFocused();
    const currentlyFlipped = badgeCard.classList.contains('is-flipped');

    if (shouldFlip && !currentlyFlipped) {
      // Flip to Back Face
      badgeCard.classList.add('is-flipped');
      // Subtle physical sway impulse on flip
      if (!prefersReducedMotion.matches) {
        velocity += 14.0;
        startPhysicsLoop();
      }
    } else if (!shouldFlip && currentlyFlipped) {
      // Flip back to Front Face
      badgeCard.classList.remove('is-flipped');
      if (!prefersReducedMotion.matches) {
        velocity -= 14.0;
        startPhysicsLoop();
      }
    }
  }

  document.addEventListener('focusin', () => {
    syncBadgeFlipState();
  });

  document.addEventListener('focusout', () => {
    // Delay slightly to check if focus shifted within the password group (e.g. to toggle btn)
    setTimeout(() => {
      syncBadgeFlipState();
    }, 40);
  });

  // ==========================================================================
  // SHOW / HIDE PASSWORD PADLOCK UNLATCH DETECTION
  // Detects type changes via MutationObserver without modifying auth code
  // ==========================================================================
  function syncPadlockState() {
    if (!passwordInput || !badgeCard) return;
    const isText = (passwordInput.type === 'text');
    if (isText) {
      badgeCard.classList.add('is-unlatched');
    } else {
      badgeCard.classList.remove('is-unlatched');
    }
  }

  if (passwordInput && window.MutationObserver) {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'type') {
          syncPadlockState();
        }
      }
    });
    observer.observe(passwordInput, { attributes: true, attributeFilter: ['type'] });
  }

  // ==========================================================================
  // ERROR SHAKE DETECTION
  // Observes visibility of emailError and passwordError without touching auth logic
  // ==========================================================================
  let errorShakeTimer = null;
  function triggerBadgeErrorShake() {
    if (prefersReducedMotion.matches || !badgeAssembly) return;

    badgeAssembly.classList.remove('has-error');
    void badgeAssembly.offsetWidth; // Force reflow
    badgeAssembly.classList.add('has-error');

    // Add physical impulse
    velocity = -28.0;
    startPhysicsLoop();

    clearTimeout(errorShakeTimer);
    errorShakeTimer = setTimeout(() => {
      badgeAssembly.classList.remove('has-error');
    }, 420);
  }

  function setupErrorObserver(errorEl) {
    if (!errorEl || !window.MutationObserver) return;
    const obs = new MutationObserver(() => {
      const isVisible = errorEl.style.display !== 'none' && errorEl.textContent.trim().length > 0;
      if (isVisible) {
        triggerBadgeErrorShake();
      }
    });
    obs.observe(errorEl, { attributes: true, attributeFilter: ['style', 'class'], childList: true });
  }
  setupErrorObserver(emailError);
  setupErrorObserver(passwordError);

  // ==========================================================================
  // LIFECYCLE, VISIBILITY & INITIALIZATION
  // ==========================================================================
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (isLoopActive) {
        cancelAnimationFrame(rafId);
        isLoopActive = false;
      }
    } else {
      updateCachedMetrics();
      startPhysicsLoop();
    }
  });

  window.addEventListener('pageshow', () => {
    updateCachedMetrics();
    updateBadgeNameFromEmail();
    syncBadgeFlipState();
    syncPadlockState();
    triggerDropIn();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateCachedMetrics();
      updateBadgeNameFromEmail();
      syncBadgeFlipState();
      syncPadlockState();
      triggerDropIn();
    });
  } else {
    updateCachedMetrics();
    updateBadgeNameFromEmail();
    syncBadgeFlipState();
    syncPadlockState();
    triggerDropIn();
  }

})();
