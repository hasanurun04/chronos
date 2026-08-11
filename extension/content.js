let currentRequestId = null;
let widgetTimerInterval = null;
let widgetTotalSeconds = 0;
let lastKnownTotal = "00:00";

function parseERT(timeString) {
  let minutes = 0;
  let seconds = 0;
  const minMatch = timeString.match(/(\d+)\s*m/i);
  if (minMatch) minutes = parseInt(minMatch[1], 10);
  const secMatch = timeString.match(/(\d+)\s*s/i);
  if (secMatch) seconds = parseInt(secMatch[1], 10);
  
  if (minutes === 0 && seconds === 0) {
    const numMatch = timeString.match(/(\d+)/);
    if (numMatch) minutes = parseInt(numMatch[1], 10);
  }
  return minutes + (seconds / 60);
}

// Add try-catch for chrome.runtime to handle extension reloads gracefully
function safeSendMessage(message) {
  try {
    chrome.runtime.sendMessage(message);
  } catch (e) {
    console.error("[Chronos] Send error (Please refresh page):", e);
  }
}

try {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'FROM_CHRONOS_PAGE' && request.action === 'SYNC_STATS') {
      if (request.payload && request.payload.todayTotalFormatted) {
        lastKnownTotal = request.payload.todayTotalFormatted;
        const todaySpan = document.getElementById('chronos-widget-today');
        if (todaySpan) todaySpan.textContent = lastKnownTotal;
      }
    }
  });
} catch (e) {}

function initWidget(taskName, ertValue) {
  removeWidget();
  
  const widget = document.createElement('div');
  widget.id = 'chronos-tracker-widget';
  
  widget.innerHTML = `
    <div id="chronos-widget-header" style="cursor: move; background: #020408; color: #00d4ff; padding: 8px 12px; font-family: monospace; font-size: 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1a3d5c; user-select: none;">
      <span>Chronos Auto Tracker</span>
      <span style="font-size: 14px; opacity: 0.7; cursor: nwse-resize;">↘</span>
    </div>
    <div style="padding: 12px; background: #050c14; color: #c8e8f8; font-family: monospace; display: flex; flex-direction: column; gap: 8px; height: calc(100% - 33px);">
      <div style="font-size: 11px; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${taskName}">${taskName}</div>
      <div style="font-size: 32px; font-weight: bold; color: #00ffaa; text-align: center; margin: auto 0;" id="chronos-widget-timer">00:00</div>
      <div style="font-size: 11px; color: #6a9ab8; text-align: center; display: flex; justify-content: space-between;">
        <span>ERT: ${ertValue.toFixed(2)} min</span>
        <span>Today: <strong id="chronos-widget-today" style="color:#00d4ff;">${lastKnownTotal}</strong></span>
      </div>
    </div>
  `;
  
  Object.assign(widget.style, {
    position: 'fixed',
    bottom: '30px',
    right: '30px',
    width: '240px',
    height: '140px',
    zIndex: '999999',
    border: '2px solid #00d4ff',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 12px 32px rgba(0,0,0,0.8)',
    resize: 'both',
    minWidth: '180px',
    minHeight: '120px',
    transition: 'opacity 0.3s'
  });
  
  document.body.appendChild(widget);
  
  const header = widget.querySelector('#chronos-widget-header');
  let isDragging = false, startX, startY, initialX, initialY;
  
  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = widget.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    widget.style.bottom = 'auto';
    widget.style.right = 'auto';
    widget.style.left = initialX + 'px';
    widget.style.top = initialY + 'px';
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    widget.style.left = (initialX + (e.clientX - startX)) + 'px';
    widget.style.top = (initialY + (e.clientY - startY)) + 'px';
  });
  document.addEventListener('mouseup', () => isDragging = false);
  
  widgetTotalSeconds = Math.round(ertValue * 60);
  const timerDisplay = widget.querySelector('#chronos-widget-timer');
  
  clearInterval(widgetTimerInterval);
  widgetTimerInterval = setInterval(() => {
    widgetTotalSeconds--;
    const isNegative = widgetTotalSeconds < 0;
    const absSecs = Math.abs(widgetTotalSeconds);
    const m = Math.floor(absSecs / 60);
    const s = absSecs % 60;
    timerDisplay.textContent = (isNegative ? "-" : "") + `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (isNegative) timerDisplay.style.color = 'var(--danger, #ff2244)';
  }, 1000);
}

function removeWidget() {
  const w = document.getElementById('chronos-tracker-widget');
  if (w) w.remove();
  clearInterval(widgetTimerInterval);
}

function checkTaskState() {
  // Use innerText for foolproof text extraction
  const text = document.body.innerText || document.body.textContent || "";
  
  const reqMatch = text.match(/Request ID\s+(\d{8,12})/i);
  const newReqId = reqMatch ? reqMatch[1] : null;

  if (newReqId && newReqId !== currentRequestId) {
    currentRequestId = newReqId;
    
    const typeMatch = text.match(/Task Type\s+(.*?)\s+Estimated Rating Time/i);
    let taskName = typeMatch ? typeMatch[1].trim() : "TryRating Task";
    if (taskName.length > 50) taskName = taskName.substring(0, 50) + "...";
    
    let ertValue = 1;
    const ertMatch = text.match(/Estimated Rating Time\s+([\d\s]+(min|sec)[a-z\s]*(\d+\s*sec[a-z]*)?|\d+)/i);
    if (ertMatch) {
      ertValue = parseERT(ertMatch[1]);
      if (ertValue <= 0) ertValue = 1;
    }

    console.log(`[Chronos] Tracking: ${taskName} (ERT: ${ertValue}) ID: ${currentRequestId}`);
    initWidget(taskName, ertValue);
    
    // Changed key to _v4 to force it to send even if they are stuck on the same task from a previous refresh
    const trackedId = sessionStorage.getItem('chronos_tracked_id_v4');
    if (trackedId !== currentRequestId) {
      sessionStorage.setItem('chronos_tracked_id_v4', currentRequestId);
      safeSendMessage({
        type: 'CHRONOS_AUTO_TRACK',
        action: 'TASK_STARTED',
        payload: { id: currentRequestId, name: taskName, ert: ertValue }
      });
    }
  }
}

document.addEventListener('click', (e) => {
  let target = e.target;
  while (target && target !== document.body) {
    const text = target.textContent || target.innerText || "";
    if ((text.trim() === 'Submit Rating' || text.trim() === 'Submit Rating and Pause') && 
        (target.tagName === 'BUTTON' || target.tagName === 'SPAN' || target.tagName === 'A' || target.getAttribute('role') === 'button')) {
      if (currentRequestId) {
        console.log(`[Chronos] Task Submitted: ${currentRequestId}`);
        safeSendMessage({
          type: 'CHRONOS_AUTO_TRACK',
          action: 'TASK_SUBMITTED',
          payload: { id: currentRequestId }
        });
        currentRequestId = null; 
        removeWidget(); 
      }
      break;
    }
    target = target.parentElement;
  }
}, true);

setInterval(checkTaskState, 1000);
console.log('[Chronos Tracker] V4 loaded.');
