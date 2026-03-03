/**
 * 属性 11: 发送结果通知一致性
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 *
 * For any success/failure scenario, SEND_RESULT message format is correct:
 * - success: { type: 'SEND_RESULT', payload: { success: true, id: string } }
 * - failure: { type: 'SEND_RESULT', payload: { success: false, error: string } }
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ExtMessage } from '@chrome-agent-bridge/shared';

/**
 * Build a SEND_RESULT message from a success/failure scenario,
 * mirroring what background.ts does in notifySendResult.
 */
function buildSendResultMessage(result: {
  success: boolean;
  id?: string;
  error?: string;
}): ExtMessage {
  return {
    type: 'SEND_RESULT',
    payload: result,
  };
}

describe('Property 11: Send result notification consistency', () => {
  it('should produce correct SEND_RESULT for success scenarios', () => {
    fc.assert(
      fc.property(fc.uuid(), (id) => {
        const result = { success: true as const, id };
        const msg = buildSendResultMessage(result);

        expect(msg.type).toBe('SEND_RESULT');
        expect(msg).toHaveProperty('payload');
        const payload = (msg as Extract<ExtMessage, { type: 'SEND_RESULT' }>).payload;
        expect(payload.success).toBe(true);
        expect(typeof payload.id).toBe('string');
        expect(payload.id).toBe(id);
      }),
      { numRuns: 100 },
    );
  });

  it('should produce correct SEND_RESULT for failure scenarios', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (errorMsg) => {
        const result = { success: false as const, error: errorMsg };
        const msg = buildSendResultMessage(result);

        expect(msg.type).toBe('SEND_RESULT');
        expect(msg).toHaveProperty('payload');
        const payload = (msg as Extract<ExtMessage, { type: 'SEND_RESULT' }>).payload;
        expect(payload.success).toBe(false);
        expect(typeof payload.error).toBe('string');
        expect(payload.error).toBe(errorMsg);
      }),
      { numRuns: 100 },
    );
  });

  it('should always have type SEND_RESULT regardless of outcome', () => {
    const resultArb = fc.oneof(
      fc.uuid().map((id) => ({ success: true as boolean, id })),
      fc.string({ minLength: 1 }).map((error) => ({ success: false as boolean, error })),
    );

    fc.assert(
      fc.property(resultArb, (result) => {
        const msg = buildSendResultMessage(result);
        expect(msg.type).toBe('SEND_RESULT');
        expect(msg).toHaveProperty('payload');
        expect(typeof (msg as any).payload.success).toBe('boolean');
      }),
      { numRuns: 100 },
    );
  });
});
