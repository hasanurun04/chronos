// Relay messages from TryRating content script to Chronos bridge script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CHRONOS_AUTO_TRACK') {
    // Broadcast the message to all tabs that might be running Chronos
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        // Only send to local/file tabs or known chronos paths
        if (tab.url && (tab.url.includes('chronos_v2/index.html') || tab.url.includes('chronos-hasan-urun.netlify.app') || tab.url.includes('127.0.0.1') || tab.url.includes('localhost'))) {
          chrome.tabs.sendMessage(tab.id, request).catch(() => {});
        }
      }
    });
  } else if (request.type === 'FROM_CHRONOS_PAGE') {
    // Broadcast Chronos state updates (like total time) to TryRating content scripts
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.url && tab.url.includes('tryrating.com')) {
          chrome.tabs.sendMessage(tab.id, request).catch(() => {});
        }
      }
    });
  }
});
