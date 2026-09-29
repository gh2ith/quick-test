/**
 * ============================================================================
 * LANDING JOURNEY JS — FIXED ROUTE, CAMERA MODEL & GSAP SCROLLTRIGGER ENGINE
 * ============================================================================
 * - Strict Guest-Only scope: Cleanly mounts and unmounts with zero leaks
 * - Camera Model: Translates and gently tilts world wrapper to track traveler
 * - Stops: Exactly ONE stop visible at a time with dwell (55%) & travel (45%)
 * - Directional transitions, scrubbed micro-interactions, responsive routes
 * ============================================================================
 */

(function () {
  'use strict';

  // Constants & State
  const TOTAL_STOPS = 9; // 0 to 8
  const STOP_NAMES = [
    'Start',
    'About',
    'Services',
    'Experience',
    'Tasks',
    'Leave',
    'Policies',
    'Contact',
    'Login'
  ];

  let masterTimeline = null;
  let scrollTriggerInstance = null;
  let isMounted = false;
  let activeStopIndex = 0;
  let cachedNodePositions = [];
  let pathTotalLength = 0;
  let isPortrait = false;

  // Event listener references for clean teardown
  let boundKeyHandler = null;
  let boundResizeHandler = null;
  let boundPointerHandler = null;
  let resizeTimeout = null;

  // SVG Routes for Landscape vs Portrait
  const LANDSCAPE_ROUTE = "M 250 950 C 400 820, 420 740, 550 680 C 720 600, 780 480, 900 420 C 1050 350, 1140 280, 1250 320 C 1420 370, 1540 380, 1650 480 C 1780 600, 1850 720, 1720 850 C 1600 970, 1480 1020, 1350 980 C 1180 930, 1080 920, 950 860 C 850 810, 880 650, 1050 580";
  const PORTRAIT_ROUTE = "M 500 2200 C 400 2100, 350 2020, 320 1950 C 280 1850, 600 1780, 680 1700 C 740 1620, 400 1520, 350 1450 C 300 1370, 600 1280, 650 1200 C 700 1110, 380 1020, 320 950 C 260 870, 620 780, 680 700 C 740 600, 400 520, 350 450 C 300 370, 420 280, 500 200";

  /**
   * Check GSAP availability
   */
  function hasGSAP() {
    return typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  }

  /**
   * Fallback if GSAP fails to load
   */
  function initNoGsapFallback() {
    const root = document.querySelector('.journey');
    if (root) {
      root.classList.add('no-gsap-fallback');
    }
  }

  /**
   * Pre-compute exact coordinates of all 9 nodes on the SVG curve
   */
  function computeNodeWaypoints(svgPath) {
    if (!svgPath) return [];
    pathTotalLength = svgPath.getTotalLength();
    const points = [];

    for (let i = 0; i < TOTAL_STOPS; i++) {
      const dist = (i / (TOTAL_STOPS - 1)) * pathTotalLength;
      const pt = svgPath.getPointAtLength(dist);
      
      // Calculate tangent angle
      const ptAhead = svgPath.getPointAtLength(Math.min(dist + 2, pathTotalLength));
      const angle = Math.atan2(ptAhead.y - pt.y, ptAhead.x - pt.x) * (180 / Math.PI);

      points.push({
        x: pt.x,
        y: pt.y,
        angle: angle,
        dist: dist,
        index: i
      });
    }

    return points;
  }

  /**
   * Build SVG Nodes DOM
   */
  function renderSvgNodes(nodesGroup, waypoints) {
    if (!nodesGroup) return;
    nodesGroup.innerHTML = '';

    waypoints.forEach((wp, i) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', i === 0 ? 'road-node active' : 'road-node');
      g.setAttribute('id', `roadNode-${i}`);
      g.setAttribute('transform', `translate(${wp.x}, ${wp.y})`);
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', `Jump to Stop ${i + 1}: ${STOP_NAMES[i]}`);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'node-outer');
      circle.setAttribute('r', '14');

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('class', 'node-label');
      text.textContent = (i + 1).toString();

      g.appendChild(circle);
      g.appendChild(text);

      g.addEventListener('click', () => jumpToStop(i));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          jumpToStop(i);
        }
      });

      nodesGroup.appendChild(g);
    });
  }

  /**
   * Update active stop accessibility & UI indicators
   */
  function setActiveStop(index) {
    if (activeStopIndex === index && document.getElementById(`stop-${index}`)?.classList.contains('is-active')) {
      return;
    }
    activeStopIndex = index;

    // 1. Accessibility: inert & aria-hidden on inactive stops
    for (let i = 0; i < TOTAL_STOPS; i++) {
      const stopEl = document.getElementById(`stop-${i}`);
      const navChip = document.getElementById(`navChip-${i}`);
      const nodeEl = document.getElementById(`roadNode-${i}`);

      if (stopEl) {
        if (i === index) {
          stopEl.classList.add('is-active');
          stopEl.removeAttribute('inert');
          stopEl.setAttribute('aria-hidden', 'false');
        } else {
          stopEl.classList.remove('is-active');
          stopEl.setAttribute('inert', '');
          stopEl.setAttribute('aria-hidden', 'true');
        }
      }

      // 2. Desktop Navigation chips
      if (navChip) {
        if (i === index) {
          navChip.classList.add('is-active');
          navChip.setAttribute('aria-current', 'step');
        } else {
          navChip.classList.remove('is-active');
          navChip.removeAttribute('aria-current');
        }
      }

      // 3. Road Nodes on SVG
      if (nodeEl) {
        if (i === index) {
          nodeEl.className.baseVal = 'road-node active';
        } else if (i < index) {
          nodeEl.className.baseVal = 'road-node completed';
        } else {
          nodeEl.className.baseVal = 'road-node';
        }
      }
    }

    // 4. Mobile HUD counter & progress fill
    const mobileCounter = document.getElementById('mobileStopCounter');
    const mobileFill = document.getElementById('mobileProgressFill');
    if (mobileCounter) {
      mobileCounter.textContent = `0${index + 1} / 09`;
    }
    if (mobileFill) {
      mobileFill.style.width = `${((index + 1) / TOTAL_STOPS) * 100}%`;
    }

    // 5. Next Stop hint near bottom
    const nextHint = document.getElementById('journeyNextHint');
    if (nextHint) {
      if (index < TOTAL_STOPS - 1) {
        nextHint.style.opacity = '1';
        nextHint.innerHTML = `<i class="bi bi-chevron-down"></i> Next: <strong>${STOP_NAMES[index + 1]}</strong>`;
      } else {
        nextHint.style.opacity = '0';
      }
    }

    // 6. Aria Live announcement
    const liveRegion = document.getElementById('journeyLiveAnnouncer');
    if (liveRegion) {
      liveRegion.textContent = `Stop ${index + 1} of 9: ${STOP_NAMES[index]}`;
    }
  }

  /**
   * Camera & Traveler update at progress (0 to 1)
   */
  function updateCameraAndTraveler(progress, svgPath, worldEl, travelerEl, trailPath, dashLine) {
    if (!svgPath || !worldEl || !travelerEl || !cachedNodePositions.length) return;

    const currentDist = progress * pathTotalLength;

    // 1. Trail & Centerline
    if (trailPath) {
      trailPath.style.strokeDashoffset = pathTotalLength - currentDist;
    }
    if (dashLine) {
      dashLine.style.strokeDashoffset = -currentDist * 1.5;
    }

    // 2. Traveler Coordinates on the SVG path
    const pt = svgPath.getPointAtLength(currentDist);
    const ptAhead = svgPath.getPointAtLength(Math.min(currentDist + 3, pathTotalLength));
    const angle = Math.atan2(ptAhead.y - pt.y, ptAhead.x - pt.x) * (180 / Math.PI);

    // Position traveler
    travelerEl.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
    const pointer = document.getElementById('travelerHeadingPointer');
    if (pointer) {
      pointer.setAttribute('transform', `rotate(${angle - 90})`);
    }

    // 3. CAMERA MODEL: Translate & gently rotate world wrapper so traveler stays near fixed focal point
    // Desktop focal point: center horizontal, lower third (0.65)
    // Mobile focal point: center horizontal, lower center (0.70)
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const isSmall = viewW <= 768;

    const focalX = viewW * 0.5;
    const focalY = isSmall ? viewH * 0.70 : viewH * 0.65;

    // SVG viewBox scale factor
    const vbW = isPortrait ? 1000 : 2000;
    const vbH = isPortrait ? 2400 : 1200;
    const scale = Math.max(viewW / vbW, viewH / vbH);

    // World camera translation
    const worldX = focalX - (pt.x * scale);
    const worldY = focalY - (pt.y * scale);
    // Gentle tilt at bends (-6 to +6 degrees max)
    const gentleTilt = Math.sin((angle * Math.PI) / 180) * 4.5;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      worldEl.style.transform = `translate(${worldX.toFixed(1)}px, ${worldY.toFixed(1)}px)`;
    } else {
      worldEl.style.transform = `translate(${worldX.toFixed(1)}px, ${worldY.toFixed(1)}px) rotate(${gentleTilt.toFixed(2)}deg)`;
    }
  }

  /**
   * Build the Master GSAP Timeline & ScrollTrigger
   */
  function buildMasterTimeline() {
    if (!hasGSAP()) {
      initNoGsapFallback();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const spacer = document.getElementById('journeyScrollSpacer');
    const svgPath = document.getElementById('roadProgressTrail');
    const worldEl = document.getElementById('journeyWorld');
    const travelerEl = document.getElementById('travelerElement');
    const trailPath = document.getElementById('roadProgressTrail');
    const dashLine = document.getElementById('roadCenterLine');

    if (!spacer || !svgPath || !worldEl || !travelerEl) return;

    // Setup SVG route based on orientation
    isPortrait = window.matchMedia('(max-width: 640px), (orientation: portrait) and (max-width: 900px)').matches;
    const svgCanvas = document.getElementById('dynamicJourneySvg');
    const underglow = document.getElementById('roadUnderglow');
    const ribbon = document.getElementById('roadRibbon');
    const innerBorder = document.getElementById('roadInnerBorder');

    const routeData = isPortrait ? PORTRAIT_ROUTE : LANDSCAPE_ROUTE;
    svgCanvas.setAttribute('viewBox', isPortrait ? "0 0 1000 2400" : "0 0 2000 1200");

    [underglow, ribbon, innerBorder, dashLine, trailPath].forEach(path => {
      if (path) path.setAttribute('d', routeData);
    });

    cachedNodePositions = computeNodeWaypoints(svgPath);
    trailPath.style.strokeDasharray = pathTotalLength;
    trailPath.style.strokeDashoffset = pathTotalLength;

    renderSvgNodes(document.getElementById('roadNodesGroup'), cachedNodePositions);

    // Initial position at Start
    updateCameraAndTraveler(0, svgPath, worldEl, travelerEl, trailPath, dashLine);

    // Master Timeline: 8 intervals between 9 stops
    // Each interval = 1.0 unit in timeline time
    masterTimeline = gsap.timeline({
      paused: true,
      defaults: { ease: "none" }
    });

    // Create Dwell (~55%) and Travel (~45%) for each stop
    for (let i = 0; i < TOTAL_STOPS; i++) {
      const stopEl = document.getElementById(`stop-${i}`);
      const nextStopEl = document.getElementById(`stop-${i + 1}`);
      const baseTime = i; // 0, 1, 2, ..., 8

      // Dwell phase micro-interactions
      if (i === 4) {
        // Stop 5: Task Management Stepper
        const steps = stopEl ? stopEl.querySelectorAll('.stepper-step') : [];
        if (steps.length) {
          steps.forEach((st, idx) => {
            masterTimeline.to(st, {
              className: 'stepper-step is-lit',
              duration: 0.08
            }, baseTime + 0.05 + idx * 0.07);
          });
        }
      } else if (i === 5) {
        // Stop 6: Leave Management Lifecycle
        const leaveChips = stopEl ? stopEl.querySelectorAll('.stepper-step') : [];
        if (leaveChips.length) {
          leaveChips.forEach((lc, idx) => {
            masterTimeline.to(lc, {
              className: 'stepper-step is-lit',
              duration: 0.1
            }, baseTime + 0.05 + idx * 0.09);
          });
        }
      }

      // Stop transition to next
      if (i < TOTAL_STOPS - 1 && stopEl && nextStopEl) {
        const exitStartTime = baseTime + 0.55;
        const exitEndTime = baseTime + 0.75;
        const enterStartTime = baseTime + 0.75;
        const enterEndTime = baseTime + 1.0;

        // Current Stop Exits (Directional translate upward & fade)
        masterTimeline.to(stopEl, {
          opacity: 0,
          y: -35,
          scale: 0.96,
          visibility: 'hidden',
          duration: 0.20,
          ease: "power2.in"
        }, exitStartTime);

        // Next Stop Enters (Enters from below into focus)
        masterTimeline.fromTo(nextStopEl, {
          opacity: 0,
          y: 35,
          scale: 0.96,
          visibility: 'hidden'
        }, {
          opacity: 1,
          y: 0,
          scale: 1,
          visibility: 'visible',
          duration: 0.25,
          ease: "power2.out"
        }, enterStartTime);
      }
    }

    // Single ScrollTrigger to scrub masterTimeline and road
    scrollTriggerInstance = ScrollTrigger.create({
      trigger: spacer,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.8,
      snap: {
        snapTo: 1 / (TOTAL_STOPS - 1),
        duration: { min: 0.25, max: 0.55 },
        delay: 0.1,
        ease: "power1.inOut"
      },
      onUpdate: (self) => {
        const p = self.progress;
        masterTimeline.progress(p);

        // Update road camera and traveler
        updateCameraAndTraveler(p, svgPath, worldEl, travelerEl, trailPath, dashLine);

        // Determine currently active stop
        const currentStop = Math.round(p * (TOTAL_STOPS - 1));
        setActiveStop(currentStop);

        // Fade scroll-to-begin hint after first scroll
        const scrollHint = document.getElementById('scrollBeginHint');
        if (scrollHint) {
          scrollHint.style.opacity = p > 0.02 ? '0' : '1';
        }
      }
    });

    setActiveStop(0);
  }

  /**
   * Jump cleanly to specific stop (0 to 8)
   */
  function jumpToStop(index) {
    if (!isMounted) return;
    const spacer = document.getElementById('journeyScrollSpacer');
    if (!spacer) return;

    const maxScroll = spacer.scrollHeight - window.innerHeight;
    const targetScroll = (index / (TOTAL_STOPS - 1)) * maxScroll;

    window.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });
  }

  /**
   * Keyboard Navigation (↓, PageDown, Space = next; ↑, PageUp = previous; Home = first, End = last)
   * Never hijacks keys while user is inside an input, textarea, or button!
   */
  function handleKeyDown(e) {
    if (!isMounted) return;

    // Ignore if focus is in an input or form element
    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement.isContentEditable) {
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      if (activeStopIndex < TOTAL_STOPS - 1) {
        e.preventDefault();
        jumpToStop(activeStopIndex + 1);
      }
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      if (activeStopIndex > 0) {
        e.preventDefault();
        jumpToStop(activeStopIndex - 1);
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      jumpToStop(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      jumpToStop(TOTAL_STOPS - 1);
    }
  }

  /**
   * Desktop Pointer Parallax on Background Layer only
   */
  function handlePointerParallax(e) {
    if (!isMounted || window.innerWidth <= 992) return;
    const bgLayer = document.getElementById('journeyBgLayer');
    if (!bgLayer) return;

    const xRatio = (e.clientX / window.innerWidth) - 0.5;
    const yRatio = (e.clientY / window.innerHeight) - 0.5;

    bgLayer.style.transform = `translate3d(${-xRatio * 18}px, ${-yRatio * 18}px, 0)`;
  }

  /**
   * Window Resize Handler (Debounced, preserving progress & refreshing ScrollTrigger)
   */
  function handleResize() {
    if (!isMounted) return;
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const currentProg = scrollTriggerInstance ? scrollTriggerInstance.progress : 0;
      unmountJourney();
      mountJourney();
      if (scrollTriggerInstance) {
        scrollTriggerInstance.scroll(currentProg * (document.getElementById('journeyScrollSpacer').scrollHeight - window.innerHeight));
      }
    }, 200);
  }

  /**
   * MOUNT JOURNEY LIFECYCLE
   * Initializes the journey when guest view renders
   */
  function mountJourney() {
    if (isMounted) return;
    isMounted = true;

    // Bind event handlers
    boundKeyHandler = handleKeyDown;
    boundResizeHandler = handleResize;
    boundPointerHandler = handlePointerParallax;

    window.addEventListener('keydown', boundKeyHandler);
    window.addEventListener('resize', boundResizeHandler, { passive: true });
    window.addEventListener('pointermove', boundPointerHandler, { passive: true });

    // Build GSAP Timeline & ScrollTrigger
    setTimeout(() => {
      buildMasterTimeline();
    }, 50);
  }

  /**
   * UNMOUNT JOURNEY LIFECYCLE
   * Fully destroys the journey when user enters dashboard or navigates away.
   * Kills timelines/triggers, removes listeners, resets styles.
   */
  function unmountJourney() {
    if (!isMounted) return;
    isMounted = false;

    // 1. Kill ScrollTrigger
    if (scrollTriggerInstance) {
      scrollTriggerInstance.kill();
      scrollTriggerInstance = null;
    }

    // 2. Kill GSAP timeline
    if (masterTimeline) {
      masterTimeline.kill();
      masterTimeline = null;
    }

    // 3. Remove event listeners
    if (boundKeyHandler) {
      window.removeEventListener('keydown', boundKeyHandler);
      boundKeyHandler = null;
    }
    if (boundResizeHandler) {
      window.removeEventListener('resize', boundResizeHandler);
      boundResizeHandler = null;
    }
    if (boundPointerHandler) {
      window.removeEventListener('pointermove', boundPointerHandler);
      boundPointerHandler = null;
    }
    clearTimeout(resizeTimeout);

    // 4. Restore scroll and body styles
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  // Expose global controller
  window.mountJourney = mountJourney;
  window.unmountJourney = unmountJourney;
  window.jumpToJourneyStop = jumpToStop;

})();
