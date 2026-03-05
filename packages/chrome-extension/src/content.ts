import type { CapturedElementData, CSSRuleInfo, ExtMessage } from '@chrome-agent-bridge/shared';

// ─── State ───────────────────────────────────────────────────────────────────

let selectorActive = false;
let currentTarget: Element | null = null;
let panelVisible = false;

// ─── Floating Panel (Shadow DOM) ─────────────────────────────────────────────

const PANEL_HOST_ID = '__cab-panel-host';
const PING_URL = 'http://localhost:19816/ping';

let panelHost: HTMLDivElement | null = null;
let panelShadow: ShadowRoot | null = null;
let panelStatusDot: HTMLSpanElement | null = null;
let panelStatusText: HTMLSpanElement | null = null;
let panelToggleBtn: HTMLButtonElement | null = null;
let panelResultEl: HTMLDivElement | null = null;
let panelMinimized = false;
let panelDragOffset = { x: 0, y: 0 };
let panelDragging = false;

const PANEL_CSS = `
  :host {
    all: initial;
    position: fixed;
    z-index: 2147483646;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes panelIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes panelOut {
    from { opacity: 1; transform: scale(1); }
    to   { opacity: 0; transform: scale(0.96); }
  }
  @keyframes fabIn {
    from { opacity: 0; transform: scale(0.5); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
    50%      { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
  }
  @keyframes statusPulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.5; }
  }
  @keyframes ripple {
    from { transform: scale(1); opacity: 0.5; }
    to   { transform: scale(2.5); opacity: 0; }
  }

  .panel {
    width: 264px;
    background: rgba(17, 17, 20, 0.88);
    backdrop-filter: blur(24px) saturate(1.4);
    -webkit-backdrop-filter: blur(24px) saturate(1.4);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    color: #e4e4e7;
    font-size: 13px;
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.3),
      0 8px 40px rgba(0,0,0,0.45),
      0 2px 8px rgba(0,0,0,0.2);
    overflow: hidden;
    user-select: none;
    animation: panelIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 14px;
    cursor: grab;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.02);
  }
  .header:active { cursor: grabbing; }
  .header-left {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .logo {
    width: 20px;
    height: 20px;
    border-radius: 6px;
    flex-shrink: 0;
    object-fit: contain;
  }
  .title {
    font-size: 12.5px;
    font-weight: 600;
    color: #fafafa;
    letter-spacing: 0.02em;
  }
  .header-actions {
    display: flex;
    gap: 2px;
  }
  .icon-btn {
    width: 26px;
    height: 26px;
    border: none;
    background: transparent;
    color: #71717a;
    border-radius: 7px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    transition: all 0.15s ease;
  }
  .icon-btn:hover {
    background: rgba(255,255,255,0.07);
    color: #d4d4d8;
  }
  .icon-btn:active {
    transform: scale(0.9);
  }

  .body { padding: 14px 14px 16px; }

  .status-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #3f3f46;
    flex-shrink: 0;
    transition: all 0.4s ease;
  }
  .status-dot.online {
    background: #22c55e;
    box-shadow: 0 0 8px rgba(34,197,94,0.6);
    animation: pulse 2s ease-in-out infinite;
  }
  .status-dot.checking {
    animation: statusPulse 1s ease-in-out infinite;
    background: #a1a1aa;
  }
  .status-text {
    font-size: 11.5px;
    color: #a1a1aa;
    letter-spacing: 0.01em;
  }

  .select-btn {
    width: 100%;
    padding: 10px 0;
    border: none;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    color: #fff;
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    box-shadow: 0 2px 12px rgba(34,197,94,0.25);
    letter-spacing: 0.02em;
    position: relative;
    overflow: hidden;
  }
  .select-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(34,197,94,0.35);
  }
  .select-btn:active {
    transform: translateY(0) scale(0.98);
  }
  .select-btn.active {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    box-shadow: 0 2px 12px rgba(239,68,68,0.25);
  }
  .select-btn.active:hover {
    box-shadow: 0 4px 20px rgba(239,68,68,0.35);
  }

  .result {
    margin-top: 12px;
    padding: 9px 12px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
    display: none;
    animation: panelIn 0.2s ease both;
    letter-spacing: 0.01em;
  }
  .result.show { display: block; }
  .result.success {
    background: rgba(34,197,94,0.1);
    border: 1px solid rgba(34,197,94,0.15);
    color: #4ade80;
  }
  .result.error {
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.15);
    color: #f87171;
  }

  .fab {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: rgba(17, 17, 20, 1);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0);
    cursor: grab;
    box-shadow:
      0 4px 20px rgba(0,0,0,0.35),
      0 0 0 1px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    animation: fabIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
    padding: 0;
  }
  .fab:hover {
    transform: scale(1.1);
    box-shadow:
      0 6px 28px rgba(0,0,0,0.45),
      0 0 0 1px rgba(255,255,255,0.1);
  }
  .fab:active { cursor: grabbing; transform: scale(1.05); }
`;

