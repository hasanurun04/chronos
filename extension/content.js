let currentRequestId = null;
let widgetTimerInterval = null;
let widgetTotalSeconds = 0;
let lastKnownTotal = "00:00";
let isTrackingEnabled = true;

try {
  chrome.storage.local.get(['trackingEnabled'], (res) => {
    if (res.trackingEnabled === false) isTrackingEnabled = false;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.trackingEnabled !== undefined) {
      isTrackingEnabled = changes.trackingEnabled.newValue;
      if (!isTrackingEnabled) {
        removeWidget();
        currentRequestId = null;
      }
    }
  });
} catch (e) {}

function parseERT(timeString) {
  let minutes = 0;
  let seconds = 0;
  const minMatch = timeString.match(/([\d\.]+)\s*m/i);
  if (minMatch) minutes = parseFloat(minMatch[1]);
  const secMatch = timeString.match(/(\d+)\s*s/i);
  if (secMatch) seconds = parseInt(secMatch[1], 10);
  
  if (minutes === 0 && seconds === 0) {
    const numMatch = timeString.match(/([\d\.]+)/);
    if (numMatch) minutes = parseFloat(numMatch[1]);
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
  
  const ertMins = Math.floor(ertValue);
  const ertSecs = Math.round((ertValue - ertMins) * 60);
  const ertFormatted = `${ertMins}:${String(ertSecs).padStart(2, '0')}`;
  
  const widget = document.createElement('div');
  widget.id = 'chronos-tracker-widget';
  
  widget.innerHTML = `
    <div id="chronos-widget-header" style="cursor: move; background: #020408; color: #00d4ff; padding: 4px 6px; font-family: monospace; font-size: 10px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #1a3d5c; user-select: none;">
      <span style="word-break: break-word; line-height: 1.2; text-align: left; flex: 1; margin-right: 4px;">Chronos Tracker</span>
      <span style="font-size: 12px; opacity: 0.7; cursor: nwse-resize;">↘</span>
    </div>
    <div style="padding: 6px; background: #050c14; color: #c8e8f8; font-family: monospace; display: flex; flex-direction: column; gap: 4px; flex: 1; overflow: hidden;">
      <div style="font-size: 10px; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${taskName}">${taskName}</div>
      <div style="font-size: 24px; font-weight: bold; color: #00ffaa; text-align: center; margin: auto 0; line-height: 1; display: flex; align-items: center; justify-content: center; height: 100%;" id="chronos-widget-timer">00:00</div>
      <div style="font-size: 10px; color: #6a9ab8; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px;">
        <span>ERT:${ertFormatted}</span>
        <span style="color:#00d4ff;" id="chronos-widget-today">${lastKnownTotal}</span>
      </div>
    </div>
  `;
  
  const savedWidth = localStorage.getItem('chronos_widget_width') || '140px';
  const savedHeight = localStorage.getItem('chronos_widget_height') || '90px';
  const savedLeft = localStorage.getItem('chronos_widget_left');
  const savedTop = localStorage.getItem('chronos_widget_top');
  
  Object.assign(widget.style, {
    position: 'fixed',
    bottom: (savedLeft && savedTop) ? 'auto' : '20px',
    right: (savedLeft && savedTop) ? 'auto' : '20px',
    left: savedLeft || 'auto',
    top: savedTop || 'auto',
    width: savedWidth,
    height: savedHeight,
    zIndex: '999999',
    border: '1px solid #00d4ff',
    borderRadius: '6px',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
    resize: 'both',
    minWidth: '50px',
    minHeight: '60px',
    display: 'flex',
    flexDirection: 'column'
  });
  
  document.body.appendChild(widget);
  
  // Track resizing
  new ResizeObserver(() => {
    if (widget.style.width) localStorage.setItem('chronos_widget_width', widget.style.width);
    if (widget.style.height) localStorage.setItem('chronos_widget_height', widget.style.height);
  }).observe(widget);
  
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
  
  const mouseMoveHandler = (e) => {
    if (!isDragging) return;
    widget.style.left = (initialX + (e.clientX - startX)) + 'px';
    widget.style.top = (initialY + (e.clientY - startY)) + 'px';
  };
  
  const mouseUpHandler = () => {
    if (isDragging) {
      isDragging = false;
      localStorage.setItem('chronos_widget_left', widget.style.left);
      localStorage.setItem('chronos_widget_top', widget.style.top);
    }
  };
  
  document.addEventListener('mousemove', mouseMoveHandler);
  document.addEventListener('mouseup', mouseUpHandler);
  
  // Save cleanup refs for when widget is removed
  widget._cleanup = () => {
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
  };
  
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
  if (w) {
    if (w._cleanup) w._cleanup();
    w.remove();
  }
  clearInterval(widgetTimerInterval);
}

function checkTaskState() {
  if (!isTrackingEnabled) return;

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
    const ertMatch = text.match(/Estimated Rating Time[^0-9]*?(\d+[\d\s\w\.]*)/i);
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
