import { describe, expect, it } from 'vitest';
import { newSecret, sign, verify } from '../../src/adapters/signature';

const secret = 'tgs_test';
const body = '{"repo":"cardiosense-firmware"}';
const now = Date.parse('2026-11-01T10:00:00Z');

describe('signature', () => {
  it('round-trips', () => {
    expect(verify(secret, body, sign(secret, body, now), now)).toEqual({ ok: true });
  });

  it('rejects a changed body, a wrong secret, a missing header and an old timestamp', () => {
    const header = sign(secret, body, now);
    expect(verify(secret, `${body} `, header, now).ok).toBe(false);
    expect(verify('other', body, header, now).ok).toBe(false);
    expect(verify(secret, body, undefined, now)).toEqual({ ok: false, reason: 'missing signature' });
    expect(verify(secret, body, header, now + 301_000)).toEqual({ ok: false, reason: 'signature expired' });
    expect(verify(secret, body, 't=abc,v1=zz', now)).toEqual({ ok: false, reason: 'malformed signature' });
  });

  it('creates long random secrets', () => {
    const a = newSecret();
    expect(a).toMatch(/^tgs_[0-9a-f]{64}$/);
    expect(newSecret()).not.toBe(a);
  });
});
