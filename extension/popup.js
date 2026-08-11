document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggleTracking');
  const statusMsg = document.getElementById('statusMessage');

  // Load the current setting (default is true if not set)
  chrome.storage.local.get(['trackingEnabled'], (result) => {
    const isEnabled = result.trackingEnabled !== false; // default true
    toggle.checked = isEnabled;
    updateStatusText(isEnabled);
  });

  toggle.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.local.set({ trackingEnabled: isEnabled }, () => {
      updateStatusText(isEnabled);
    });
  });

  function updateStatusText(isEnabled) {
    if (isEnabled) {
      statusMsg.textContent = 'Tracking is ACTIVE.';
      statusMsg.style.color = '#00ffaa';
    } else {
      statusMsg.textContent = 'Tracking is PAUSED.';
      statusMsg.style.color = '#ff2244';
    }
  }
});
