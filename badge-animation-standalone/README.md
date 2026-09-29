# 🪪 Registration / Login Page — Training Starter

This folder contains the **exact registration page** with the background, split-screen layout, and complete physics ID badge animation intact, but with the form elements removed so you can build them yourself from scratch!

---

## 📁 Files in this Folder

- **`index.html`**: The complete page structure (exact background, ambiance, left panel with hanging lanyard badge). The right panel (`.lb-form-container`) is empty and ready for your code!
- **`login-badge.css`**: The complete stylesheet containing the page background, glassmorphism layout, and all badge physics/animations.
- **`login-badge.js`**: The presentation badge animation engine (drop-in, pendulum physics, 3D tilt, flip, and padlock).

---

## 🎯 How Your Elements Hook Into the Badge

As you build your form inside `<div class="lb-form-container">`, you can use these IDs if you want the badge to interact with your inputs:

| Your Element | ID to Use | What the Badge Does |
| :--- | :--- | :--- |
| **Email or Name Input** | `id="loginEmail"` | Automatically updates the employee name on the badge and generates avatar initials with a pop animation. |
| **Password Input** | `id="loginPassword"` | Focusing this field automatically flips the badge 180° to the confidential back face. |
| **Password Eye Toggle** | `id="togglePasswordBtn"` | Clicking this button opens the padlock shackle with an amber ring pulse. |
| **Submit Button** | `id="loginSubmitBtn"` | When disabled (or given `class="is-loading"`), runs a diagonal light sweep across the badge. |
| **Form Container** | `id="hrLoginForm"` | Standard wrapper for your `<form>`. |

*(Note: None of these IDs are strictly required—the badge and lanyard physics will render, drop in, tilt, and swing regardless of what you build!)*

---

## 🚀 How to View It

With your local server running, open:
**`http://localhost:8080/badge-animation-standalone/index.html`**

You'll see the exact page and background with the badge hanging on the left, and an open space on the right for you to start coding! Have fun training! 🚀