// ─── Panel Functions ─────────────────────────────────────────────────────────

function createPanel(): void {
  if (panelHost) return;

  panelHost = document.createElement('div');
  panelHost.id = PANEL_HOST_ID;
  panelHost.style.cssText = 'position:fixed;top:24px;right:24px;z-index:2147483646;';

  panelShadow = panelHost.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  panelShadow.appendChild(style);

  renderPanelExpanded();
  document.documentElement.appendChild(panelHost);

  // Check server status
  checkServerStatus();
}

function renderPanelExpanded(): void {
  if (!panelShadow) return;

  // Remove existing content (keep style)
  const style = panelShadow.querySelector('style');
  panelShadow.innerHTML = '';
  if (style) panelShadow.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'panel';

  // Header
  const header = document.createElement('div');
  header.className = 'header';
  header.innerHTML = `
    <div class="header-left">
      <img class="logo" src="${chrome.runtime.getURL('images/logo.png')}" alt="logo" />
      <span class="title">Agent Bridge</span>
    </div>
    <div class="header-actions">
      <button class="icon-btn minimize-btn" title="收起">─</button>
      <button class="icon-btn close-btn" title="关闭">✕</button>
    </div>
  `;

  // Drag support
  header.addEventListener('mousedown', onPanelDragStart);

  // Minimize
  header.querySelector('.minimize-btn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    panelMinimized = true;
    renderPanelMinimized();
  });

  // Close
  header.querySelector('.close-btn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    hidePanel();
  });

  // Body
  const body = document.createElement('div');
  body.className = 'body';

  // Status row
  const statusRow = document.createElement('div');
  statusRow.className = 'status-row';
  panelStatusDot = document.createElement('span');
  panelStatusDot.className = 'status-dot';
  panelStatusText = document.createElement('span');
  panelStatusText.className = 'status-text';
  panelStatusText.textContent = '检测中...';
  statusRow.appendChild(panelStatusDot);
  statusRow.appendChild(panelStatusText);

  // Toggle button
  panelToggleBtn = document.createElement('button');
  panelToggleBtn.className = 'select-btn';
  panelToggleBtn.textContent = '开始选择';
  panelToggleBtn.addEventListener('click', onToggleSelector);

  // Update button state if selector is already active
  if (selectorActive) {
    panelToggleBtn.textContent = '停止选择';
    panelToggleBtn.classList.add('active');
  }

  // Result area
  panelResultEl = document.createElement('div');
  panelResultEl.className = 'result';

  body.appendChild(statusRow);
  body.appendChild(panelToggleBtn);
  body.appendChild(panelResultEl);

  panel.appendChild(header);
  panel.appendChild(body);
  panelShadow.appendChild(panel);
}

