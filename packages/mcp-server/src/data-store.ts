import { randomUUID } from 'node:crypto';
import type { CapturedElementData, CapturedElementSummary } from '@chrome-agent-bridge/shared';

export class DataStore {
  private items: Map<string, CapturedElementData> = new Map();
  private order: string[] = [];
  private readonly MAX_CAPACITY = 20;

  /**
   * Store captured element data, generating a UUID v4 as unique ID.
   * Evicts the oldest record when capacity exceeds MAX_CAPACITY.
   */
  store(data: CapturedElementData): string {
    const id = randomUUID();
    const record: CapturedElementData = { ...data, id };

    this.items.set(id, record);
    this.order.push(id);

    // Evict oldest records when over capacity
    while (this.order.length > this.MAX_CAPACITY) {
      const oldestId = this.order.shift()!;
      this.items.delete(oldestId);
    }

    return id;
  }

  /** Get a record by its unique ID. */
  getById(id: string): CapturedElementData | null {
    return this.items.get(id) ?? null;
  }

  /** Get the most recently stored record. */
  getLatest(): CapturedElementData | null {
    if (this.order.length === 0) return null;
    const latestId = this.order[this.order.length - 1];
    return this.items.get(latestId) ?? null;
  }

  /** List summaries of all cached records. */
  list(): CapturedElementSummary[] {
    return this.order.map((id) => {
      const item = this.items.get(id)!;
      return {
        id: item.id,
        timestamp: item.timestamp,
        url: item.url,
        tagName: item.element.tagName,
        classes: item.element.classes,
        text: item.element.text.length > 100
          ? item.element.text.slice(0, 100) + '...'
          : item.element.text,
      };
    });
  }

  /** Clear all cached data. */
  clear(): void {
    this.items.clear();
    this.order = [];
  }
}
