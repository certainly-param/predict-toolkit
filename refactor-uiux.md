## PSF Design Lab – UI/UX Refactor Plan

This file captures planned UI/UX refinements, starting with the **landing experience**, before we touch the code. The goal is to keep all existing functionality while making the experience feel simpler and more guided for both researchers and students.

---

## 1. Landing Experience & First-Time Onboarding

### 1.1 Current behavior

- On load, users see the full **Assess** tab immediately:
  - System profile card
  - Probing interactions card
  - PSF assessment card
  - Tabs for Compare / Design / Reflect
  - “How to use this lab” helper card
- This is powerful but visually dense; new users don’t know where to start or what “System profile” and “Probing interactions” mean.

### 1.2 Proposed behavior – dedicated welcome screen

Instead of dropping users directly into Assess, show a **full-screen welcome view** on first load. The underlying Assess/Compare/Design/Reflect UI should **not be visible at all** until the welcome view is dismissed.

- **Welcome card (center of a neutral background)**
  - Title: “Welcome to the PSF Design Toolkit”
  - 1–2 line description, e.g.:
    - “This lab helps you explore how AI systems sit on the Predictability Spectrum — across levels, T/C/L, modifiers, and design implications.”
  - Very short list of what you can do:
    - “Configure a system profile”
    - “Run probes and see PSF levels”
    - “Compare design variants and read guidance”
  - Primary button: **“Let’s get started”**
  - Secondary text link (optional): “Skip intro”

### 1.3 Animation and timing / dismissal

- Use a soft Material-style animation:
  - On first render, the welcome card **fades / grows in** at the center of an otherwise neutral background (no Assess UI visible yet).
  - When the user clicks **“Let’s get started”**:
    - Card **slides slightly upward and fades out**, then the main Assess layout mounts / appears.
- Auto-dismiss:
  - If the user does nothing, the card auto-dismisses after ~5 seconds with the same upward-fade animation, then the Assess layout appears.
  - Clicking the button should always dismiss it immediately (no forced wait).

### 1.4 Interaction pattern

- The **Assess tab layout** is not shown until after the welcome view is dismissed:
  - First, the user sees only the welcome screen on a neutral background.
  - After dismissal, the Assess layout mounts and the user follows the normal 3-step flow (System profile → Probe → PSF assessment).
  - The welcome copy does **not** persist; only the existing “How to use this lab” helper card remains visible under the tabs to remind users of the flow.
- For a class demo:
  - We can choose whether the card appears on **every page load** (simpler, no persistence) or only on **first visit** using localStorage.
  - For now, plan for “always on load” to keep implementation simple, and document the option to gate it by first-visit later.

### 1.5 Rationale

- Reduces initial cognitive load:
  - Users see **one simple object** (the welcome card) instead of 3 cards + tabs + metrics.
  - They get a clear “this is what this tool is for” message before seeing controls.
- Establishes a story:
  - “You are about to explore the Predictability Spectrum for your system” before asking for profiles and probes.
- Keeps all power:
  - As soon as the card dismisses, the full Assess / Compare / Design / Reflect flow is unchanged.

### 1.6 Open design choices to finalize later

- Exact copy for:
  - Title line and 2–3 bullets on the welcome card.
  - Button label (“Let’s get started” vs “Open Assess”).
- Whether to:
  - Always show the card on load, or
  - Only show on first visit using localStorage.
- Whether to:
  - Include a very short inline illustration / icon (e.g., spectrum or radar-like glyph) on the card to visually connect to PSF.

---

## 2. Progressive Reveal of Tabs (Reduce UI Jumping)

### 2.1 Current behavior

- All four tabs (**Assess**, **Compare**, **Design**, **Reflect**) are visible and clickable from the start.
- Users can jump into Compare/Design/Reflect before they have any runs, which:
  - Increases cognitive load (too many options early).
  - Produces semi-empty states that feel confusing (“why is this blank?”).

