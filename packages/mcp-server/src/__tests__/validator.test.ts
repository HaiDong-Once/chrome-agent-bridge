import { describe, it, expect } from 'vitest';
import { validateCapturedElementData } from '../validator';

function makeValidData() {
  return {
    id: 'test-id',
    timestamp: Date.now(),
    url: 'https://example.com',
    title: 'Example',
    element: {
      tagName: 'div',
      html: '<div>hello</div>',
      text: 'hello',
      classes: ['test'],
      id: null as string | null,
      attributes: {},
      domPath: 'body > div',
    },
    styles: {
      computed: { color: 'red' },
      matched: [],
    },
    screenshot: null as string | null,
  };
}

describe('validateCapturedElementData', () => {
  it('should accept valid data', () => {
    const result = validateCapturedElementData(makeValidData());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject null', () => {
    const result = validateCapturedElementData(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Data must be a non-null object');
  });

  it('should reject non-object types', () => {
    expect(validateCapturedElementData('string').valid).toBe(false);
    expect(validateCapturedElementData(42).valid).toBe(false);
    expect(validateCapturedElementData(true).valid).toBe(false);
    expect(validateCapturedElementData(undefined).valid).toBe(false);
  });

  it('should reject arrays', () => {
    const result = validateCapturedElementData([]);
    expect(result.valid).toBe(false);
  });

  it('should reject missing url', () => {
    const data = makeValidData();
    delete (data as any).url;
    const result = validateCapturedElementData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('url'))).toBe(true);
  });

  it('should reject missing title', () => {
    const data = makeValidData();
    delete (data as any).title;
    const result = validateCapturedElementData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('title'))).toBe(true);
  });

  it('should reject missing element', () => {
    const data = makeValidData();
    delete (data as any).element;
    const result = validateCapturedElementData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('element'))).toBe(true);
  });

  it('should reject invalid element.tagName', () => {
    const data = makeValidData();
    (data.element as any).tagName = 123;
    const result = validateCapturedElementData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('element.tagName'))).toBe(true);
  });

  it('should reject invalid element.classes (not array)', () => {
    const data = makeValidData();
    (data.element as any).classes = 'not-array';
    const result = validateCapturedElementData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('element.classes'))).toBe(true);
  });

  it('should reject element.classes with non-string items', () => {
    const data = makeValidData();
    (data.element as any).classes = [1, 2];
    const result = validateCapturedElementData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('element.classes'))).toBe(true);
  });

  it('should reject missing styles', () => {
    const data = makeValidData();
    delete (data as any).styles;
    const result = validateCapturedElementData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('styles'))).toBe(true);
  });

  it('should reject invalid styles.computed', () => {
    const data = makeValidData();
    (data.styles as any).computed = 'not-object';
    const result = validateCapturedElementData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('styles.computed'))).toBe(true);
  });

  it('should reject invalid styles.matched (not array)', () => {
    const data = makeValidData();
    (data.styles as any).matched = 'not-array';
    const result = validateCapturedElementData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('styles.matched'))).toBe(true);
  });

  it('should accept screenshot as string', () => {
    const data = makeValidData();
    data.screenshot = 'data:image/png;base64,abc';
    const result = validateCapturedElementData(data);
    expect(result.valid).toBe(true);
  });

  it('should reject screenshot as number', () => {
    const data = makeValidData();
    (data as any).screenshot = 123;
    const result = validateCapturedElementData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('screenshot'))).toBe(true);
  });

  it('should accept element.id as string', () => {
    const data = makeValidData();
    data.element.id = 'my-id';
    const result = validateCapturedElementData(data);
    expect(result.valid).toBe(true);
  });

  it('should reject element.id as number', () => {
    const data = makeValidData();
    (data.element as any).id = 42;
    const result = validateCapturedElementData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('element.id'))).toBe(true);
  });

  it('should collect multiple errors', () => {
    const result = validateCapturedElementData({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
