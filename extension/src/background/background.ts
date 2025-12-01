// Background service worker for the extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('PSF Design Lab extension installed');
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'classify') {
    // Forward classification request to API
    fetch('http://localhost:4000/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.data),
    })
      .then((res) => res.json())
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));

    return true; // Keep channel open for async response
  }
});

