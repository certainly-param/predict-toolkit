# PSF Design Lab Browser Extension

A Chrome/Edge browser extension for assessing AI system predictability using the Predictability Spectrum Framework.

## Setup

1. Install dependencies:
```bash
cd toolkit/extension
npm install
```

2. Build the extension:
```bash
npm run build
```

3. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `toolkit/extension/dist` folder

## Development

Watch mode for development:
```bash
npm run watch
```

This will rebuild popup, content, and background scripts when files change.

## Structure

- `src/popup/` - Extension popup UI (React + MUI)
- `src/content/` - Content script for detecting AI interactions
- `src/background/` - Background service worker
- `manifest.json` - Extension manifest (Manifest V3)

## Features

- Quick PSF assessment from browser popup
- System profile configuration
- Probe prompt testing
- Results visualization
- Integration with local API server (http://localhost:4000)

## Notes

- The extension requires the API server to be running locally
- Make sure to update `API_BASE` in `PopupApp.tsx` if your API runs on a different port

