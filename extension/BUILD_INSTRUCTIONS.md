# Building the Browser Extension

## Prerequisites

1. Node.js and npm installed
2. The API server running on `http://localhost:4000`

## Steps

1. **Install dependencies:**
   ```bash
   cd toolkit/extension
   npm install
   ```

2. **Create icon files:**
   - Create an `icons/` folder in `toolkit/extension/`
   - Add `icon16.png`, `icon48.png`, and `icon128.png` (or use placeholders)

3. **Build the extension:**
   ```bash
   npm run build
   ```

   This creates a `dist/` folder with:
   - `popup.html`, `popup.js` - Extension popup
   - `content.js` - Content script
   - `background.js` - Background service worker
   - `manifest.json` - Extension manifest

4. **Load in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `toolkit/extension/dist` folder
   - The extension icon should appear in your toolbar

5. **Test:**
   - Click the extension icon to open the popup
   - Fill in system profile and probe prompt
   - Click "Analyze" to test the classification

## Development Mode

For development with auto-rebuild:
```bash
npm run watch
```

Then reload the extension in Chrome after each rebuild.

## Troubleshooting

- **API connection errors**: Make sure the API server is running on `http://localhost:4000`
- **Build errors**: Check that all dependencies are installed (`npm install`)
- **Extension not loading**: Check the browser console (`chrome://extensions/` → click "Errors" on your extension)