function renderPanelMinimized(): void {
  if (!panelShadow) return;

  const style = panelShadow.querySelector('style');
  panelShadow.innerHTML = '';
  if (style) panelShadow.appendChild(style);

  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.title = 'Chrome-Agent Bridge';

  const fabImg = document.createElement('img');
  fabImg.src = chrome.runtime.getURL('images/logo.png');
  fabImg.alt = 'logo';
  fabImg.style.cssText = 'width:28px;height:28px;object-fit:contain;pointer-events:none;border-radius:50%;';
  fab.appendChild(fabImg);

  // Track drag vs click: only expand if mouse barely moved
  let startX = 0;
  let startY = 0;
  let didDrag = false;

  fab.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    didDrag = false;
    onPanelDragStart(e);
  });

  fab.addEventListener('click', () => {
    if (didDrag) return;
    panelMinimized = false;
    renderPanelExpanded();
    checkServerStatus();
  });

  // Detect if mouse moved enough to count as drag
  const onMove = (e: MouseEvent) => {
    if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) {
      didDrag = true;
    }
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  fab.addEventListener('mousedown', () => {
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  panelShadow.appendChild(fab);
}

function showPanel(): void {
  panelVisible = true;
  if (!panelHost) {
    createPanel();
  } else {
    panelHost.style.display = '';
    if (panelMinimized) {
      renderPanelMinimized();
    } else {
      renderPanelExpanded();
      checkServerStatus();
    }
  }
}

function hidePanel(): void {
  panelVisible = false;
  if (selectorActive) {
    deactivateSelector();
  }
  if (panelHost) {
    panelHost.style.display = 'none';
  }
}

function togglePanel(): void {
  if (panelVisible) {
    hidePanel();
  } else {
    showPanel();
  }
}

function onToggleSelector(): void {
  if (selectorActive) {
    deactivateSelector();
  } else {
    activateSelector();
  }
  updatePanelSelectorState();
}

function updatePanelSelectorState(): void {
  if (!panelToggleBtn) return;
  if (selectorActive) {
    panelToggleBtn.textContent = '停止选择';
    panelToggleBtn.classList.add('active');
  } else {
    panelToggleBtn.textContent = '开始选择';
    panelToggleBtn.classList.remove('active');
  }
}

function updatePanelResult(success: boolean, detail: string): void {
  if (!panelResultEl) return;
  panelResultEl.className = success ? 'result show success' : 'result show error';
  panelResultEl.textContent = detail;
}

async function checkServerStatus(): Promise<void> {
  if (panelStatusDot) panelStatusDot.className = 'status-dot checking';
  if (panelStatusText) panelStatusText.textContent = '检测中...';
  try {
    const resp = await fetch(PING_URL, { method: 'GET' });
    setPanelOnline(resp.ok);
  } catch {
    setPanelOnline(false);
  }
}

function setPanelOnline(online: boolean): void {
  if (panelStatusDot) {
    panelStatusDot.classList.remove('checking');
    panelStatusDot.classList.toggle('online', online);
  }
  if (panelStatusText) {
    panelStatusText.textContent = online ? 'MCP Server 在线' : 'MCP Server 离线';
  }
}

// ─── Panel Drag ──────────────────────────────────────────────────────────────

function onPanelDragStart(e: MouseEvent): void {
  // Don't drag if clicking buttons
  if ((e.target as HTMLElement).closest('.icon-btn')) return;

  panelDragging = true;
  const rect = panelHost!.getBoundingClientRect();
  panelDragOffset.x = e.clientX - rect.left;
  panelDragOffset.y = e.clientY - rect.top;

  document.addEventListener('mousemove', onPanelDragMove);
  document.addEventListener('mouseup', onPanelDragEnd);
  e.preventDefault();
}

function onPanelDragMove(e: MouseEvent): void {
  if (!panelDragging || !panelHost) return;
  const x = e.clientX - panelDragOffset.x;
  const y = e.clientY - panelDragOffset.y;
  panelHost.style.left = x + 'px';
  panelHost.style.top = y + 'px';
  panelHost.style.right = 'auto';
  panelHost.style.bottom = 'auto';
}

function onPanelDragEnd(): void {
  panelDragging = false;
  document.removeEventListener('mousemove', onPanelDragMove);
  document.removeEventListener('mouseup', onPanelDragEnd);
}

// ─── Overlay Elements ────────────────────────────────────────────────────────

let overlayBox: HTMLDivElement | null = null;
let overlayLabel: HTMLDivElement | null = null;
let toastEl: HTMLDivElement | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const OVERLAY_ID = '__cab-overlay';
const LABEL_ID = '__cab-label';
const TOAST_ID = '__cab-toast';

function ensureOverlay(): void {
  if (overlayBox) return;

  overlayBox = document.createElement('div');
  overlayBox.id = OVERLAY_ID;
  Object.assign(overlayBox.style, {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: '2147483647',
    border: '2px solid #22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
    borderRadius: '4px',
    transition: 'top 0.08s ease-out, left 0.08s ease-out, width 0.08s ease-out, height 0.08s ease-out, background-color 0.15s ease, border-color 0.15s ease',
    display: 'none',
    boxShadow: '0 0 0 1px rgba(34,197,94,0.1), inset 0 0 0 1px rgba(34,197,94,0.05)',
  } as CSSStyleDeclaration);

  overlayLabel = document.createElement('div');
  overlayLabel.id = LABEL_ID;
  Object.assign(overlayLabel.style, {
    position: 'absolute',
    bottom: '100%',
    left: '0',
    padding: '3px 10px',
    fontSize: '11px',
    fontFamily: 'SF Mono, Menlo, Monaco, Consolas, monospace',
    lineHeight: '18px',
    color: '#fff',
    backgroundColor: 'rgba(22, 163, 74, 0.92)',
    borderRadius: '6px 6px 0 0',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    letterSpacing: '0.02em',
    fontWeight: '500',
    boxShadow: '0 -2px 8px rgba(0,0,0,0.15)',
  });
  overlayLabel.style.setProperty('backdrop-filter', 'blur(8px)');
  overlayLabel.style.setProperty('-webkit-backdrop-filter', 'blur(8px)');

  overlayBox.appendChild(overlayLabel);
  document.documentElement.appendChild(overlayBox);
}

function ensureToast(): void {
  if (toastEl) return;

  toastEl = document.createElement('div');
  toastEl.id = TOAST_ID;
  Object.assign(toastEl.style, {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%) translateY(-12px)',
    padding: '10px 22px',
    fontSize: '13px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: '600',
    color: '#fff',
    borderRadius: '10px',
    zIndex: '2147483647',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.3s cubic-bezier(0.16,1,0.3,1), transform 0.3s cubic-bezier(0.16,1,0.3,1)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)',
    letterSpacing: '0.02em',
  });
  toastEl.style.setProperty('backdrop-filter', 'blur(16px)');
  toastEl.style.setProperty('-webkit-backdrop-filter', 'blur(16px)');

  document.documentElement.appendChild(toastEl);
}

