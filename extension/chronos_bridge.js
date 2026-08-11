// This script is injected into Chronos pages (index.html)
// It acts as a bridge between the extension background script and the web page's window object.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CHRONOS_AUTO_TRACK' || request.type === 'CHRONOS_SYNC_STATS') {
    // Forward the message to the web page context so index.html can read it
    window.postMessage({
      type: 'FROM_CHRONOS_EXTENSION',
      action: request.action,
      payload: request.payload
    }, '*');
  }
});

// Also listen to messages from the page to send to background
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FROM_CHRONOS_PAGE') {
    chrome.runtime.sendMessage(event.data);
  }
});
