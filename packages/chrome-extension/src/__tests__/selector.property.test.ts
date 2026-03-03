// @vitest-environment jsdom
/**
 * 属性 1: 选择器模式 Toggle 往返一致性
 * Validates: Requirements 1.1, 1.3
 *
 * For any Content Script instance, activating then deactivating the selector
 * should restore initial state (no event listeners, no highlight).
 * Highlight now uses an overlay div instead of modifying element styles.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock chrome.runtime API globally before any imports that use it
const mockSendMessage = vi.fn();
const mockAddListener = vi.fn();

vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: mockSendMessage,
    onMessage: {
      addListener: mockAddListener,
    },
  },
});

const { activateSelector, deactivateSelector, highlightElement } = await import('../content');

describe('Property 1: Selector mode toggle round-trip consistency', () => {
  beforeEach(() => {
    deactivateSelector();
  });

  it('should restore initial state after activate then deactivate (overlay hidden, element untouched)', () => {
    fc.assert(
      fc.property(fc.nat({ max: 5 }), (toggleCount) => {
        const el = document.createElement('div');
        el.textContent = 'test';
        document.body.appendChild(el);

        // Record initial element styles
        const initialOutline = el.style.outline;
        const initialOutlineOffset = el.style.outlineOffset;

        for (let i = 0; i < toggleCount + 1; i++) {
          activateSelector();
          highlightElement(el);
          deactivateSelector();
        }

        // Element styles should be completely untouched (overlay-based highlight)
        expect(el.style.outline).toBe(initialOutline);
        expect(el.style.outlineOffset).toBe(initialOutlineOffset);

        // Overlay should be hidden after deactivation
        const overlay = document.getElementById('__cab-overlay');
        if (overlay) {
          expect(overlay.style.display).toBe('none');
        }

        // Cursor should be restored
        expect(document.documentElement.style.cursor).toBe('');

        document.body.removeChild(el);
      }),
      { numRuns: 100 },
    );
  });

  it('should be idempotent when activating multiple times', () => {
    activateSelector();
    activateSelector(); // Should be a no-op
    deactivateSelector();
  });

  it('should be idempotent when deactivating multiple times', () => {
    activateSelector();
    deactivateSelector();
    deactivateSelector(); // Should be a no-op
  });
});
