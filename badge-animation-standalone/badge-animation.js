/**
 * ============================================================================
 * PHYSICS EMPLOYEE ID BADGE — STANDALONE JAVASCRIPT ENGINE
 * ============================================================================
 * A dependency-free physics and animation controller for a hanging ID badge.
 * Designed for junior developers to learn, tweak, and integrate into any UI.
 * 
 * CORE ARCHITECTURAL CONCEPTS:
 * 1. Transform Layering: Separates physics swing, 3D cursor tilt, idle sway,
 *    and 3D card flip across parent-child wrappers to avoid transform collisions.
 * 2. Damped Harmonic Oscillator: Simulates realistic pendulum physics with
 *    Hooke's law (spring constant k) and viscous drag (damping coefficient c).
 * 3. Follow-Through Physics: A secondary spring lags behind the main badge,
 *    bending the lanyard strap and swiveling the metal clip with authentic inertia.
 * 4. Specular Lighting & Parallax: Dynamic CSS custom properties (--gx, --gy,
 *    --p-x, --p-y) drive glare and depth without DOM redraws.
 * 5. Public API: window.BadgeAnimation gives you easy methods to call from your code.
 * ============================================================================
 */

(function (global) {
  'use strict';

  // ==========================================================================
  // CONFIGURATION BLOCK (Tweak these numbers to adjust feel!)
  // ==========================================================================
  const CONFIG = {
    // Idle Life
    idleSwayDeg: 0.8,       // Subtle background sway angle (±0.8 degrees)
    idleSwayPeriodS: 6,     // Duration of one complete idle sway cycle (seconds)
    
    // 3D Tilt Feel
    tiltMaxDeg: 8,          // Maximum 3D card tilt pitch and roll (degrees)
    tiltLerp: 0.08,         // Smoothing interpolation factor for tilt (0.01 - 0.2)
    
    // Primary Badge Pendulum Spring (a = -k*x - c*v)
    springK: 12,            // Spring stiffness (higher = faster snap-back)
    springC: 2.0,           // Damping friction (higher = settles faster)
    
    // Secondary Lanyard Follow-Through Spring
    followK: 9,             // Lanyard lag stiffness
    followC: 1.6,           // Lanyard lag damping
    
    // Drag & Drop
    dragMaxDeg: 25,         // Maximum angle allowed while manually dragging (degrees)
    dropMs: 1000,           // Duration of the initial drop-in entrance (milliseconds)
    
    // Lighting & Parallax
    parallaxPx: 6,          // Maximum offset for background decorative cards (pixels)
    floatPx: 4,             // Idle vertical float for decoration cards (pixels)
    floatPeriodS: 7,        // Idle float period (seconds)
    
    // Swing Direction
    // CSS rotate(+) is clockwise; pivot at top swings bottom LEFT.
    // -1 ensures mouse moving right causes the badge bottom to swing right.
    swingSign: -1
  };

  const SWING_SIGN = CONFIG.swingSign;

  // ==========================================================================
  // DOM REFERENCES
  // ==========================================================================
  const stagePanel = document.querySelector('.badge-stage-panel');
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
  const errorOverlay = document.getElementById('badgeErrorOverlay');

  if (!stagePanel || !badgeAssembly || !badgeCard) {
    console.warn('[BadgeAnimation] Required badge DOM elements not found.');
    return;
  }

  // Accessibility queries
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  // ==========================================================================
  // SIMULATION STATE VARIABLES
  // ==========================================================================
  let angle = 0;             // Badge angle in degrees
  let velocity = 0;          // Badge angular velocity (deg/s)
  let lanyardAngle = 0;      // Lagging lanyard angle (b)
  let lanyardVelocity = 0;   // Lagging lanyard velocity (w)
  let tiltX = 0;             // 3D tilt pitch (degrees)
  let tiltY = 0;             // 3D tilt roll (degrees)
  let targetTiltX = 0;
  let targetTiltY = 0;
  let parallaxX = 0;         // Parallax X offset (px)
  let parallaxY = 0;         // Parallax Y offset (px)
  let targetParallaxX = 0;
  let targetParallaxY = 0;

  const fixedDt = 1 / 60;    // Simulation timestep (~16.6ms)

  // Pointer state
  let isDragging = false;
  let isPointerOverPanel = false;
  let isFirstSample = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastPointerTime = performance.now();
  let smoothedVx = 0;        // EMA smoothed horizontal velocity

  // Cached geometry measurements
  let cachedPivotX = 0;
  let cachedPivotY = 0;
  let cachedPanelCenterX = 0;
  let cachedPanelCenterY = 0;
  let cachedPanelHalfWidth = 1;
  let cachedPanelHalfHeight = 1;

  // Animation frame loop flag
  let isLoopActive = false;
  let rafId = null;

  // Error kick alternation flag
  let errorSign = 1;

  // Name throttle state
  let lastDisplayedName = 'Your name';
  let lastDisplayedInitials = 'YN';
  let lastNameUpdateTime = 0;

  // Telemetry callback hook (optional)
  let telemetryCallback = null;

  // ==========================================================================
  // GEOMETRY CACHING
  // ==========================================================================
  function updateCachedMetrics() {
    const panelRect = stagePanel.getBoundingClientRect();
    cachedPanelCenterX = panelRect.left + panelRect.width / 2;
    cachedPanelCenterY = panelRect.top + panelRect.height / 2;
    cachedPanelHalfWidth = Math.max(panelRect.width / 2, 1);
    cachedPanelHalfHeight = Math.max(panelRect.height / 2, 1);

    const assemblyRect = badgeAssembly.getBoundingClientRect();
    cachedPivotX = assemblyRect.left + assemblyRect.width / 2;
    cachedPivotY = assemblyRect.top;
  }

  // ==========================================================================
  // SVG LANYARD GEOMETRY UPDATE (Follow-through curve & clip swivel)
  // ==========================================================================
  function updateLanyardVisual(lagAngleDeg) {
    if (!lanyardLeftStrap || !lanyardRightStrap || !lanyardClip) return;

    // Control point lateral offset based on follow-through lag
    const bendOffset = SWING_SIGN * (lagAngleDeg * 1.45);
    const clipX = 200 + SWING_SIGN * (lagAngleDeg * 0.75);

    // Left strap quadratic Bézier curve
    lanyardLeftStrap.setAttribute('d', `M 152 0 Q ${176 + bendOffset} 52 ${clipX - 4} 98`);
    const leftStitch = lanyardLeftStrap.nextElementSibling;
    if (leftStitch) {
      leftStitch.setAttribute('d', `M 152 0 Q ${176 + bendOffset} 52 ${clipX - 4} 98`);
    }

    // Right strap quadratic Bézier curve
    lanyardRightStrap.setAttribute('d', `M 248 0 Q ${224 + bendOffset} 52 ${clipX + 4} 98`);
    const rightStitch = lanyardRightStrap.nextElementSibling;
    if (rightStitch) {
      rightStitch.setAttribute('d', `M 248 0 Q ${224 + bendOffset} 52 ${clipX + 4} 98`);
    }

    // Metal clip swivel and rotation
    const clipRot = SWING_SIGN * (lagAngleDeg * 0.95);
    lanyardClip.setAttribute('transform', `translate(${clipX}, 98) rotate(${clipRot.toFixed(2)})`);
  }

  // ==========================================================================
  // MAIN rAF PHYSICS SIMULATION LOOP
  // ==========================================================================
  function tickPhysics() {
    // 1. Primary Spring Physics (Hooke's Law + Viscous Damping)
    if (!isDragging) {
      const springForce = -CONFIG.springK * angle;
      const dampingForce = -CONFIG.springC * velocity;
      const acceleration = springForce + dampingForce;

      velocity += acceleration * fixedDt;
      angle += velocity * fixedDt;
    }

    // Clamp angle and velocity to safe limits
    angle = Math.max(-CONFIG.dragMaxDeg, Math.min(CONFIG.dragMaxDeg, angle));
    velocity = Math.max(-35, Math.min(35, velocity));

    // 2. Secondary Lanyard Follow-Through Spring
    // b follows a with: w += (-followK*(b - a) - followC*w)*dt; b += w*dt;
    const lagDisp = lanyardAngle - angle;
    const lagSpringForce = -CONFIG.followK * lagDisp;
    const lagDampingForce = -CONFIG.followC * lanyardVelocity;
    const lagAcc = lagSpringForce + lagDampingForce;

    lanyardVelocity += lagAcc * fixedDt;
    lanyardAngle += lanyardVelocity * fixedDt;

    // 3. Smooth Lerp for 3D Tilt and Background Parallax
    tiltX += (targetTiltX - tiltX) * CONFIG.tiltLerp;
    tiltY += (targetTiltY - tiltY) * CONFIG.tiltLerp;
    parallaxX += (targetParallaxX - parallaxX) * CONFIG.tiltLerp;
    parallaxY += (targetParallaxY - parallaxY) * CONFIG.tiltLerp;

    // 4. Commit Transforms to the DOM
    badgeAssembly.style.transform = `rotate(${angle.toFixed(3)}deg)`;
    badgeTilt.style.transform = `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
    updateLanyardVisual(lanyardAngle);

    // Apply parallax offset to background decoration cards via CSS variables
    stagePanel.style.setProperty('--p-x', `${parallaxX.toFixed(2)}px`);
    stagePanel.style.setProperty('--p-y', `${parallaxY.toFixed(2)}px`);

    // 5. Dynamic Elliptical Shadow (Shifts opposite tilt)
    if (badgeShadow) {
      const normTiltY = tiltY / (CONFIG.tiltMaxDeg || 1);
      const shadowShiftX = normTiltY * -10;
      const shadowScale = 1 - Math.abs(angle) * 0.012;
      badgeShadow.style.transform = `translateX(${shadowShiftX.toFixed(2)}px) scale(${shadowScale.toFixed(3)})`;
    }

    // 6. Push Live Telemetry (if hooked)
    if (typeof telemetryCallback === 'function') {
      telemetryCallback({
        angle: angle.toFixed(2),
        velocity: velocity.toFixed(2),
        lanyardAngle: lanyardAngle.toFixed(2),
        tiltX: tiltX.toFixed(2),
        tiltY: tiltY.toFixed(2),
        isDragging
      });
    }

    // 7. Check if Physics has Settled (Allows loop to stop at rest!)
    const isPhysicsAtRest = Math.abs(angle) < 0.02 && Math.abs(velocity) < 0.05;
    const isLanyardAtRest = Math.abs(lanyardAngle - angle) < 0.02 && Math.abs(lanyardVelocity) < 0.05;
    const isTiltAtRest = Math.abs(targetTiltX - tiltX) < 0.02 && Math.abs(targetTiltY - tiltY) < 0.02;
    const isParallaxAtRest = Math.abs(targetParallaxX - parallaxX) < 0.02 && Math.abs(targetParallaxY - parallaxY) < 0.02;

    if (!isDragging && !isPointerOverPanel && isPhysicsAtRest && isLanyardAtRest && isTiltAtRest && isParallaxAtRest) {
      // Snap to exact center and stop loop
      angle = 0;
      velocity = 0;
      lanyardAngle = 0;
      lanyardVelocity = 0;
      tiltX = 0;
      tiltY = 0;
      parallaxX = 0;
      parallaxY = 0;

      badgeAssembly.style.transform = 'rotate(0deg)';
      badgeTilt.style.transform = 'rotateX(0deg) rotateY(0deg)';
      updateLanyardVisual(0);
      stagePanel.style.setProperty('--p-x', '0px');
      stagePanel.style.setProperty('--p-y', '0px');
      if (badgeShadow) badgeShadow.style.transform = 'translateX(0px) scale(1)';

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
  // DROP-IN ENTRANCE (Runs on load or replay)
  // ==========================================================================
  function triggerDropIn() {
    if (prefersReducedMotion.matches) {
      updateLanyardVisual(0);
      badgeCard.classList.add('is-landed');
      return;
    }

    // Reset landed state
    badgeCard.classList.remove('is-landed');
    badgeAssembly.classList.remove('is-dropping');
    void badgeAssembly.offsetWidth; // Force CSS reflow

    // Start drop animation (translateY: -110% -> 2% -> -1% -> 0)
    badgeAssembly.classList.add('is-dropping');

    // Reveal front content briskly as the card hits bottom contact (~480ms)
    const revealDelay = Math.min(480, Math.round(CONFIG.dropMs * 0.48));
    setTimeout(() => {
      badgeCard.classList.add('is-landed');
    }, revealDelay);

    // End drop keyframe and transfer control to spring physics
    setTimeout(() => {
      badgeAssembly.classList.remove('is-dropping');
      badgeCard.classList.add('is-landed');

      // On landing: give spring initial swing velocity of 18 deg/s
      velocity = SWING_SIGN * -18.0;
      startPhysicsLoop();
    }, CONFIG.dropMs);
  }

  // ==========================================================================
  // POINTER INTERACTIONS (Tilt, Sheen, Drag & Impulse)
  // ==========================================================================
  function onPointerMove(e) {
    if (prefersReducedMotion.matches) return;
    if (e.pointerType === 'touch' || !finePointer.matches) return;

    const rect = stagePanel.getBoundingClientRect();
    const isInside = (e.clientX >= rect.left && e.clientX <= rect.right &&
                      e.clientY >= rect.top && e.clientY <= rect.bottom);
    const nowTime = e.timeStamp || performance.now();

    // 1. Detect Entry into Panel (NO ENTRY KICK)
    if (isInside && !isPointerOverPanel) {
      isPointerOverPanel = true;
      stagePanel.classList.add('is-pointer-inside');
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      lastPointerTime = nowTime;
      smoothedVx = 0;
      velocity = 0; // Zero velocity on entry
      isFirstSample = true; // Apply NO impulse from that first sample
      return;
    }

    // 2. Detect Leave from Panel
    if (!isInside && isPointerOverPanel) {
      isPointerOverPanel = false;
      stagePanel.classList.remove('is-pointer-inside');
      targetTiltX = 0;
      targetTiltY = 0;
      targetParallaxX = 0;
      targetParallaxY = 0;
      smoothedVx = 0;
      startPhysicsLoop();
      return;
    }

    if (!isInside) return;

    // 3. Compute Normalized Cursor Coordinates (-1 to 1)
    const nx = Math.max(-1, Math.min(1, (e.clientX - cachedPanelCenterX) / cachedPanelHalfWidth));
    const ny = Math.max(-1, Math.min(1, (e.clientY - cachedPanelCenterY) / cachedPanelHalfHeight));

    // Tilt faces cursor: rotateY = nx * tiltMaxDeg, rotateX = -ny * tiltMaxDeg
    targetTiltY = nx * CONFIG.tiltMaxDeg;
    targetTiltX = -ny * CONFIG.tiltMaxDeg;

    // Parallax cards shift opposite cursor
    targetParallaxX = -nx * CONFIG.parallaxPx;
    targetParallaxY = -ny * CONFIG.parallaxPx;

    // Position specular sheen across front face
    const cardRect = badgeCard.getBoundingClientRect();
    if (cardRect.width > 0 && cardRect.height > 0) {
      const gx = Math.round(((e.clientX - cardRect.left) / cardRect.width) * 100);
      const gy = Math.round(((e.clientY - cardRect.top) / cardRect.height) * 100);
      stagePanel.style.setProperty('--gx', `${gx}%`);
      stagePanel.style.setProperty('--gy', `${gy}%`);
    }

    // 4. Compute Velocity & Impulse (While Not Dragging)
    if (!isDragging) {
      const dtMs = Math.max(8, nowTime - lastPointerTime);
      const dtSec = dtMs / 1000;
      const rawVx = (e.clientX - lastPointerX) / dtSec;

      // Exponential moving average: 0.2 new + 0.8 old
      smoothedVx = isFirstSample ? 0 : (0.2 * rawVx + 0.8 * smoothedVx);
      isFirstSample = false;

      // Dead zone: ignore |vx| < 40 px/s
      if (Math.abs(smoothedVx) >= 40) {
        const clampedVx = Math.max(-800, Math.min(800, smoothedVx));
        const impulse = SWING_SIGN * (clampedVx * 0.015);
        velocity = Math.max(-30, Math.min(30, velocity + impulse));
      }
    }

    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    lastPointerTime = nowTime;

    startPhysicsLoop();
  }

  // Pointer Dragging
  function onPointerDown(e) {
    if (prefersReducedMotion.matches) return;
    if (e.button !== 0) return; // Left mouse button only

    isDragging = true;
    badgeAssembly.classList.add('is-dragging');
    badgeAssembly.setPointerCapture(e.pointerId);

    velocity = 0;
    lastPointerX = e.clientX;
    lastPointerTime = e.timeStamp || performance.now();
    smoothedVx = 0;

    startPhysicsLoop();
  }

  function onPointerDragMove(e) {
    if (!isDragging) return;

    const dx = e.clientX - cachedPivotX;
    const dy = Math.max(120, e.clientY - cachedPivotY);

    // Calculate angle in degrees from top pivot
    let targetAngle = Math.atan2(dx, dy) * (180 / Math.PI);
    targetAngle = SWING_SIGN * targetAngle;
    targetAngle = Math.max(-CONFIG.dragMaxDeg, Math.min(CONFIG.dragMaxDeg, targetAngle));

    angle = targetAngle;

    // Track release velocity
    const nowTime = e.timeStamp || performance.now();
    const dtMs = Math.max(8, nowTime - lastPointerTime);
    const rawVx = (e.clientX - lastPointerX) / (dtMs / 1000);
    smoothedVx = 0.25 * rawVx + 0.75 * smoothedVx;

    lastPointerX = e.clientX;
    lastPointerTime = nowTime;
  }

  function onPointerUp(e) {
    if (!isDragging) return;

    isDragging = false;
    badgeAssembly.classList.remove('is-dragging');

    try {
      badgeAssembly.releasePointerCapture(e.pointerId);
    } catch (_) {}

    // On release: retain pointer velocity (EMA smoothed, capped at ±30 deg/s)
    const releaseImpulse = SWING_SIGN * (smoothedVx * 0.035);
    velocity = Math.max(-30, Math.min(30, releaseImpulse));

    startPhysicsLoop();
  }

  // ==========================================================================
  // DYNAMIC NAME & INITIALS POP ANIMATION
  // ==========================================================================
  function triggerNameTypingAnim() {
    badgeName.classList.remove('is-typing');
    badgeInitials.classList.remove('is-typing');
    void badgeName.offsetWidth; // Force CSS reflow
    void badgeInitials.offsetWidth;
    badgeName.classList.add('is-typing');
    badgeInitials.classList.add('is-typing');
  }

  function setName(fullName) {
    const now = performance.now();
    // Throttle updates to at most once per 120ms
    if (now - lastNameUpdateTime < 120) return;
    lastNameUpdateTime = now;

    const clean = (fullName || '').trim();
    if (!clean) {
      if (lastDisplayedName !== 'Your name') {
        lastDisplayedName = 'Your name';
        lastDisplayedInitials = 'YN';
        badgeName.textContent = 'Your name';
        badgeInitials.textContent = 'YN';
        triggerNameTypingAnim();
      }
      return;
    }

    // Split words to form initials
    const words = clean.split(/\s+/).filter(Boolean);
    let displayName = clean;
    let initials = 'YN';

    if (words.length >= 2) {
      initials = (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    } else if (words.length === 1 && words[0].length > 0) {
      initials = words[0].substring(0, 2).toUpperCase();
    }

    if (displayName.length > 20) {
      displayName = displayName.substring(0, 19) + '…';
    }

    // Skip if unchanged
    if (displayName === lastDisplayedName && initials === lastDisplayedInitials) {
      return;
    }

    lastDisplayedName = displayName;
    lastDisplayedInitials = initials;
    badgeName.textContent = displayName;
    badgeInitials.textContent = initials;
    triggerNameTypingAnim();
  }

  // ==========================================================================
  // 3D CARD FLIP & PADLOCK MICRO-INTERACTIONS
  // ==========================================================================
  function setFlipped(isFlipped) {
    if (isFlipped) {
      badgeCard.classList.add('is-flipped');
    } else {
      badgeCard.classList.remove('is-flipped');
    }
  }

  function setUnlocked(isUnlocked) {
    if (isUnlocked) {
      badgeCard.classList.add('is-unlocked');
      badgeCard.classList.remove('snap-close');
    } else {
      if (badgeCard.classList.contains('is-unlocked')) {
        badgeCard.classList.remove('is-unlocked');
        badgeCard.classList.add('snap-close');
        setTimeout(() => badgeCard.classList.remove('snap-close'), 250);
      }
    }
  }

  // ==========================================================================
  // ERROR REACTION (Physics kick ±26 deg/s + Red edge glow)
  // ==========================================================================
  function triggerError() {
    // Alternating physics kick with SWING_SIGN awareness
    velocity = errorSign * SWING_SIGN * 26.0;
    errorSign = -errorSign;
    startPhysicsLoop();

    // Trigger red edge glow overlay
    if (errorOverlay) {
      errorOverlay.classList.remove('is-active');
      void errorOverlay.offsetWidth;
      errorOverlay.classList.add('is-active');
    }
  }

  // ==========================================================================
  // PENDING LOADING SWEEP
  // ==========================================================================
  function setPending(isPending) {
    if (isPending) {
      badgeCard.classList.add('is-pending');
    } else {
      badgeCard.classList.remove('is-pending');
    }
  }

  // ==========================================================================
  // EVENT LISTENERS & LIFECYCLE
  // ==========================================================================
  window.addEventListener('resize', updateCachedMetrics);
  window.addEventListener('scroll', updateCachedMetrics);

  stagePanel.addEventListener('pointermove', onPointerMove);
  badgeAssembly.addEventListener('pointerdown', onPointerDown);
  badgeAssembly.addEventListener('pointermove', onPointerDragMove);
  badgeAssembly.addEventListener('pointerup', onPointerUp);
  badgeAssembly.addEventListener('pointercancel', onPointerUp);

  // Auto-init on load
  function init() {
    updateCachedMetrics();
    triggerDropIn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ==========================================================================
  // EXPOSE CLEAN PUBLIC API
  // ==========================================================================
  global.BadgeAnimation = {
    // Methods
    flip: setFlipped,
    setName: setName,
    setUnlocked: setUnlocked,
    triggerError: triggerError,
    setPending: setPending,
    replayDrop: triggerDropIn,
    
    // Telemetry hook
    onTelemetry: function (fn) {
      telemetryCallback = fn;
    },

    // Configuration access
    getConfig: function () {
      return Object.assign({}, CONFIG);
    },
    setConfig: function (newConfig) {
      Object.assign(CONFIG, newConfig);
    }
  };

})(window);
