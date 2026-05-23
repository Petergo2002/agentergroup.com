# Plan: Login Portal Redesign

Redesign the login and signup workspace portal (`src/app/login/page.tsx`) to implement an ultra-clean, premium "Notion/Linear" layout. This plan streamlines the interface, simplifies visual elements, fixes input container styling anomalies, and ensures high-fidelity design aesthetics across all viewports.

---

## 📐 Project Type
* **Type:** WEB (Next.js App Router, Tailwind CSS, TypeScript)
* **Lead Specialist Agent:** `@frontend-specialist`
* **Lead Skill:** `frontend-design`

---

## 🎯 Success Criteria
1. **Premium Aesthetics:** Achieve an ultra-clean, minimalist design that feels like Notion or Linear (clean typography, crisp borders, solid backdrops).
2. **Simplified Visuals:** Replace the complex multi-node flowchart with a single, premium Workspace Mockup card on the left panel.
3. **No Autofill Anomalies:** Clean up form input container styling so that browser autofills do not create bulky blue/purple container fills.
4. **Fluid Micro-Interactions:** Add smooth CSS transitions and physical feedback on buttons, inputs, and SSO triggers.
5. **A11y & Contrast Compliance:** Ensure proper keyboard navigation, label-input bindings, and pass the `ux_audit.py` checklist.
6. **Codebase Stability:** Maintain 100% type safety and zero ESLint errors/warnings.

---

## 🛠️ Tech Stack
* **Framework:** Next.js 15 (App Router)
* **Styling:** Tailwind CSS v4 (configured with CSS theme variables)
* **Icons:** Lucide React
* **Languages:** TypeScript, English/Swedish (i18n integrated via `messages.login`)

---

## 📁 File Structure

The redesign primarily affects a single high-impact file:
* 🌐 `src/app/login/page.tsx` - Core page component representing the auth visual portal.

---

## 📋 Task Breakdown

### Phase 1: Interactive Workspace Mockup (Left Panel)
* **Task ID:** `login-left-panel-redesign`
* **Agent:** `frontend-specialist`
* **Skill:** `frontend-design`
* **Priority:** P1
* **Dependencies:** None
* **Description:** Replace the retro-futuristic dashed-line flowchart with a highly elegant "Interactive Workspace Preview" card.
* **INPUT:** Current flowchart node markup in `src/app/login/page.tsx`.
* **OUTPUT:** A pristine obsidian canvas (`#050505`) containing a single floating glass card showing active AI Agent statuses and a minimal typewriter terminal execution prompt.
* **VERIFY:** Check visually that the left panel has generous negative space, crisp typography, and look-and-feel of a premium developer editor.

### Phase 2: High-Precision Form inputs (Right Panel)
* **Task ID:** `login-right-form-redesign`
* **Agent:** `frontend-specialist`
* **Skill:** `frontend-design`
* **Priority:** P1
* **Dependencies:** None
* **Description:** Clean up input containers and SSO buttons to achieve Linear/Notion perfection.
* **INPUT:** Bulky input fields and basic SSO button layouts in `src/app/login/page.tsx`.
* **OUTPUT:**
  * SSO buttons (Google & GitHub) with thin precise borders and subtle shadows.
  * Inputs with flat white/near-black backdrops, elegant micro-shadows, and orange theme focus rings: `focus:border-primary/50 focus:ring-2 focus:ring-primary/10`.
  * Brand orange primary button (`bg-primary text-white hover:bg-primary-container font-bold`) instead of white button.
* **VERIFY:** Confirm browser autofill does not render inputs with weird background fills, and that hover spring animations operate correctly.

### Phase 3: Final Quality & UX Audit
* **Task ID:** `login-final-audit`
* **Agent:** `frontend-specialist`
* **Skill:** `lint-and-validate`
* **Priority:** P2
* **Dependencies:** `login-left-panel-redesign`, `login-right-form-redesign`
* **Description:** Perform lint checking, TypeScript type checking, and automated UX validation checks.
* **INPUT:** Completed login page implementation.
* **OUTPUT:** Zero compile warnings and passed verification suite.
* **VERIFY:** Run `npm run lint`, `npx tsc --noEmit`, and the UX audit script.

---

## 🏁 Phase X: Final Verification

> [!IMPORTANT]
> **Definition of Done Checklist**
> Before completing the task, the following verifications must pass:

### 1. Build & Lint Check
```bash
npm run lint && npx tsc --noEmit && npm run build
```

### 2. Automated UX & Accessibility Check
```bash
python .agent/skills/frontend-design/scripts/ux_audit.py .
```

### 3. Visual Checks (Manual)
* [ ] No purple/violet hex codes present in styling.
* [ ] Socratic Gate was fully respected.
* [ ] Mobile, tablet, and desktop viewports scale beautifully.
* [ ] Inputs have solid, elegant neutral backgrounds and focus indicators.
