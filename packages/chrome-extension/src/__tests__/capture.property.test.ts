/**
 * 属性 2: 元素采集数据完整性
 * Validates: Requirements 2.4, 2.5
 *
 * For any CapturedElementData, all required fields must exist:
 * - element: tagName, html, text, classes, id, attributes, domPath
 * - styles: computed, matched
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { CapturedElementData } from '@chrome-agent-bridge/shared';

const cssRuleInfoArb = fc.record({
  selector: fc.string({ minLength: 1 }),
  properties: fc.dictionary(fc.string({ minLength: 1 }), fc.string()),
  mediaQuery: fc.option(fc.string({ minLength: 1 }), { nil: null }),
  source: fc.string({ minLength: 1 }),
});

const capturedElementDataArb: fc.Arbitrary<CapturedElementData> = fc.record({
  id: fc.uuid(),
  timestamp: fc.nat(),
  url: fc.webUrl(),
  title: fc.string({ minLength: 1 }),
  element: fc.record({
    tagName: fc.constantFrom('div', 'span', 'p', 'section', 'article', 'main', 'header', 'footer'),
    html: fc.string({ minLength: 1 }),
    text: fc.string(),
    classes: fc.array(fc.string({ minLength: 1 })),
    id: fc.option(fc.string({ minLength: 1 }), { nil: null }),
    attributes: fc.dictionary(fc.string({ minLength: 1 }), fc.string()),
    domPath: fc.string({ minLength: 1 }),
  }),
  styles: fc.record({
    computed: fc.dictionary(fc.string({ minLength: 1 }), fc.string()),
    matched: fc.array(cssRuleInfoArb),
  }),
  screenshot: fc.option(fc.base64String(), { nil: null }),
});

describe('Property 2: Captured element data completeness', () => {
  it('should have all required element fields', () => {
    fc.assert(
      fc.property(capturedElementDataArb, (data) => {
        // Top-level required fields
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('url');
        expect(data).toHaveProperty('title');
        expect(data).toHaveProperty('element');
        expect(data).toHaveProperty('styles');

        // Element required fields
        expect(data.element).toHaveProperty('tagName');
        expect(typeof data.element.tagName).toBe('string');
        expect(data.element).toHaveProperty('html');
        expect(typeof data.element.html).toBe('string');
        expect(data.element).toHaveProperty('text');
        expect(typeof data.element.text).toBe('string');
        expect(data.element).toHaveProperty('classes');
        expect(Array.isArray(data.element.classes)).toBe(true);
        expect(data.element).toHaveProperty('id');
        expect(data.element).toHaveProperty('attributes');
        expect(typeof data.element.attributes).toBe('object');
        expect(data.element).toHaveProperty('domPath');
        expect(typeof data.element.domPath).toBe('string');

        // Styles required fields
        expect(data.styles).toHaveProperty('computed');
        expect(typeof data.styles.computed).toBe('object');
        expect(data.styles).toHaveProperty('matched');
        expect(Array.isArray(data.styles.matched)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