function showToast(message: string, type: 'success' | 'error'): void {
  ensureToast();
  if (!toastEl) return;

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  const bg = type === 'success'
    ? 'rgba(22, 163, 74, 0.9)'
    : 'rgba(220, 38, 38, 0.9)';
  const icon = type === 'success' ? '✓' : '✗';

  toastEl.textContent = `${icon}  ${message}`;
  toastEl.style.backgroundColor = bg;
  toastEl.style.opacity = '1';
  toastEl.style.transform = 'translateX(-50%) translateY(0)';

  toastTimer = setTimeout(() => {
    if (toastEl) {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateX(-50%) translateY(-12px)';
    }
    toastTimer = null;
  }, 2000);
}

// ─── Highlight ───────────────────────────────────────────────────────────────

export function highlightElement(el: Element): void {
  ensureOverlay();
  if (!overlayBox || !overlayLabel) return;

  currentTarget = el;
  const rect = el.getBoundingClientRect();

  Object.assign(overlayBox.style, {
    top: rect.top + 'px',
    left: rect.left + 'px',
    width: rect.width + 'px',
    height: rect.height + 'px',
    display: 'block',
    border: '2px solid #22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
    boxShadow: '0 0 0 1px rgba(34,197,94,0.1), inset 0 0 0 1px rgba(34,197,94,0.05)',
  } as CSSStyleDeclaration);

  // Build label: tagName.class#id  WxH
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = el.classList.length > 0
    ? '.' + Array.from(el.classList).slice(0, 2).join('.')
    : '';
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  overlayLabel.textContent = `${tag}${id}${cls}  ${w}×${h}`;
}

