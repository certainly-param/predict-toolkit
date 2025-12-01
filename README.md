## Predictability Spectrum Toolkit

This folder will host the implementation of the Predictability Spectrum Toolkit (web app + shared core, and later the Chrome extension).

Planned structure:

- `core/` — shared predictability classifier and design-guidance engine (TypeScript/Node).
- `api/` — Node/Express service that exposes the classifier and design guidance over HTTP.
- `web/` — Material 3–styled web toolkit (React + TypeScript, Vite + MUI).
- `extension/` — Chrome extension UI that talks to the shared core via the API.

Implementation will follow Material 3 design patterns similar to the PAIR Guidebook interface and the roadmap in `hci-paper/TOOLKIT_EXTENSION_PLAN.md`.


