## PSF Design Lab – UI/UX Simplification Notes

### Target userbase

- **HCI / AI-safety researchers**: Comfortable with PSF concepts, metrics, and multi-tab interfaces. Current feature set is appropriate.
- **AI product / UX designers**: Comfortable with conceptual frameworks and dashboards, but not raw math. Need clear language and progressive disclosure.
- **Advanced students / practitioners**: Can handle the concepts with guidance, but are sensitive to clutter and jargon.

### Goals

- Keep **all existing features** (profiles, probes, T/C/L, modifiers, entropy, rationale, tabs).
- Make the **default experience feel simple and guided**, even for students.
- Use **progressive disclosure** (basic vs advanced sections) instead of removing capabilities.

---

### 1. Step-based layout for the Assess tab

Reframe Assess as three explicit steps:

- **Step 1: Describe your system (System profile)**
  - Add helper text: “Describe the AI surface you’re evaluating. We’ll use this to interpret PSF scores in context (domain, stakes, and users).”
  - Slight label tweaks:
    - System name → “System name (for your own reference)”
    - Domain → “Domain / task (e.g., coding tutor, triage bot)”
    - Stakes → “Stakes of mistakes” (Low/Medium/High)
    - Target user expertise → “Typical user expertise”

- **Step 2: Run a probe (Probing interactions)**
  - Heading: “Step 2 · Probing interactions”.
  - Helper: “Choose one of the probes or write your own to test how predictable the system feels for a typical task.”

- **Step 3: Read the assessment (PSF assessment)**
  - Heading: “Step 3 · PSF assessment”.
  - Helper: “We estimate the system’s level and T/C/L for this probe; advanced metrics and rationale are shown below.”

---

### 2. Advanced options as foldable sections

Use accordions / collapsible sections to hide technical controls until needed:

- Under **System profile**:
  - Keep visible:
    - System name
    - Domain / task
    - Stakes
    - Typical user expertise
  - Add an **“Advanced assumptions”** accordion containing:
    - **Intended PSF level** (slider)
      - Helper: “Optional: where you *want* this surface to land (1 = fully predictable, 5 = highly open-ended). Used for comparison, not for scoring.”
    - **Expected dimensions (T/C/L)** sliders
      - Helper: “Optional: your own guess for T/C/L. Useful for comparing perceived vs measured predictability.”
    - **Key modifier traits** (O/I/S/A chips)
      - Helper: “Optional: which levers you plan to use (e.g., more observability via confidence badges, more controllability via an interrupt button).”

- Under **Probing interactions**:
  - Keep visible:
    - Canonical probe buttons (Repeatability, Uncertainty, Learnability)
    - Custom probe prompt
  - Place the **sampled outputs** text area in an **“Advanced: entropy / variation”** accordion:
    - Helper: “Paste a few distinct outputs from the underlying AI system (one per line) to compute temporal entropy and variation rate.”

---

### 3. Tooltips for confusing concepts

Add small `?` tooltips with 1-line explanations:

- **System profile**
  - “A compact description of the AI surface (who it’s for, domain, stakes). We use this to tailor modifiers and guidance.”

- **Probing interactions**
  - “Scenario tests you run against the system (repeatability, uncertainty, learnability) to see how it behaves on the PSF.”

- **Intended PSF level**
  - “Where you *intend* this surface to sit on the spectrum. Useful for design targets (e.g., you want Level 2 for a simple assistant).”

- **Expected dimensions (T/C/L)**
  - “Your own guess at Temporal / Confidence / Learning predictability before measuring. Lets you see gaps between expectation and measured behavior.”

---

### 4. Group and label advanced metrics and rationale

In the PSF assessment card:

- Keep **Core dimensions** (T/C/L) visually primary.
- Show **Temporal metrics** (entropy, variation) under a caption like:
  - “Temporal metrics (advanced)” so casual users know they can ignore if needed.
- Show rationale under:
  - “Why this assessment?” with:
    - One-line overall rationale.
    - Optional per-dimension rationale (T/C/L).
    - Chips for textual cues (e.g., “uncertainty phrases”, “inconsistent corrections”).

Result: researchers still see all the details they care about, but students and designers are guided toward the main flow (Steps 1–3) and can opt into advanced pieces only when needed.


