# Project Plan: Login UI Redesign

## Context
- **User Request:** Redesign the login page to match a provided minimalist, card-based screenshot, featuring a form on the left and a robot hero image on the right.
- **Mode:** PLANNING ONLY
- **Target:** `src/app/login/page.tsx`, `src/app/globals.css` (if necessary for background gradients).

## Task Breakdown

### 1. Structure & Layout Updates (`src/app/login/page.tsx`)
- **Background Container:** Change the full-screen split layout to a centered, floating card layout on a soft gradient or solid light background.
- **Floating Card:**
  - Create a central wrapper with `max-w-5xl`, `w-full`, `rounded-3xl` or similar, `shadow-2xl`, and `flex` (row on desktop, column on mobile).
  - Ensure the card has a white background for the left pane and hides overflow (`overflow-hidden`).
- **Left Column (Form):**
  - Adjust padding to match the airy feel of the screenshot (`p-12` or `p-16`).
  - **Header:** Center the Agentergroup logo, title ("Get started with Agentergroup" or dynamic based on login/signup state), and subtitle.
  - **Form:** 
    - Email input field with a clean, slightly rounded border (`rounded-md` or `rounded-lg`).
    - Change the primary "Sign In" button to be solid black (`bg-black text-white hover:bg-gray-800`).
    - Keep the "or continue with email" divider (or adjust text to just "OR").
  - **OAuth:** Keep the "Continue with Google" button but style it to match the clean outline button in the screenshot.
  - **Footer Links:** Center the "Don't have an account? Sign up" text and move the Terms/Privacy policy text to the absolute bottom of the left column.
- **Right Column (Hero Image):**
  - Add a right pane that takes up `w-1/2` (hidden on small screens).
  - Use the provided image URL (`https://pixabay.com/images/download/stocksnap-robot-2587571_1920.jpg`) as a responsive `next/image` or standard `<img>` with `object-cover` and full height (`h-full`).

### 2. Style Adjustments (`src/app/globals.css` & Tailwind Classes)
- **Buttons:** Ensure the primary button is stark black/white to match the minimalist aesthetic, moving away from the previous orange (`#ff5c00`) primary color for this specific page, or keeping the orange if it's strict branding, but the user explicitly said "make ours like that" (which has a black button). I will default to black to match the screenshot, but retain the orange logo.
- **Background:** Add a subtle gradient background to the main `main` element to help the white card pop, similar to the screenshot's soft pink/white gradient.

### 3. Agent Assignments
- **Frontend Specialist:** Execute the React component structure updates in `page.tsx` and styling adjustments to ensure pixel-perfect matching of spacing, typography, and layout.

### 4. Verification Checklist
- [ ] Card layout is centered and responsive (stacks vertically on mobile).
- [ ] Left side contains the logo, centered headers, left-aligned input, black submit button.
- [ ] Divider is clean and minimalist.
- [ ] Google button is present and styled correctly.
- [ ] Right side features the robot image and fills its container completely.
- [ ] The page looks premium and matches the provided screenshot's aesthetic.

## Notes & Open Questions
- The screenshot shows "Log in with email" (black button) and then "Continue with Google" below the OR divider. Our current flow expects an email *and* password for email login. Should we adapt the design to include the password field, or switch to a magic link (email only) flow? *Assuming we keep the password field for now, just restyled to match.*
