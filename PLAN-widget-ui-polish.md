# Widget V2 UI/UX Polish Plan

The goal of this project is to fix UI inconsistencies, simplify the design, and give the AgenterGroup Widget V2 a more modern, premium vibe.

## 🔴 User Review Required & Open Questions

Innan vi går vidare och börjar koda, vänligen svara på dessa frågor så att jag kan anpassa designen precis så som du vill ha den:

> [!IMPORTANT]
> **Frågor (Socratic Gate):**
> 1. **Färger och Tema (Premium Vibe):** Vill du att vi fortsätter med den nuvarande dark-mode premium-känslan (svart bakgrund med starka brand-färger) eller vill du ha en mer "glassmorphism" (frostad glas-effekt) look som är väldigt populär för premium modern UI?
> 2. **Animationer:** Ska vi introducera mer subtila och mjuka micro-animationer när man hovrar över agenter och knappar (snarare än de hårda skugg-övergångarna som finns nu)?
> 3. **Rundade Hörn:** För närvarande blandas ganska runda element (buttons) med skarpare kort. Föredrar du en konsekvent "helrundad" (pill-shape) look eller "rundade hörn" (typ Apple/iOS-smidig)?

## 📋 Overview
- **Project Type:** WEB (Widget)
- **Primary Agent:** `frontend-specialist`
- **Success Criteria:** A cohesive, ultra-modern look replacing the mismatched hover-states and hard-coded inline Tailwind variables. Consistent contrast, smoother transitions.

## 🛠 Tech Stack
- Frontend: React + Tailwind CSS
- Animation: Framer Motion
- Structure: index.css (custom tokens) + Tailwind classes

## 📁 File Structure Impacted
- `apps/widget-v2/src/index.css`
- `apps/widget-v2/src/components/HomeTab.tsx`
- `apps/widget-v2/src/components/ChatView.tsx`
- `apps/widget-v2/src/components/MessagesTab.tsx`
- `apps/widget-v2/src/Widget.tsx`

---

## 📅 Task Breakdown

### Task 1: Clean up `index.css` & Global Variables
- **Agent:** `frontend-specialist`
- **Skills:** `frontend-design`
- **Plan:** Remove hardcoded custom gradients and replace them with cleaner, semantic Tailwind/CSS variables. Unify the glow effects.
- **INPUT:** `index.css`
- **OUTPUT:** Streamlined CSS file with solid premium tokens.
- **VERIFY:** Check that dev server styles compile and don't break.

### Task 2: Polish `HomeTab.tsx` Inconsistencies
- **Agent:** `frontend-specialist`
- **Skills:** `frontend-design`
- **Plan:**
  - Simplify the "Pick an Agent" list items. Remove complex manual hover shadows and replace with a unified premium hover state.
  - Fix the static "text-white" on avatar and calculate proper contrast from the primary color (so it works with any brand color).
  - Modernize the initial input shell.
- **INPUT:** `HomeTab.tsx`
- **OUTPUT:** Unified start view with premium elements.
- **VERIFY:** Test click interactions visually.

### Task 3: Polish `ChatView.tsx` Inconsistencies
- **Agent:** `frontend-specialist`
- **Skills:** `frontend-design`
- **Plan:**
  - Adjust the message bubbles (especially user bubble) to have softer borders or unified styling with the brand palette.
  - Simplify the chat input shadow/glow.
  - Make the layout feel less clustered at the bottom.
- **INPUT:** `ChatView.tsx`
- **OUTPUT:** Modern message interface.
- **VERIFY:** Verify the chat input states (focus, disabled) in the preview.

### Task 4: Layout & Animation Cohesion 
- **Agent:** `frontend-specialist`
- **Skills:** `frontend-design`
- **Plan:** Adjust the Framer Motion animation values across all files. Ensure spring physics or ease-curves match to create a premium feel instead of rigid linear flows. Update the navigation buttons for the tabs so they feel integrated.
- **INPUT:** Overall components.
- **OUTPUT:** Fluid micro-interactions.
- **VERIFY:** Test switching between views manually.

---

## ✅ Phase X: Verification Plan
1. **Lint Check:** Run `npm run lint` && `npx tsc --noEmit`
2. **Visual Audit:** Visually verify the preview on `WidgetDevicePreview` to confirm the spacing, text contrast, and border-radii are perfectly uniform.
3. **UX Audit:** Run `python .agent/skills/frontend-design/scripts/ux_audit.py` if available.
