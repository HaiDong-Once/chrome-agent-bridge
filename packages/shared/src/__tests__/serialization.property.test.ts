/**
 * 属性 10: CapturedElementData JSON 序列化往返一致性
 * Validates: Requirements 11.1, 11.2, 11.3
 *
 * For any valid CapturedElementData, JSON.parse(JSON.stringify(data))
 * should produce a deeply equal result.
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

describe('Property 10: CapturedElementData JSON serialization round-trip', () => {
  it('should produce deeply equal result after JSON round-trip', () => {
    fc.assert(
      fc.property(capturedElementDataArb, (data) => {
        const roundTripped = JSON.parse(JSON.stringify(data));
        expect(roundTripped).toEqual(data);
      }),
      { numRuns: 100 },
    );
  });
});
