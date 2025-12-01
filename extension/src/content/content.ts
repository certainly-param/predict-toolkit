// Content script to detect AI interactions on the page
// This can be extended to automatically capture prompts and responses

console.log('PSF Design Lab content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'capturePageContent') {
    // Extract text content from common AI chat interfaces
    const textContent = document.body.innerText;
    sendResponse({ content: textContent.substring(0, 1000) }); // Limit to 1000 chars
  }
  return true;
});

// Auto-detect common AI chat patterns (ChatGPT, Claude, etc.)
function detectAIChat() {
  // This is a placeholder - can be extended with specific selectors
  const chatSelectors = [
    '[data-testid*="message"]',
    '.message',
    '.chat-message',
    '[role="article"]',
  ];

  for (const selector of chatSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`Detected potential AI chat interface: ${selector}`);
      return Array.from(elements).map((el) => el.textContent || '').join('\n');
    }
  }

  return null;
}

// Expose detection function
(window as any).psfDetectAI = detectAIChat;

