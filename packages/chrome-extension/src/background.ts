import type { CapturedElementData, ExtMessage } from '@chrome-agent-bridge/shared';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SendResult {
  success: boolean;
  id?: string;
  error?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CAPTURE_ENDPOINT = 'http://localhost:19816/capture';

// ─── State ───────────────────────────────────────────────────────────────────

let selectorActive = false;

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * HTTP POST captured element data to the MCP Server.
 */
export async function sendToServer(data: CapturedElementData): Promise<SendResult> {
  try {
    const response = await fetch(CAPTURE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, id: result.id };
    }

    const errorBody = await response.json().catch(() => null);
    const errorMsg = errorBody?.error || `HTTP ${response.status}`;
    return { success: false, error: errorMsg };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown network error';
    return { success: false, error: message };
  }
}

/**
 * Inject the content script into the given tab if not already injected.
 */
export async function injectContentScript(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (err) {
    console.error('[Chrome-Agent Bridge] Failed to inject content script:', err);
    throw err;
  }
}

/**
 * Update the extension badge text and color.
 */
export function updateBadge(status: string): void {
  const badgeConfig: Record<string, { text: string; color: string }> = {
    active: { text: 'ON', color: '#4A90D9' },
    success: { text: '✓', color: '#4CAF50' },
    error: { text: '✗', color: '#F44336' },
    idle: { text: '', color: '#999999' },
  };

  const config = badgeConfig[status] || badgeConfig['idle']!;
  chrome.action.setBadgeText({ text: config.text });
  chrome.action.setBadgeBackgroundColor({ color: config.color });
}

/**
 * Notify both the content script (in the active tab) and any open popup
 * about the send result.
 */
async function notifySendResult(result: SendResult): Promise<void> {
  const sendResultMsg: ExtMessage = {
    type: 'SEND_RESULT',
    payload: result,
  };

  // Notify popup (and any other extension pages)
  chrome.runtime.sendMessage(sendResultMsg).catch(() => {
    // Popup may not be open — that's fine
  });

  // Notify content script in the active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, sendResultMsg).catch(() => {
        // Content script may not be injected — that's fine
      });
    }
  } catch {
    // No active tab available
  }
}

/**
 * Unified message router for all extension messages.
 */
export async function handleMessage(
  msg: ExtMessage | { type: string; [key: string]: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const tabId = sender.tab?.id;

  switch (msg.type) {
    case 'ACTIVATE_SELECTOR': {
      selectorActive = true;
      updateBadge('active');

      // Get the active tab to inject and forward the message
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await injectContentScript(tab.id);
          chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_SELECTOR' } satisfies ExtMessage);
        }
      } catch (err) {
        console.error('[Chrome-Agent Bridge] Failed to activate selector:', err);
      }
      break;
    }

    case 'DEACTIVATE_SELECTOR': {
      selectorActive = false;
      updateBadge('idle');

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'DEACTIVATE_SELECTOR' } satisfies ExtMessage);
        }
      } catch {
        // Tab may not be available
      }
      break;
    }

    case 'ELEMENT_CAPTURED': {
      const payload = (msg as Extract<ExtMessage, { type: 'ELEMENT_CAPTURED' }>).payload;

      const result = await sendToServer(payload);

      // Update badge based on result
      updateBadge(result.success ? 'success' : 'error');

      // Notify content script and popup
      await notifySendResult(result);
      break;
    }

    case 'STATUS_REQUEST': {
      sendResponse({ selectorActive });
      return true; // Keep the message channel open for sendResponse
    }

    case 'CAPTURE_SCREENSHOT': {
      // Handle screenshot request from content script
      try {
        const senderTabId = tabId;
        if (!senderTabId) {
          sendResponse({ error: 'No tab ID available' });
          return true;
        }
        const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
        sendResponse({ dataUrl });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Screenshot capture failed';
        sendResponse({ error: message });
      }
      return true; // Keep the message channel open for async sendResponse
    }
  }

  return false;
}

// ─── Message Listener Registration ──────────────────────────────────────────

// Extension icon click — inject content script and toggle panel
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await injectContentScript(tab.id);
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' } satisfies ExtMessage);
  } catch (err) {
    console.error('[Chrome-Agent Bridge] Failed to toggle panel:', err);
  }
});

chrome.runtime.onMessage.addListener(
  (
    message: ExtMessage | { type: string },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    // handleMessage is async, so we need to return true for async responses
    const result = handleMessage(message, sender, sendResponse);

    // For STATUS_REQUEST and CAPTURE_SCREENSHOT, we return true synchronously
    // to keep the message channel open. For others, we don't need sendResponse.
    if (message.type === 'STATUS_REQUEST' || message.type === 'CAPTURE_SCREENSHOT') {
      return true;
    }

    // For async message types (ELEMENT_CAPTURED, ACTIVATE_SELECTOR, etc.),
    // we don't use sendResponse, so returning false is fine.
    return false;
  },
);
