import { describe, it, expect, beforeEach } from 'vitest';
import { DataStore } from '../data-store';
import type { CapturedElementData } from '@chrome-agent-bridge/shared';

function makeCapturedData(overrides: Partial<CapturedElementData> = {}): CapturedElementData {
  return {
    id: '',
    timestamp: Date.now(),
    url: 'https://example.com',
    title: 'Example',
    element: {
      tagName: 'div',
      html: '<div>hello</div>',
      text: 'hello',
      classes: ['test'],
      id: null,
      attributes: {},
      domPath: 'body > div',
    },
    styles: {
      computed: { color: 'red' },
      matched: [],
    },
    screenshot: null,
    ...overrides,
  };
}

describe('DataStore', () => {
  let store: DataStore;

  beforeEach(() => {
    store = new DataStore();
  });

  it('should return null for getById on empty store', () => {
    expect(store.getById('nonexistent')).toBeNull();
  });

  it('should return null for getLatest on empty store', () => {
    expect(store.getLatest()).toBeNull();
  });

  it('should return empty array for list on empty store', () => {
    expect(store.list()).toEqual([]);
  });

  it('should store data and return a valid UUID', () => {
    const data = makeCapturedData();
    const id = store.store(data);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should retrieve stored data by ID', () => {
    const data = makeCapturedData();
    const id = store.store(data);
    const result = store.getById(id);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(id);
    expect(result!.url).toBe(data.url);
    expect(result!.element.tagName).toBe(data.element.tagName);
  });

  it('should return the latest stored record', () => {
    store.store(makeCapturedData({ url: 'https://first.com' }));
    store.store(makeCapturedData({ url: 'https://second.com' }));
    const id3 = store.store(makeCapturedData({ url: 'https://third.com' }));
    const latest = store.getLatest();
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe(id3);
    expect(latest!.url).toBe('https://third.com');
  });

  it('should list summaries with correct fields', () => {
    store.store(makeCapturedData({ url: 'https://a.com' }));
    store.store(makeCapturedData({ url: 'https://b.com' }));
    const summaries = store.list();
    expect(summaries).toHaveLength(2);
    expect(summaries[0].url).toBe('https://a.com');
    expect(summaries[1].url).toBe('https://b.com');
    expect(summaries[0]).toHaveProperty('id');
    expect(summaries[0]).toHaveProperty('timestamp');
    expect(summaries[0]).toHaveProperty('tagName');
    expect(summaries[0]).toHaveProperty('classes');
    expect(summaries[0]).toHaveProperty('text');
  });

  it('should truncate text in summaries to 100 chars', () => {
    const longText = 'a'.repeat(200);
    store.store(makeCapturedData({
      element: {
        tagName: 'p',
        html: '<p>' + longText + '</p>',
        text: longText,
        classes: [],
        id: null,
        attributes: {},
        domPath: 'body > p',
      },
    }));
    const summaries = store.list();
    expect(summaries[0].text).toBe('a'.repeat(100) + '...');
  });

  it('should clear all data', () => {
    store.store(makeCapturedData());
    store.store(makeCapturedData());
    store.clear();
    expect(store.getLatest()).toBeNull();
    expect(store.list()).toEqual([]);
  });

  it('should evict oldest records when exceeding capacity of 20', () => {
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) {
      ids.push(store.store(makeCapturedData({ url: `https://site${i}.com` })));
    }
    // Should have exactly 20 records
    expect(store.list()).toHaveLength(20);
    // First 5 should be evicted
    for (let i = 0; i < 5; i++) {
      expect(store.getById(ids[i])).toBeNull();
    }
    // Last 20 should still exist
    for (let i = 5; i < 25; i++) {
      expect(store.getById(ids[i])).not.toBeNull();
    }
  });

  it('should keep exactly 20 records when storing exactly 20', () => {
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) {
      ids.push(store.store(makeCapturedData({ url: `https://site${i}.com` })));
    }
    expect(store.list()).toHaveLength(20);
    // All 20 should be retrievable
    for (const id of ids) {
      expect(store.getById(id)).not.toBeNull();
    }
  });

  it('should evict only the first record when storing exactly 21', () => {
    const ids: string[] = [];
    for (let i = 0; i < 21; i++) {
      ids.push(store.store(makeCapturedData({ url: `https://site${i}.com` })));
    }
    expect(store.list()).toHaveLength(20);
    // First record should be evicted
    expect(store.getById(ids[0])).toBeNull();
    // Records 1-20 should still exist
    for (let i = 1; i < 21; i++) {
      expect(store.getById(ids[i])).not.toBeNull();
    }
    // Latest should be the 21st
    expect(store.getLatest()!.id).toBe(ids[20]);
  });

  it('should return null for getById after record is evicted', () => {
    const firstId = store.store(makeCapturedData({ url: 'https://first.com' }));
    expect(store.getById(firstId)).not.toBeNull();
    // Fill to capacity and push one more to evict the first
    for (let i = 0; i < 20; i++) {
      store.store(makeCapturedData());
    }
    expect(store.getById(firstId)).toBeNull();
  });

  it('should maintain correct order in list after evictions', () => {
    for (let i = 0; i < 25; i++) {
      store.store(makeCapturedData({ url: `https://site${i}.com` }));
    }
    const summaries = store.list();
    // Should contain sites 5-24 in order
    for (let i = 0; i < 20; i++) {
      expect(summaries[i].url).toBe(`https://site${i + 5}.com`);
    }
  });
});
