# 🪪 Physics Employee ID Badge — Standalone Animation Guide
> **Junior Developer Training Edition**  
> Pure front-end animation: Dependency-free HTML5, CSS 3D Transforms, and Vanilla JavaScript physics. Zero backend, zero authentication, zero third-party physics libraries.

---

## 📁 What's in this Folder?

This directory contains an isolated, production-grade animation package that you can freely study, experiment with, and integrate into any project:

```
badge-animation-standalone/
├── index.html            # Clean visual stage + Interactive Developer Sandbox
├── badge-animation.css   # Complete 3D transforms, keyframes, lighting & styling
├── badge-animation.js    # Damped harmonic physics engine with public API
└── README.md             # This comprehensive architecture & integration guide
```

---

## 🧠 Core Architecture Explained

### 1. Transform Layering (Why 4 Wrappers?)
In CSS, when you apply `transform: rotate(...)` on an element that already has `transform: scale(...)` or `rotateY(...)`, the latter overrides the former unless carefully concatenated in a single string. When multiple independent animations (physics swing, 3D mouse tilt, continuous idle sway, and 3D card flip) compete for the same element, things break or jitter.

To make them 100% bug-free and independent, we nest four dedicated transform wrappers:

```
[ .badge-assembly ]       ← Layer 1: Pendulum physics swing (rotate) + Drop-in entrance
   └── [ .badge-tilt ]     ← Layer 2: 3D cursor tilt (rotateX/rotateY) + Hover/drag scale
        └── [ .badge-idle-sway ] ← Layer 3: Pure CSS keyframe sway (±0.8deg, 6s)
             └── [ .badge-card ]  ← Layer 4: 3D Card flip on password focus (rotateY 180deg)
                  ├── .badge-front ← Layer 5: Front Face (Avatar, Name, Role, Chip, Stripe)
                  └── .badge-back  ← Layer 5: Back Face (Padlock, Barcode, Confidential)
```

**Why this matters**:
- The **physics engine** only touches `.badge-assembly`.
- The **mouse tilt** only touches `.badge-tilt`.
- The **idle sway** is a pure CSS `@keyframes` on `.badge-idle-sway`, consuming **0% CPU** from the JavaScript thread.
- The **card flip** is a clean `0.55s` transition on `.badge-card`.

---

### 2. Damped Harmonic Oscillator (Pendulum Spring Physics)
Instead of hardcoding canned CSS animations for swings and drags, the badge uses the physical equation of a damped spring:

$$a = -k \cdot \theta - c \cdot \omega$$

