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
  let angle = 0;              // Current pendulum angle in degrees (capped at ±10°)
  let velocity = 0;           // Angular velocity in degrees/second (capped at ±30 deg/s)
  let tiltX = 0;              // 3D tilt X (pitch, ≤ 8°)
  let tiltY = 0;              // 3D tilt Y (roll, ≤ 8°)
  let targetTiltX = 0;
  let targetTiltY = 0;

  // Simulation Constants (k = 12, c = 2.0 so swing settles within ~3s)
  const springK = 12.0;       // Restoring spring constant
  const dampingC = 2.0;       // Damping constant
  const fixedDt = 1 / 60;     // Fixed timestep accumulator (seconds)

  // Dragging & Pointer State
  let isDragging = false;
  let isPointerOverPanel = false;
  let isFirstSample = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastPointerTime = performance.now();
  let smoothedVx = 0;         // Exponential moving average of velocity

  // Cached Geometries (Updated on resize/scroll via ResizeObserver)
  let cachedPivotX = 0;
  let cachedPivotY = 0;
  let cachedBadgeCenterX = 0;
  let cachedBadgeCenterY = 0;
  let cachedPanelCenterX = 0;
  let cachedPanelCenterY = 0;
  let cachedPanelHalfWidth = 1;
  let cachedPanelHalfHeight = 1;

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

    cachedPanelCenterX = panelRect.left + panelRect.width / 2;
    cachedPanelCenterY = panelRect.top + panelRect.height / 2;
    cachedPanelHalfWidth = panelRect.width / 2 || 1;
    cachedPanelHalfHeight = panelRect.height / 2 || 1;
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
      // k = 12, c = 2.0 so swing settles within ~3s
      const acceleration = -springK * angle - dampingC * velocity;
      velocity += acceleration * fixedDt;
      angle += velocity * fixedDt;

      // Cap |v| at 30 deg/s, cap |angle| at ±10°
      velocity = Math.max(-30, Math.min(30, velocity));
      angle = Math.max(-10, Math.min(10, angle));

      // Tilt lerped (factor ≈ 0.08) so it glides instead of jumping
      tiltX += (targetTiltX - tiltX) * 0.08;
      tiltY += (targetTiltY - tiltY) * 0.08;
    }

    // Apply 3D Transform to Badge Assembly
    if (!prefersReducedMotion.matches) {
      badgeAssembly.style.transform = `rotate(${angle.toFixed(2)}deg) rotateX(${(-tiltX).toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
      updateLanyardVisual(angle);
    }

    // Stop Condition: The rAF loop must stop once |angle| < 0.05° and |v| < 0.5 deg/s, and the pointer is idle
    const isPhysicsSettled = Math.abs(angle) < 0.05 && Math.abs(velocity) < 0.5;
    const isTiltSettled = Math.abs(targetTiltX - tiltX) < 0.05 && Math.abs(targetTiltY - tiltY) < 0.05;
    const isPointerIdle = (performance.now() - lastPointerTime) > 80;

    if (!isDragging && isPhysicsSettled && isTiltSettled && (!isPointerOverPanel || isPointerIdle)) {
      angle = 0;
      velocity = 0;
      tiltX = targetTiltX;
      tiltY = targetTiltY;
      if (!prefersReducedMotion.matches) {
        badgeAssembly.style.transform = (tiltX === 0 && tiltY === 0)
          ? 'rotate(0deg)'
          : `rotate(0deg) rotateX(${(-tiltX).toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
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
    // Initial drop impulse (capped at ±10° range)
    angle = -8.0;
    velocity = 15.0;
    startPhysicsLoop();
  }

  // ==========================================================================
  // POINTER INTERACTIONS (Tilt, Glare, Velocity Impulse, and Drag)
  // ==========================================================================
  function onPointerMove(e) {
    if (prefersReducedMotion.matches) return;
    if (e.pointerType === 'touch') return; // Fine pointer / mouse / pen only

    const rect = badgePanel.getBoundingClientRect();
    const isInside = (e.clientX >= rect.left && e.clientX <= rect.right &&
                      e.clientY >= rect.top && e.clientY <= rect.bottom);

    const nowTime = e.timeStamp || performance.now();

    // 1. Detect Entry into Panel (NO ENTRY KICK)
    if (isInside && !isPointerOverPanel) {
      isPointerOverPanel = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      lastPointerTime = nowTime;
      smoothedVx = 0;
      velocity = 0; // Zero velocity on entry
      isFirstSample = true; // Apply NO impulse from that first sample
      return;
    }

    // 2. Detect Leave from Panel (EASE TILT TO 0, ZERO VELOCITY)
    if (!isInside && isPointerOverPanel) {
      isPointerOverPanel = false;
      velocity = 0; // Zero velocity on leave
      targetTiltX = 0; // Tilt target eases back to 0
      targetTiltY = 0;
      smoothedVx = 0;
      startPhysicsLoop();
      return;
    }

    if (!isInside && !isDragging) {
      targetTiltX = 0;
      targetTiltY = 0;
      return;
    }

    // 3. Velocity Computation
    const dtMs = Math.max(8, nowTime - lastPointerTime); // dt clamped to >= 8ms
    const dtSec = dtMs / 1000;
    const rawVx = (e.clientX - lastPointerX) / dtSec;

    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    lastPointerTime = nowTime;

    if (isFirstSample) {
      isFirstSample = false;
      smoothedVx = 0;
      return; // Apply NO impulse from that first sample
    }

    // Smooth with an exponential moving average (0.2 new / 0.8 old)
    smoothedVx = 0.2 * rawVx + 0.8 * smoothedVx;

    // Clamp to ±800 px/s
    const clampedVx = Math.max(-800, Math.min(800, smoothedVx));

    // Dead zone: ignore |vx| < 40 px/s
    const effectiveVx = Math.abs(clampedVx) >= 40 ? clampedVx : 0;

    if (isDragging) {
      // Calculate angle from pivot to pointer (clamped ±25°)
      const dx = e.clientX - cachedPivotX;
      const dy = Math.max(20, e.clientY - cachedPivotY);
      const rawAngle = Math.atan2(dx, dy) * (180 / Math.PI);
      angle = Math.max(-25, Math.min(25, rawAngle));
      velocity = 0;
      startPhysicsLoop();
    } else if (isPointerOverPanel) {
      // Tilt (rotateX/rotateY ≤ 8°): cursor position relative to panel center, normalized to -1..1
      const normX = Math.max(-1, Math.min(1, (e.clientX - cachedPanelCenterX) / cachedPanelHalfWidth));
      const normY = Math.max(-1, Math.min(1, (e.clientY - cachedPanelCenterY) / cachedPanelHalfHeight));

      targetTiltY = normX * 8.0;
      targetTiltX = normY * 8.0;

      // Impulse: v += vx * 0.015, cap |v| at 30 deg/s
      if (effectiveVx !== 0) {
        velocity += effectiveVx * 0.015;
        velocity = Math.max(-30, Math.min(30, velocity));
      }

      // Glare highlight tracking
      const glareX = Math.max(10, Math.min(90, 50 + normX * 30));
      const glareY = Math.max(10, Math.min(90, 35 + normY * 25));
      badgeCard.style.setProperty('--glare-x', `${glareX}%`);
      badgeCard.style.setProperty('--glare-y', `${glareY}%`);

      startPhysicsLoop();
    } else {
      targetTiltX = 0;
      targetTiltY = 0;
    }
  }

  // Pointer Enter & Leave Listeners (No entry kick; zero velocity and ease tilt on leave)
  badgePanel.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    isPointerOverPanel = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    lastPointerTime = e.timeStamp || performance.now();
    smoothedVx = 0;
    velocity = 0; // Zero velocity on entry
    isFirstSample = true; // Apply NO impulse from that first sample
  });

  badgePanel.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    isPointerOverPanel = false;
    velocity = 0; // Zero velocity on leave
    targetTiltX = 0; // Tilt target eases back to 0
    targetTiltY = 0;
    smoothedVx = 0;
    startPhysicsLoop();
  });

  // Drag Listeners (Fine Pointer Only)
  badgeAssembly.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || prefersReducedMotion.matches || e.pointerType === 'touch') return; // Primary click only
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
    // Release impulse from drag velocity (capped at ±30 deg/s)
    const releaseImpulse = Math.max(-30, Math.min(30, smoothedVx * 0.035));
    velocity = releaseImpulse;
    startPhysicsLoop();
  });

  badgeAssembly.addEventListener('pointercancel', () => {
    isDragging = false;
    startPhysicsLoop();
  });

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
    emailInput.addEventListener('change', updateBadgeNameFromEmail);
  }

  // Fast-Fill Buttons Sync: re-sync from email field on next tick (setTimeout 0)
  const fastFillButtons = document.querySelectorAll('.quick-btn-pill');
  fastFillButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setTimeout(updateBadgeNameFromEmail, 0);
    });
  });

  // Delegated click fallback for fast-fill buttons
  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest && e.target.closest('.quick-btn-pill')) {
      setTimeout(updateBadgeNameFromEmail, 0);
    }
  });

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
