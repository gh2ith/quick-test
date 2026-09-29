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

  // ==========================================================================
  // CONFIGURATION BLOCK (Single Source of Truth for Tunables)
  // ==========================================================================
  const CONFIG = {
    idleSwayDeg: 0.8,
    idleSwayPeriodS: 6,
    tiltMaxDeg: 8,
    tiltLerp: 0.08,
    springK: 12,
    springC: 2.0,
    followK: 9,
    followC: 1.6,
    dragMaxDeg: 25,
    dropMs: 1000,
    parallaxPx: 6,
    floatPx: 4,
    floatPeriodS: 7,
    swingSign: -1
  };
  const SWING_SIGN = CONFIG.swingSign;

  // 1. Element References
  const badgePanel = document.querySelector('.lb-badge-panel');
  const badgeAssembly = document.getElementById('badgeAssembly');
  const badgeTilt = document.getElementById('badgeTilt');
  const badgeCard = document.getElementById('badgeCard');
  const badgeShadow = document.getElementById('badgeShadow');
  const badgeName = document.getElementById('badgeName');
  const badgeInitials = document.getElementById('badgeInitials');
  const lanyardLeftStrap = document.getElementById('lanyardLeftStrap');
  const lanyardRightStrap = document.getElementById('lanyardRightStrap');
  const lanyardClip = document.getElementById('lanyardClip');
  const padlockBody = document.getElementById('padlockBody');

  // Form Field References (Read-only UI binding)
  const loginForm = document.getElementById('hrLoginForm');
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');

  if (!badgePanel || !badgeAssembly || !badgeCard) return;

  // Media Query Checks
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  // 2. Physics Simulation State
  let angle = 0;              // Badge pendulum angle (deg, capped at ±10°)
  let velocity = 0;           // Badge angular velocity (deg/s, capped at ±30 deg/s)
  let lanyardAngle = 0;       // Lanyard follow-through angle (b)
  let lanyardVelocity = 0;    // Lanyard follow-through velocity (w)
  let tiltX = 0;              // 3D tilt pitch (-ny * tiltMaxDeg)
  let tiltY = 0;              // 3D tilt roll (nx * tiltMaxDeg)
  let targetTiltX = 0;
  let targetTiltY = 0;
  let parallaxX = 0;          // Background cards parallax X
  let parallaxY = 0;          // Background cards parallax Y
  let targetParallaxX = 0;
  let targetParallaxY = 0;

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
  // LANYARD SVG PATH GENERATOR (Lags & follow-through with spring b)
  // ==========================================================================
  function updateLanyardVisual(currentLanyardAngle) {
    if (!lanyardLeftStrap || !lanyardRightStrap || !lanyardClip) return;

    // Anchor points at top center of panel (viewBox 0 0 400 130)
    const anchorCenterX = 200;
    const anchorY = 0;
    const leftAnchorX = anchorCenterX - 48;
    const rightAnchorX = anchorCenterX + 48;

    // Displacement and bend follow the second spring (b)
    const swingDeg = SWING_SIGN * currentLanyardAngle;
    const length = 98; // Length in SVG units
    const rad = (swingDeg * Math.PI) / 180;
    const clipX = anchorCenterX + length * Math.sin(rad);
    const clipY = length * Math.cos(rad);

    // Left and right curving strap paths with natural drape
    const midY = clipY * 0.52;
    const bendOffset = swingDeg * 0.35;

    const leftD = `M ${leftAnchorX} ${anchorY} Q ${anchorCenterX - 24 + bendOffset} ${midY} ${clipX - 4} ${clipY}`;
    const rightD = `M ${rightAnchorX} ${anchorY} Q ${anchorCenterX + 24 + bendOffset} ${midY} ${clipX + 4} ${clipY}`;

    lanyardLeftStrap.setAttribute('d', leftD);
    lanyardRightStrap.setAttribute('d', rightD);

    // Position swivel clip and ring
    lanyardClip.setAttribute('transform', `translate(${clipX.toFixed(1)}, ${clipY.toFixed(1)}) rotate(${swingDeg.toFixed(1)})`);
  }

  // ==========================================================================
  // PHYSICS SIMULATION LOOP (Single rAF Loop for Physics, Lanyard, Tilt & Parallax)
  // ==========================================================================
  function tickPhysics() {
    if (document.hidden) {
      isLoopActive = false;
      return;
    }

    if (!isDragging) {
      // 1. Primary Damped Spring Pendulum for Badge
      // v += (-k*a - c*v) * dt; a += v * dt;
      const acceleration = -CONFIG.springK * angle - CONFIG.springC * velocity;
      velocity += acceleration * fixedDt;
      angle += velocity * fixedDt;

      // Cap |v| at 30 deg/s, cap |angle| at ±10°
      velocity = Math.max(-30, Math.min(30, velocity));
      angle = Math.max(-10, Math.min(10, angle));
    }

    // 2. Lanyard Follow-Through Spring (b follows a, lags and overshoots)
    // w += (-followK*(b - a) - followC*w) * dt; b += w * dt;
    const followAccel = -CONFIG.followK * (lanyardAngle - angle) - CONFIG.followC * lanyardVelocity;
    lanyardVelocity += followAccel * fixedDt;
    lanyardAngle += lanyardVelocity * fixedDt;

    // 3. Smooth Tilt Gliding (lerp factor = tiltLerp)
    tiltX += (targetTiltX - tiltX) * CONFIG.tiltLerp;
    tiltY += (targetTiltY - tiltY) * CONFIG.tiltLerp;

    // 4. Background Cards Parallax Lerp
    parallaxX += (targetParallaxX - parallaxX) * CONFIG.tiltLerp;
    parallaxY += (targetParallaxY - parallaxY) * CONFIG.tiltLerp;

    if (badgePanel) {
      badgePanel.style.setProperty('--p-x', `${parallaxX.toFixed(2)}px`);
      badgePanel.style.setProperty('--p-y', `${parallaxY.toFixed(2)}px`);
    }

    // 5. Update Soft Elliptical Shadow
    if (badgeShadow) {
      const normX = targetTiltY / CONFIG.tiltMaxDeg;
      const normY = -targetTiltX / CONFIG.tiltMaxDeg;
      const shadowX = -normX * 10;
      const shadowY = -normY * 6;
      const shadowBlur = 8 + (Math.abs(normX) + Math.abs(normY)) * 2;
      const shadowScale = 1 + (Math.abs(normX) + Math.abs(normY)) * 0.05;
      badgeShadow.style.transform = `translate(${shadowX.toFixed(1)}px, ${shadowY.toFixed(1)}px) scale(${shadowScale.toFixed(2)})`;
      badgeShadow.style.filter = `blur(${shadowBlur.toFixed(1)}px)`;
    }

    // 6. Apply Layered Transforms
    if (!prefersReducedMotion.matches) {
      // Physics wrapper gets rotation only
      badgeAssembly.style.transform = `rotate(${angle.toFixed(2)}deg)`;

      // Tilt wrapper gets 3D cursor tilt (rotateX = -ny*8deg, rotateY = nx*8deg)
      if (badgeTilt) {
        badgeTilt.style.transform = (tiltX === 0 && tiltY === 0)
          ? ''
          : `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
      }

      // Lanyard renders from follow spring (b)
      updateLanyardVisual(lanyardAngle);
    }

    // 7. Stop Condition: loop halts once all springs, tilts and parallax settle at rest
    const isPhysicsSettled = Math.abs(angle) < 0.05 && Math.abs(velocity) < 0.5;
    const isLanyardSettled = Math.abs(lanyardAngle - angle) < 0.05 && Math.abs(lanyardVelocity) < 0.5;
    const isTiltSettled = Math.abs(targetTiltX - tiltX) < 0.05 && Math.abs(targetTiltY - tiltY) < 0.05;
    const isParallaxSettled = Math.abs(targetParallaxX - parallaxX) < 0.08 && Math.abs(targetParallaxY - parallaxY) < 0.08;
    const isPointerIdle = (performance.now() - lastPointerTime) > 80;

    if (!isDragging && isPhysicsSettled && isLanyardSettled && isTiltSettled && isParallaxSettled && (!isPointerOverPanel || isPointerIdle)) {
      angle = 0;
      velocity = 0;
      lanyardAngle = 0;
      lanyardVelocity = 0;
      tiltX = targetTiltX;
      tiltY = targetTiltY;
      parallaxX = targetParallaxX;
      parallaxY = targetParallaxY;

      if (!prefersReducedMotion.matches) {
        badgeAssembly.style.transform = 'rotate(0deg)';
        if (badgeTilt) {
          badgeTilt.style.transform = (tiltX === 0 && tiltY === 0)
            ? ''
            : `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
        }
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
  // DROP-IN ENTRANCE (Once per load: overshoot translateY, landing impulse, stagger content)
  // ==========================================================================
  function triggerDropIn() {
    if (prefersReducedMotion.matches) {
      updateLanyardVisual(0);
      badgeCard.classList.add('is-landed');
      return;
    }

    // Trigger CSS keyframe drop-in (translateY: -110% -> 2% -> -1% -> 0)
    badgeAssembly.classList.add('is-dropping');

    setTimeout(() => {
      badgeAssembly.classList.remove('is-dropping');
      badgeCard.classList.add('is-landed');

      // On landing: initial velocity of ~18 deg/s (respect SWING_SIGN)
      velocity = SWING_SIGN * -18.0;
      startPhysicsLoop();
    }, CONFIG.dropMs);
  }

  // ==========================================================================
  // POINTER INTERACTIONS (Tilt, Sheen, Glare, Velocity Impulse, Drag & Parallax)
  // ==========================================================================
  function onPointerMove(e) {
    if (prefersReducedMotion.matches) return;
    if (e.pointerType === 'touch' || !finePointer.matches) return; // Fine pointer / mouse / pen only

    const rect = badgePanel.getBoundingClientRect();
    const isInside = (e.clientX >= rect.left && e.clientX <= rect.right &&
                      e.clientY >= rect.top && e.clientY <= rect.bottom);

    const nowTime = e.timeStamp || performance.now();

    // 1. Detect Entry into Panel (NO ENTRY KICK)
    if (isInside && !isPointerOverPanel) {
      isPointerOverPanel = true;
      badgePanel.classList.add('is-pointer-inside');
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      lastPointerTime = nowTime;
      smoothedVx = 0;
      velocity = 0; // Zero velocity on entry
      isFirstSample = true; // Apply NO impulse from that first sample
      return;
    }

    // 2. Detect Leave from Panel (EASE TILT & PARALLAX TO 0, ZERO VELOCITY)
    if (!isInside && isPointerOverPanel) {
      isPointerOverPanel = false;
      badgePanel.classList.remove('is-pointer-inside');
      velocity = 0; // Zero velocity on leave
      targetTiltX = 0; // Tilt target eases back to 0
      targetTiltY = 0;
      targetParallaxX = 0; // Parallax targets ease to 0
      targetParallaxY = 0;
      smoothedVx = 0;
      startPhysicsLoop();
      return;
    }

    if (!isInside && !isDragging) {
      targetTiltX = 0;
      targetTiltY = 0;
      targetParallaxX = 0;
      targetParallaxY = 0;
      return;
    }

    // 3. Velocity Computation (EMA smoothed, dead zone, clamped)
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
      // Calculate angle from pivot to pointer (clamped to ±CONFIG.dragMaxDeg)
      // While dragging, bottom of badge follows pointer horizontally (drag right -> bottom moves right)
      const dx = e.clientX - cachedPivotX;
      const dy = Math.max(20, e.clientY - cachedPivotY);
      const rawAngle = Math.atan2(dx, dy) * (180 / Math.PI);
      angle = Math.max(-CONFIG.dragMaxDeg, Math.min(CONFIG.dragMaxDeg, SWING_SIGN * rawAngle));
      velocity = 0;
      startPhysicsLoop();
    } else if (isPointerOverPanel) {
      // Normalized coordinates nx, ny in [-1..1]
      const normX = Math.max(-1, Math.min(1, (e.clientX - cachedPanelCenterX) / cachedPanelHalfWidth));
      const normY = Math.max(-1, Math.min(1, (e.clientY - cachedPanelCenterY) / cachedPanelHalfHeight));

      // Tilt faces cursor: rotateY = nx * 8deg, rotateX = -ny * 8deg
      targetTiltY = normX * CONFIG.tiltMaxDeg;
      targetTiltX = -normY * CONFIG.tiltMaxDeg;

      // Background Cards Parallax: shifts opposite cursor up to parallaxPx
      targetParallaxX = -normX * CONFIG.parallaxPx;
      targetParallaxY = -normY * CONFIG.parallaxPx;

      // Impulse: v += SWING_SIGN * vx * 0.015, cap |v| at 30 deg/s
      // Mouse moving right -> bottom swings right first, then returns
      if (effectiveVx !== 0) {
        velocity += SWING_SIGN * effectiveVx * 0.015;
        velocity = Math.max(-30, Math.min(30, velocity));
      }

      // Specular Sheen & Glare Tracking (Positions via CSS variables --gx, --gy)
      const sheenX = Math.max(10, Math.min(90, 50 + normX * 35));
      const sheenY = Math.max(10, Math.min(90, 40 + normY * 30));
      badgeCard.style.setProperty('--gx', `${sheenX}%`);
      badgeCard.style.setProperty('--gy', `${sheenY}%`);
      badgeCard.style.setProperty('--glare-x', `${sheenX}%`);
      badgeCard.style.setProperty('--glare-y', `${sheenY}%`);

      startPhysicsLoop();
    } else {
      targetTiltX = 0;
      targetTiltY = 0;
      targetParallaxX = 0;
      targetParallaxY = 0;
    }
  }

  // Pointer Enter & Leave Listeners (No entry kick; zero velocity and ease tilt on leave)
  badgePanel.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch' || !finePointer.matches) return;
    isPointerOverPanel = true;
    badgePanel.classList.add('is-pointer-inside');
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    lastPointerTime = e.timeStamp || performance.now();
    smoothedVx = 0;
    velocity = 0; // Zero velocity on entry
    isFirstSample = true; // Apply NO impulse from that first sample
  });

  badgePanel.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch' || !finePointer.matches) return;
    isPointerOverPanel = false;
    badgePanel.classList.remove('is-pointer-inside');
    velocity = 0; // Zero velocity on leave
    targetTiltX = 0; // Tilt target eases back to 0
    targetTiltY = 0;
    targetParallaxX = 0;
    targetParallaxY = 0;
    smoothedVx = 0;
    startPhysicsLoop();
  });

  // Drag Listeners (Fine Pointer Only)
  badgeAssembly.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || prefersReducedMotion.matches || e.pointerType === 'touch') return; // Primary click only
    isDragging = true;
    badgeAssembly.classList.add('is-dragging');
    try {
      badgeAssembly.setPointerCapture(e.pointerId);
    } catch (_) {}
    startPhysicsLoop();
  });

  badgeAssembly.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    badgeAssembly.classList.remove('is-dragging');
    try {
      badgeAssembly.releasePointerCapture(e.pointerId);
    } catch (_) {}
    // Release impulse from drag velocity: swings back through center to other side
    const releaseImpulse = Math.max(-30, Math.min(30, SWING_SIGN * smoothedVx * 0.035));
    velocity = releaseImpulse;
    startPhysicsLoop();
  });

  badgeAssembly.addEventListener('pointercancel', () => {
    if (isDragging) {
      isDragging = false;
      badgeAssembly.classList.remove('is-dragging');
      startPhysicsLoop();
    }
  });

  window.addEventListener('pointermove', onPointerMove, { passive: true });

  // ==========================================================================
  // LIVE EMAIL NAME PREVIEW & NAME TYPING ANIMATION (160ms, throttled to 120ms)
  // ==========================================================================
  let lastDisplayedName = '';
  let lastDisplayedInitials = '';
  let lastNameAnimTime = 0;

  function triggerNameTypingAnim() {
    if (prefersReducedMotion.matches) return;
    const now = performance.now();
    if (now - lastNameAnimTime < 120) return; // Throttled to at most once per 120ms
    lastNameAnimTime = now;

    if (badgeName) {
      badgeName.classList.remove('is-typing');
      void badgeName.offsetWidth; // Force reflow
      badgeName.classList.add('is-typing');
    }
    if (badgeInitials) {
      badgeInitials.classList.remove('is-typing');
      void badgeInitials.offsetWidth; // Force reflow
      badgeInitials.classList.add('is-typing');
    }
  }

  function updateBadgeNameFromEmail() {
    if (!emailInput || !badgeName || !badgeInitials) return;

    const email = emailInput.value.trim();
    if (!email) {
      if (lastDisplayedName !== 'Your name' || lastDisplayedInitials !== 'YN') {
        lastDisplayedName = 'Your name';
        lastDisplayedInitials = 'YN';
        badgeName.textContent = 'Your name';
        badgeInitials.textContent = 'YN';
        triggerNameTypingAnim();
      }
      return;
    }

    const localPart = email.split('@')[0] || '';
    const cleanPart = localPart.replace(/[0-9]/g, '');
    const tokens = cleanPart.split(/[._\-+]/).filter(Boolean);

    let formattedName = '';
    let initials = '';

    if (tokens.length >= 2) {
      const first = tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1).toLowerCase();
      const last = tokens[1].charAt(0).toUpperCase() + tokens[1].slice(1).toLowerCase();
      formattedName = `${first} ${last}`;
      initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    } else if (tokens.length === 1 && tokens[0].length > 0) {
      const single = tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1).toLowerCase();
      formattedName = single;
      initials = single.substring(0, 2).toUpperCase();
    } else {
      formattedName = 'Employee';
      initials = 'EM';
    }

    if (formattedName.length > 22) {
      formattedName = formattedName.substring(0, 21) + '…';
    }

    // Skip if text is unchanged
    if (formattedName === lastDisplayedName && initials === lastDisplayedInitials) {
      return;
    }

    lastDisplayedName = formattedName;
    lastDisplayedInitials = initials;
    badgeName.textContent = formattedName;
    badgeInitials.textContent = initials;
    triggerNameTypingAnim();
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
  // PASSWORD FOCUS & FLIP STATE MANAGEMENT (PROTECTED FLIP)
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
        velocity += SWING_SIGN * -14.0;
        startPhysicsLoop();
      }
    } else if (!shouldFlip && currentlyFlipped) {
      // Flip back to Front Face
      badgeCard.classList.remove('is-flipped');
      if (!prefersReducedMotion.matches) {
        velocity -= SWING_SIGN * -14.0;
        startPhysicsLoop();
      }
    }
  }

  document.addEventListener('focusin', () => {
    syncBadgeFlipState();
  });

  document.addEventListener('focusout', () => {
    // Delay slightly to check if focus shifted within password group (e.g. to toggle btn)
    setTimeout(() => {
      syncBadgeFlipState();
    }, 40);
  });

  // ==========================================================================
  // SHOW / HIDE PASSWORD PADLOCK UNLATCH DETECTION (Back face content only)
  // Shackle lifts (translateY -3px, rotate -18deg) in 320ms, amber ring pulse 500ms
  // On hide: closes in 200ms with tiny body snap
  // ==========================================================================
  let isCurrentlyUnlatched = false;

  function syncPadlockState() {
    if (!passwordInput || !badgeCard) return;
    const isText = (passwordInput.type === 'text');

    if (isText && !isCurrentlyUnlatched) {
      isCurrentlyUnlatched = true;
      badgeCard.classList.add('is-unlatched');
      if (padlockBody) padlockBody.classList.remove('is-snapping');
    } else if (!isText && isCurrentlyUnlatched) {
      isCurrentlyUnlatched = false;
      badgeCard.classList.remove('is-unlatched');
      // Trigger tiny body snap (scale 0.96 -> 1, 200ms)
      if (padlockBody && !prefersReducedMotion.matches) {
        padlockBody.classList.remove('is-snapping');
        void padlockBody.offsetWidth; // Force reflow
        padlockBody.classList.add('is-snapping');
      }
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
  // ERROR REACTION (Physics kick ±26 deg/s alternating sign & red edge overlay)
  // ==========================================================================
  let errorKickSign = 1;
  let errorGlowTimer = null;

  function triggerBadgeErrorShake() {
    // 1. Physics Kick (alternating sign on consecutive errors)
    velocity = SWING_SIGN * errorKickSign * 26.0;
    errorKickSign = -errorKickSign; // Alternate sign
    startPhysicsLoop();

    // 2. Red Edge Overlay (Fades 0 -> 0.7 -> 0 over 600ms, opacity only)
    if (badgeCard) {
      badgeCard.classList.remove('is-error-kick');
      void badgeCard.offsetWidth; // Force reflow
      badgeCard.classList.add('is-error-kick');

      clearTimeout(errorGlowTimer);
      errorGlowTimer = setTimeout(() => {
        badgeCard.classList.remove('is-error-kick');
      }, 620);
    }
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
  // PENDING LOADING STATE (Diagonal light sweep across front when button is disabled)
  // ==========================================================================
  function syncPendingState() {
    if (!loginSubmitBtn || !badgeCard) return;
    const isBusy = loginSubmitBtn.disabled ||
                   loginSubmitBtn.getAttribute('aria-busy') === 'true' ||
                   (loginForm && loginForm.classList.contains('is-submitting'));

    if (isBusy) {
      badgeCard.classList.add('is-pending');
    } else {
      badgeCard.classList.remove('is-pending');
    }
  }

  if (loginSubmitBtn && window.MutationObserver) {
    const btnObserver = new MutationObserver(syncPendingState);
    btnObserver.observe(loginSubmitBtn, { attributes: true, attributeFilter: ['disabled', 'aria-busy', 'class'] });
  }

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
    syncPendingState();
    triggerDropIn();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateCachedMetrics();
      updateBadgeNameFromEmail();
      syncBadgeFlipState();
      syncPadlockState();
      syncPendingState();
      triggerDropIn();
    });
  } else {
    updateCachedMetrics();
    updateBadgeNameFromEmail();
    syncBadgeFlipState();
    syncPadlockState();
    syncPendingState();
    triggerDropIn();
  }

})();