function clearHighlight(): void {
  if (overlayBox) {
    overlayBox.style.display = 'none';
  }
  currentTarget = null;
}

function flashCapture(): void {
  if (!overlayBox) return;

  // Bright flash on capture
  overlayBox.style.backgroundColor = 'rgba(34, 197, 94, 0.3)';
  overlayBox.style.border = '2px solid #4ade80';
  overlayBox.style.boxShadow = '0 0 20px rgba(34,197,94,0.4), inset 0 0 20px rgba(34,197,94,0.1)';

  setTimeout(() => {
    if (overlayBox) {
      overlayBox.style.boxShadow = '';
    }
    clearHighlight();
  }, 350);
}

// ─── Element Selector ────────────────────────────────────────────────────────

function onMouseOver(e: MouseEvent): void {
  e.stopPropagation();
  const target = e.target as Element;
  if (target && target !== overlayBox && target !== overlayLabel && target !== toastEl
      && !panelHost?.contains(target)) {
    highlightElement(target);
  }
}

function onMouseOut(e: MouseEvent): void {
  e.stopPropagation();
  clearHighlight();
}

async function onClick(e: MouseEvent): Promise<void> {
  e.preventDefault();
  e.stopPropagation();
  const target = currentTarget || e.target as Element;
  if (!target) return;

  // Flash effect before deactivating
  flashCapture();

  // Deactivate selector
  deactivateSelector();
  updatePanelSelectorState();

  try {
    const data = await captureElement(target);
    chrome.runtime.sendMessage({ type: 'ELEMENT_CAPTURED', payload: data } satisfies ExtMessage);
    showToast('元素已采集', 'success');
    updatePanelResult(true, `✓ 已采集: ${data.element.tagName}`);
  } catch (err) {
    console.error('[Chrome-Agent Bridge] Element capture failed:', err);
    showToast('采集失败', 'error');
    updatePanelResult(false, '✗ 采集失败');
  }
}

export function activateSelector(): void {
  if (selectorActive) return;
  selectorActive = true;
  ensureOverlay();
  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mouseout', onMouseOut, true);
  document.addEventListener('click', onClick, true);
  // Change cursor to crosshair while selecting
  document.documentElement.style.cursor = 'crosshair';
}

export function deactivateSelector(): void {
  if (!selectorActive) return;
  selectorActive = false;
  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('mouseout', onMouseOut, true);
  document.removeEventListener('click', onClick, true);
  document.documentElement.style.cursor = '';
  clearHighlight();
}

// ─── Element Information Capture ─────────────────────────────────────────────

export function getComputedStyles(el: Element): Record<string, string> {
  const computed = window.getComputedStyle(el);
  const styles: Record<string, string> = {};
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i]!;
    styles[prop] = computed.getPropertyValue(prop);
  }
  return styles;
}

export function getMatchedCSSRules(el: Element): CSSRuleInfo[] {
  const rules: CSSRuleInfo[] = [];

  // Collect inline styles
  if (el instanceof HTMLElement && el.style.length > 0) {
    const properties: Record<string, string> = {};
    for (let i = 0; i < el.style.length; i++) {
      const prop = el.style[i]!;
      properties[prop] = el.style.getPropertyValue(prop);
    }
    rules.push({
      selector: 'inline',
      properties,
      mediaQuery: null,
      source: 'inline',
    });
  }

  for (let s = 0; s < document.styleSheets.length; s++) {
    const sheet = document.styleSheets[s]!;
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue;
    }
    const source = sheet.href || 'inline';
    collectMatchingRules(el, cssRules, source, null, rules);
  }

  return rules;
}

function collectMatchingRules(
  el: Element,
  cssRules: CSSRuleList,
  source: string,
  mediaQuery: string | null,
  results: CSSRuleInfo[],
): void {
  for (let i = 0; i < cssRules.length; i++) {
    const rule = cssRules[i]!;
    if (rule instanceof CSSStyleRule) {
      try {
        if (el.matches(rule.selectorText)) {
          const properties: Record<string, string> = {};
          for (let j = 0; j < rule.style.length; j++) {
            const prop = rule.style[j]!;
            properties[prop] = rule.style.getPropertyValue(prop);
          }
          results.push({ selector: rule.selectorText, properties, mediaQuery, source });
        }
      } catch {
        // Invalid selector, skip
      }
    } else if (rule instanceof CSSMediaRule) {
      collectMatchingRules(el, rule.cssRules, source, rule.conditionText, results);
    }
  }
}

