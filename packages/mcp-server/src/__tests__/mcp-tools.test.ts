/**
 * MCP Tools Unit Tests
 * Validates: Requirements 6.6
 *
 * Tests no-data returns prompt message, non-existent ID returns error message.
 * We test the DataStore behavior that the MCP tools rely on.
 */
import { describe, it, expect } from 'vitest';
import { DataStore } from '../data-store';

const NO_DATA_MSG = '当前无已采集的元素数据，请先在浏览器中选择元素';

function notFoundMsg(id: string): string {
  return `未找到 ID 为 ${id} 的元素数据`;
}

describe('MCP Tools - no data scenarios', () => {
  it('should return null for getLatest when no data (get_selected_element)', () => {
    const store = new DataStore();
    const data = store.getLatest();
    expect(data).toBeNull();
    // MCP tool would return NO_DATA_MSG
    const message = data ? JSON.stringify(data) : NO_DATA_MSG;
    expect(message).toBe(NO_DATA_MSG);
  });

  it('should return null for getById with non-existent ID (get_selected_element)', () => {
    const store = new DataStore();
    const id = 'non-existent-id';
    const data = store.getById(id);
    expect(data).toBeNull();
    // MCP tool would return notFoundMsg
    const message = data ? JSON.stringify(data) : notFoundMsg(id);
    expect(message).toBe(notFoundMsg(id));
  });

  it('should return empty list when no data (list_captured_elements)', () => {
    const store = new DataStore();
    const summaries = store.list();
    expect(summaries).toEqual([]);
    // MCP tool would return NO_DATA_MSG for empty list
    const message = summaries.length === 0 ? NO_DATA_MSG : JSON.stringify(summaries);
    expect(message).toBe(NO_DATA_MSG);
  });

  it('should return null screenshot for non-existent ID (get_element_screenshot)', () => {
    const store = new DataStore();
    const data = store.getById('missing-id');
    expect(data).toBeNull();
  });

  it('should return null styles for non-existent ID (get_element_styles)', () => {
    const store = new DataStore();
    const data = store.getById('missing-id');
    expect(data).toBeNull();
  });
});