Where:
- $\theta$ (`angle`) is the current angle offset from center.
- $\omega$ (`velocity`) is the angular speed in degrees per second.
- $k$ (`CONFIG.springK = 12`) is the restoring stiffness (Hooke's Law).
- $c$ (`CONFIG.springC = 2.0`) is the viscous damping coefficient (air resistance/friction).

Every frame ($\Delta t = 1/60\text{s}$), the physics engine updates:
```js
const springForce = -CONFIG.springK * angle;
const dampingForce = -CONFIG.springC * velocity;
const acceleration = springForce + dampingForce;

velocity += acceleration * fixedDt;
angle += velocity * fixedDt;
```

---

### 3. Lanyard Follow-Through Lag (Secondary Spring)
A realistic lanyard does not move as a rigid piece of cardboard. When the badge swings right, the flexible strap lags behind, bends into a curve, and overshoots when the badge reverses.

To achieve this, we simulate a **second spring** ($b$) that tracks the badge's angle ($a$):
```js
// b follows a with: w += (-followK*(b - a) - followC*w)*dt; b += w*dt;
const lagDisp = lanyardAngle - angle;
const lagSpringForce = -CONFIG.followK * lagDisp;
const lagDampingForce = -CONFIG.followC * lanyardVelocity;
const lagAcc = lagSpringForce + lagDampingForce;

lanyardVelocity += lagAcc * fixedDt;
lanyardAngle += lanyardVelocity * fixedDt;
```
We then feed `lanyardAngle` into the SVG quadratic Bézier control point:
```js
lanyardLeftStrap.setAttribute('d', `M 152 0 Q ${176 + bendOffset} 52 ${clipX - 4} 98`);
```

---

## ⚙️ The CONFIG Tunables Block

Every physical feeling can be adjusted in one place at the top of `badge-animation.js`:

| Tunable | Default | Description |
| :--- | :--- | :--- |
| `idleSwayDeg` | `0.8` | Amplitude of subtle background sway in degrees. |
| `idleSwayPeriodS` | `6` | Cycle time for one full idle sway in seconds. |
| `tiltMaxDeg` | `8` | Maximum 3D card tilt pitch and roll in degrees. |
| `tiltLerp` | `0.08` | Smooth interpolation factor for cursor tracking (0.01 = floaty, 0.2 = snappy). |
| `springK` | `12` | Restoring spring stiffness for the badge pendulum. |
| `springC` | `2.0` | Damping friction (settles within ~3 seconds after mouse stops). |
| `followK` | `9` | Lanyard follow-through lag stiffness. |
| `followC` | `1.6` | Lanyard follow-through damping. |
| `dragMaxDeg` | `25` | Hard limit on how far user can drag badge sideways. |
| `dropMs` | `1000` | Duration of initial drop-in entrance animation. |
| `parallaxPx` | `6` | Distance background cards shift opposite the cursor. |
| `floatPx` | `4` | Idle vertical floating distance for background cards. |
| `floatPeriodS` | `7` | Idle floating cycle time for background cards. |
| `swingSign` | `-1` | Direction multiplier (-1 ensures mouse moving right swings badge bottom right). |

---

## 🚀 How to Wire This Into Your Own Code

`badge-animation.js` exposes a clean, developer-friendly API on `window.BadgeAnimation`:

### 1. 3D Card Flip (Password Focus)
When the user focuses your password field, flip the badge to the confidential back face:
```javascript
const passwordInput = document.getElementById('myPasswordInput');

passwordInput.addEventListener('focus', () => {
  BadgeAnimation.flip(true);  // Flips badge to back face
});

passwordInput.addEventListener('blur', () => {
  BadgeAnimation.flip(false); // Returns badge to front face
});
```

### 2. Interactive Padlock (Show / Hide Password)
When the user clicks the eye toggle button, unlock the padlock shackle:
```javascript
const toggleEyeBtn = document.getElementById('myToggleEye');
let isShowingPassword = false;

toggleEyeBtn.addEventListener('click', () => {
  isShowingPassword = !isShowingPassword;
  
  // Unlocks shackle with cubic-bezier easing and amber pulse ring:
  BadgeAnimation.setUnlocked(isShowingPassword);
});
```

### 3. Dynamic Name & Live Initials
Sync the employee's name and avatar initials as they type their name or email:
```javascript
const nameOrEmailInput = document.getElementById('myEmailInput');

nameOrEmailInput.addEventListener('input', (e) => {
  // Automatically computes initials (e.g. "Sarah Jenkins" -> "SJ")
  // and triggers the 160ms pop micro-animation:
  BadgeAnimation.setName(e.target.value);
});
```

### 4. Error Reaction Kick
When a user enters an invalid password or email, trigger the physics impulse:
```javascript
function onLoginFailed() {
  // Sets velocity to ±26 deg/s and fades red edge overlay:
  BadgeAnimation.triggerError();
}
```

### 5. Loading Sweep
While waiting for an API response or authentication check:
```javascript
// Start diagonal light sweep:
BadgeAnimation.setPending(true);

// When API returns:
BadgeAnimation.setPending(false);
```

### 6. Replay Drop-In Entrance
```javascript
// Replays the drop-in from top with touchdown name reveal:
BadgeAnimation.replayDrop();
```

---

## 🧪 Testing with the Developer Sandbox

1. Open `badge-animation-standalone/index.html` in any web browser.
2. In the right-hand panel:
   - Type in the **Test Name** box to test live name updates and initials generation.
   - Click in the **Test Password** field to watch the 3D flip.
   - Click the **Eye icon** to watch the padlock shackle lift and the amber ring pulse.
   - Click **Replay Drop-In** to see the badge drop from above with the fast touchdown name reveal.
   - Click **Error Kick** to see the pendulum swing kick and red edge glow.
   - Watch the **Live Physics Telemetry** box update angles and velocity in real-time!

Happy coding and enjoy training your front-end skills! 🚀