interface ElementMetadata {
  tagName: string;
  html: string;
  text: string;
  classes: string[];
  id: string | null;
  attributes: Record<string, string>;
  domPath: string;
}

export function getElementMetadata(el: Element): ElementMetadata {
  const domPath = buildDomPath(el);
  const attributes: Record<string, string> = {};
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i]!;
    attributes[attr.name] = attr.value;
  }
  return {
    tagName: el.tagName.toLowerCase(),
    html: el.outerHTML,
    text: el.textContent || '',
    classes: Array.from(el.classList),
    id: el.id || null,
    attributes,
    domPath,
  };
}

function buildDomPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.documentElement) {
    let segment = current.tagName.toLowerCase();
    if (current.id) {
      segment += `#${current.id}`;
    } else if (current.classList.length > 0) {
      segment += '.' + Array.from(current.classList).join('.');
    }
    parts.unshift(segment);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

export async function captureScreenshot(el: Element): Promise<string> {
  const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' });
  if (!response || !response.dataUrl) {
    throw new Error('Failed to capture screenshot from background');
  }
  const dataUrl: string = response.dataUrl;
  const rect = el.getBoundingClientRect();
  return cropScreenshot(dataUrl, rect);
}

function cropScreenshot(dataUrl: string, rect: DOMRect): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const dpr = window.devicePixelRatio || 1;
      const sx = rect.left * dpr;
      const sy = rect.top * dpr;
      const sw = rect.width * dpr;
      const sh = rect.height * dpr;

      // Limit max dimensions to avoid oversized images
      const MAX_DIM = 1200;
      let outW = rect.width;
      let outH = rect.height;
      if (outW > MAX_DIM || outH > MAX_DIM) {
        const scale = MAX_DIM / Math.max(outW, outH);
        outW = Math.round(outW * scale);
        outH = Math.round(outH * scale);
      }

      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Failed to get canvas 2d context')); return; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      // Use JPEG with 0.8 quality for smaller payload
      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      resolve(base64.replace(/^data:image\/jpeg;base64,/, ''));
    };
    img.onerror = () => reject(new Error('Failed to load screenshot image'));
    img.src = dataUrl;
  });
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function captureElement(el: Element): Promise<CapturedElementData> {
  const metadata = getElementMetadata(el);
  const computed = getComputedStyles(el);
  const matched = getMatchedCSSRules(el);

  let screenshot: string | null = null;
  try {
    screenshot = await captureScreenshot(el);
  } catch {
    console.warn('[Chrome-Agent Bridge] Screenshot capture failed, continuing without it');
  }

  const data: CapturedElementData = {
    id: generateId(),
    timestamp: Date.now(),
    url: window.location.href,
    title: document.title,
    element: {
      tagName: metadata.tagName,
      html: metadata.html,
      text: metadata.text,
      classes: metadata.classes,
      id: metadata.id,
      attributes: metadata.attributes,
      domPath: metadata.domPath,
    },
    styles: { computed, matched },
    screenshot,
  };

  return data;
}

// ─── Message Listener ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtMessage) => {
  switch (message.type) {
    case 'TOGGLE_PANEL':
      togglePanel();
      break;
    case 'ACTIVATE_SELECTOR':
      activateSelector();
      updatePanelSelectorState();
      break;
    case 'DEACTIVATE_SELECTOR':
      deactivateSelector();
      updatePanelSelectorState();
      break;
    case 'SEND_RESULT': {
      const { success, id, error } = message.payload;
      if (success) {
        updatePanelResult(true, `✓ 已采集 (${id})`);
      } else {
        updatePanelResult(false, `✗ 失败: ${error}`);
      }
      break;
    }
  }
});
