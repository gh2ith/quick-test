# Bridgeway Design System: Modern Executive Blue & White

This file documents the official frontend design system for the Bridgeway application.
It serves as the reference guide for all current and future UI implementations.

---

## 1. Overview & Aesthetic Direction

Bridgeway uses a **Modern Executive White & Royal Blue** design system.
This replaces the legacy dark ("Harnen") theme (`#181713` / `#f0e9de`) with a crisp, modern SaaS appearance characterized by:
- **Canvas:** Soft, eye-pleasing slate background (`#F8FAFC`).
- **Surfaces:** Pure white containers (`#FFFFFF`) with 1px slate borders (`#E2E8F0`) and soft diffused elevation shadows.
- **Accents:** Electric Royal Blue (`#2563EB`) as the primary brand anchor for buttons, active indicators, and focus states.
- **Typography:** High-contrast slate hierarchy (`#0F172A` headlines, `#475569` body text) using `Plus Jakarta Sans` and `Inter`.
- **Ambience:** Subtle radial background glows and light dot grids.

---

## 2. Design Tokens

### Color Palette
```css
:root {
    /* Canvas & Surfaces */
    --bg: #f8fafc;
    --surface: #ffffff;
    --surface-muted: #f1f5f9;
    --surface-subtle: #f8fafc;
    --border: #e2e8f0;
    --border-hover: #cbd5e1;
    --border-subtle: rgba(15, 23, 42, 0.06);

    /* Text Hierarchy */
    --text: #0f172a;
    --text-secondary: #475569;
    --text-muted: #94a3b8;

    /* Primary Blue Brand */
    --primary: #2563eb;
    --primary-dark: #1d4ed8;
    --primary-hover: #1e40af;
    --primary-light: #eff6ff;
    --primary-border: #dbeafe;
    --primary-glow: rgba(37, 99, 235, 0.22);

    /* Status Indicators */
    --success: #059669;
    --success-light: #ecfdf5;
    --success-border: #a7f3d0;

    --warning: #d97706;
    --warning-light: #fffbeb;
    --warning-border: #fde68a;

    --danger: #dc2626;
    --danger-light: #fef2f2;
    --danger-border: #fecaca;

    --indigo: #4f46e5;
    --indigo-light: #eef2ff;

    /* Elevation Shadows */
    --shadow-sm: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04);
    --shadow-lg: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04);
    --shadow-primary: 0 4px 14px 0 rgba(37, 99, 235, 0.28);
}
```

---

## 3. Typography

- **Headings & Key Metrics:** `Plus Jakarta Sans` (weights: `600`, `700`, `800`) with letter-spacing `-0.015em`.
- **Body & Controls:** `Inter` or system sans-serif (weights: `400`, `500`, `600`).

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## 4. UI Components

### Cards
- **Background:** `#ffffff`
- **Border:** `1px solid #e2e8f0`
- **Border Radius:** `16px`
- **Shadow:** `0 1px 3px 0 rgba(15, 23, 42, 0.05)`
- **Hover:** `transform: translateY(-2px); border-color: #cbd5e1; box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.08);`

### Buttons
- **Primary:** Background `#2563eb`, Text `#ffffff`, Border radius `10px` or `12px`, padding `0.65rem 1.25rem`, shadow `0 4px 12px rgba(37, 99, 235, 0.25)`.
  - *Hover:* Background `#1d4ed8`, shadow `0 6px 16px rgba(37, 99, 235, 0.35)`.
- **Secondary:** Background `#ffffff`, Border `1px solid #e2e8f0`, Text `#0f172a`.
  - *Hover:* Background `#f8fafc`, Border `#cbd5e1`.

### Form Fields
- **Background:** `#ffffff`
- **Border:** `1px solid #e2e8f0`, Border radius `10px`
- **Text:** `#0f172a`, Placeholder `#94a3b8`
- **Focus:** Border `#2563eb`, Box-shadow `0 0 0 3px rgba(37, 99, 235, 0.15)`

### Status Badges (Pill shape `9999px`)
- **Approved / Active:** Soft green `#ecfdf5` background, `#059669` text, `#a7f3d0` border.
- **Pending:** Soft amber `#fffbeb` background, `#d97706` text, `#fde68a` border.
- **Rejected:** Soft red `#fef2f2` background, `#dc2626` text, `#fecaca` border.
- **Informational:** Soft blue `#eff6ff` background, `#2563eb` text, `#dbeafe` border.

---

## 5. Reference Implementations in Codebase

Check these existing pages to see the live pattern in action:
- **Landing Page:** [Index.cshtml](file:///c:/Users/ghaith/Desktop/New%20folder%20%282%29/Backupway2/WebApplication1/Pages/Index.cshtml)
- **Authentication:** [Account/Login.cshtml](file:///c:/Users/ghaith/Desktop/New%20folder%20%282%29/Backupway2/WebApplication1/Pages/Account/Login.cshtml)
- **Executive Administration:** [Admin/Index.cshtml](file:///c:/Users/ghaith/Desktop/New%20folder%20%282%29/Backupway2/WebApplication1/Pages/Admin/Index.cshtml)
- **Company Management:** [Company/Dashboard.cshtml](file:///c:/Users/ghaith/Desktop/New%20folder%20%282%29/Backupway2/WebApplication1/Pages/Company/Dashboard.cshtml)
- **Agent Memory Rule:** [.agents/rules/bridgeway-ui-design-system.md](file:///c:/Users/ghaith/Desktop/New%20folder%20%282%29/.agents/rules/bridgeway-ui-design-system.md)