### 2.2 Proposed behavior – ordered, progressive tab reveal

- Tabs should be **introduced in the order of the intended flow** and only when they make sense:
  1. **Assess**: always visible and selected first.
  2. **Design**: becomes active/visible **after the first successful assessment** (at least one run).
  3. **Compare**: becomes active/visible **after at least two runs** exist (baseline + variant).
  4. **Reflect**: becomes active/visible **after at least one run**, but is conceptually “end-of-loop.”

- Implementation sketch:
  - Start with only **Assess** tab enabled; the others either:
    - Are hidden entirely, or
    - Are shown but disabled with a small label like “(available after first run)”.
  - After the first successful `/api/classify` response:
    - Enable **Design** and **Reflect**.
  - After the second run:
    - Enable **Compare**.

### 2.3 Rationale

- Matches the conceptual loop:
  - **Assess → Design (what-ifs) → Compare → Reflect**, then back to Assess.
- Reduces apparent complexity:
  - New users initially see just one primary action surface (Assess) instead of four competing tabs.
- Avoids “empty” or confusing states:
  - Users won’t land on a tab that has no data context yet.

### 2.4 Open choices

- Whether to:
  - Hide future tabs completely until unlocked, or
  - Show them disabled with short helper text (e.g., tooltip: “Run at least one probe in Assess to unlock Design and Reflect”).

---

## 3. Visual Language & Layout Inspirations

This section captures visual ideas inspired by the example screenshots (welcome screens, Google PAIR guidebook, and hero cards) so we can apply them consistently when styling the PSF Design Lab.

### 3.1 Welcome screen visuals

- **Background**
  - Use a soft **gradient or blurred artwork** as the full-screen background (similar to the example welcome screens).
  - Keep it subtle enough that text in the central card remains clearly legible (slightly desaturated / blurred).

- **Central card**
  - Large rounded rectangle (Material 3 style) centered on the screen.
  - Optional circular icon or abstract PSF glyph at the top (e.g., a spectrum-like disc).
  - Clean typography:
    - Title using MUI `h4/h3` with good line height.
    - Supporting text in `body2`, limited to 1–2 short sentences.
  - Primary button with full-width pill shape (“Let’s get started”).
  - Optional secondary action in caption text (“Already familiar? Skip intro”).

### 3.2 Main lab layout – PAIR-like feel

- **Top navigation**
  - Tabs row should feel like the PAIR “Chapters” nav:
    - Rounded pill-style tabs.
    - Clear “current tab” background (e.g., soft accent).
    - Minimal underline or shadow; rely on color and shape.

- **Cards**
  - Use large, rounded cards with generous padding (similar to PAIR chapter cards).
  - Where possible, pair each major card with:
    - A small geometric or iconographic illustration (e.g., abstract cubes / grids) on the left.
    - A bold title + short description on the right.
  - Ensure consistent spacing and alignment across Assess / Compare / Design / Reflect so the page feels modular rather than cluttered.

### 3.3 Principle / guidance presentation

- Take cues from the PAIR “Principles” page:
  - Use **stacked bands / accordions** with soft background color to present guidance.
  - Each guidance item:
    - A label pill (e.g., “interface”, “trust”, “transition”) similar to the “Updated” tag or principle category tags.
    - A one-line title plus a short explanatory sentence.
  - For Design tab, this styling can make guidance feel like a curated checklist instead of plain text.

### 3.4 Hero-style call-to-actions

- For key actions (e.g., first time in Assess):
  - Consider a **hero card** near the top (“Start a new PSF assessment”) styled like the “Get started” card in the sustainability example:
    - Soft colored background.
    - Simple illustration (e.g., spectrum curve) aligned to one side.
    - Clear primary CTA button leading into Step 1 (System profile).

These notes are purely visual; actual implementation will use MUI components (Cards, Typography, Buttons) and theme tokens to match Material 3 while echoing the examples you provided.



