/**
 * Data Store Property Tests
 * Properties 3, 4, 5, 6
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { DataStore } from '../data-store';
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

describe('Property 3: Data Store store/getById round-trip consistency', () => {
  /**
   * Validates: Requirements 5.1, 5.3
   * For any valid CapturedElementData, store() then getById() returns equivalent object
   * (note: id will be replaced by store)
   */
  it('should return equivalent object after store/getById round-trip', () => {
    const store = new DataStore();
    fc.assert(
      fc.property(capturedElementDataArb, (data) => {
        const id = store.store(data);
        const retrieved = store.getById(id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(id);
        // All fields except id should match
        expect(retrieved!.url).toBe(data.url);
        expect(retrieved!.title).toBe(data.title);
        expect(retrieved!.timestamp).toBe(data.timestamp);
        expect(retrieved!.element).toEqual(data.element);
        expect(retrieved!.styles).toEqual(data.styles);
        expect(retrieved!.screenshot).toBe(data.screenshot);
      }),
      { numRuns: 100 },
    );
  });
});


describe('Property 4: Data Store capacity invariant', () => {
  /**
   * Validates: Requirements 5.2
   * For 1-50 random items stored, list().length <= 20 and oldest are evicted
   */
  it('should never exceed 20 items and evict oldest', () => {
    fc.assert(
      fc.property(
        fc.array(capturedElementDataArb, { minLength: 1, maxLength: 50 }),
        (items) => {
          const store = new DataStore();
          const ids: string[] = [];
          for (const item of items) {
            ids.push(store.store(item));
          }

          const list = store.list();
          expect(list.length).toBeLessThanOrEqual(20);

          if (items.length <= 20) {
            expect(list.length).toBe(items.length);
          } else {
            expect(list.length).toBe(20);
            // First (items.length - 20) should be evicted
            const evictedCount = items.length - 20;
            for (let i = 0; i < evictedCount; i++) {
              expect(store.getById(ids[i])).toBeNull();
            }
            // Last 20 should still exist
            for (let i = evictedCount; i < items.length; i++) {
              expect(store.getById(ids[i])).not.toBeNull();
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 5: Data Store getLatest correctness', () => {
  /**
   * Validates: Requirements 5.4
   * For any non-empty sequence of stores, getLatest() returns the last stored item
   */
  it('should return the last stored item', () => {
    fc.assert(
      fc.property(
        fc.array(capturedElementDataArb, { minLength: 1, maxLength: 30 }),
        (items) => {
          const store = new DataStore();
          let lastId = '';
          for (const item of items) {
            lastId = store.store(item);
          }

          const latest = store.getLatest();
          expect(latest).not.toBeNull();
          expect(latest!.id).toBe(lastId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 6: Data Store list summary consistency', () => {
  /**
   * Validates: Requirements 5.5, 6.5
   * list() count matches stored count, and summary fields match full records
   */
  it('should have consistent summaries matching full records', () => {
    fc.assert(
      fc.property(
        fc.array(capturedElementDataArb, { minLength: 1, maxLength: 25 }),
        (items) => {
          const store = new DataStore();
          const ids: string[] = [];
          for (const item of items) {
            ids.push(store.store(item));
          }

          const summaries = store.list();
          const expectedCount = Math.min(items.length, 20);
          expect(summaries.length).toBe(expectedCount);

          for (const summary of summaries) {
            const full = store.getById(summary.id);
            expect(full).not.toBeNull();
            expect(summary.id).toBe(full!.id);
            expect(summary.timestamp).toBe(full!.timestamp);
            expect(summary.url).toBe(full!.url);
            expect(summary.tagName).toBe(full!.element.tagName);
            expect(summary.classes).toEqual(full!.element.classes);
            // text may be truncated
            if (full!.element.text.length > 100) {
              expect(summary.text).toBe(full!.element.text.slice(0, 100) + '...');
            } else {
              expect(summary.text).toBe(full!.element.text);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
