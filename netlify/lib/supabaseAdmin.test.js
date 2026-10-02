import { afterEach, describe, expect, test, vi } from 'vitest';
import { serviceClient } from './supabaseAdmin.js';

afterEach(() => vi.unstubAllGlobals());

describe('serviceClient', () => {
  test('can be created on a Node with no built-in WebSocket (Node 20 on Netlify)', () => {
    vi.stubGlobal('WebSocket', undefined);
    expect(() => serviceClient('https://example.supabase.co', 'service-key')).not.toThrow();
  });
});
