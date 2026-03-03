import type { ExtMessage } from '@chrome-agent-bridge/shared';

// ─── Constants ───────────────────────────────────────────────────────────────

const PING_URL = 'http://localhost:19816/ping';

// ─── State ───────────────────────────────────────────────────────────────────

let selecting = false;

// ─── DOM Elements ────────────────────────────────────────────────────────────

const statusIndicator = document.getElementById('status-indicator')!;
const statusText = document.getElementById('status-text')!;
const toggleBtn = document.getElementById('toggle-btn') as HTMLButtonElement;
const resultSection = document.getElementById('result-section')!;
const resultText = document.getElementById('result-text')!;

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Check if the MCP Server is online via HTTP GET /ping.
 */
export async function checkServerStatus(): Promise<boolean> {
  try {
    const response = await fetch(PING_URL, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Toggle the element selector mode on/off.
 * Sends ACTIVATE_SELECTOR or DEACTIVATE_SELECTOR to the Background SW.
 */
export function toggleSelector(): void {
  selecting = !selecting;

  const message: ExtMessage = selecting
    ? { type: 'ACTIVATE_SELECTOR' }
    : { type: 'DEACTIVATE_SELECTOR' };

  chrome.runtime.sendMessage(message);

  toggleBtn.textContent = selecting ? '停止选择' : '开始选择';
  toggleBtn.classList.toggle('active', selecting);
}

/**
 * Update the connection status indicator in the UI.
 */
export function renderStatus(online: boolean): void {
  statusIndicator.classList.toggle('online', online);
  statusIndicator.classList.toggle('offline', !online);
  statusText.textContent = online ? 'MCP Server 在线' : 'MCP Server 离线';
}

// ─── Initialization ──────────────────────────────────────────────────────────

toggleBtn.addEventListener('click', toggleSelector);

// Check current selector state from background
chrome.runtime.sendMessage(
  { type: 'STATUS_REQUEST' } satisfies ExtMessage,
  (response: { selectorActive?: boolean } | undefined) => {
    if (response?.selectorActive) {
      selecting = true;
      toggleBtn.textContent = '停止选择';
      toggleBtn.classList.add('active');
    }
  },
);

// Check server status on popup open
checkServerStatus().then(renderStatus);

// ─── Listen for SEND_RESULT messages ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtMessage) => {
  if (message.type === 'SEND_RESULT') {
    const { success, id, error } = message.payload;

    resultSection.classList.remove('hidden');

    if (success) {
      resultText.textContent = `✓ 发送成功 (${id})`;
      resultText.className = 'result-text success';
    } else {
      resultText.textContent = `✗ 发送失败: ${error}`;
      resultText.className = 'result-text error';
    }

    // Reset selector state after capture completes
    selecting = false;
    toggleBtn.textContent = '开始选择';
    toggleBtn.classList.remove('active');
  }
});
