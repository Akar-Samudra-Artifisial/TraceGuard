import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Request signing between the TraceGuard Bitbucket app and this app's web trigger.
 * Header: `x-traceguard-signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>`.
 * Copy of traceguard/src/adapters/signature.ts; keep both in sync.
 */
export const SIGNATURE_HEADER = 'x-traceguard-signature';
export const MAX_SKEW_SECONDS = 300;

export const newSecret = () => `tgs_${randomBytes(32).toString('hex')}`;

const mac = (secret: string, t: number, body: string) =>
  createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');

export function sign(secret: string, body: string, now = Date.now()): string {
  const t = Math.floor(now / 1000);
  return `t=${t},v1=${mac(secret, t, body)}`;
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export function verify(secret: string, body: string, header: string | undefined, now = Date.now()): VerifyResult {
  if (!header) return { ok: false, reason: 'missing signature' };
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  const given = parts.v1 ?? '';
  if (!Number.isInteger(t) || !/^[0-9a-f]{64}$/.test(given)) return { ok: false, reason: 'malformed signature' };
  if (Math.abs(Math.floor(now / 1000) - t) > MAX_SKEW_SECONDS) return { ok: false, reason: 'signature expired' };
  const expected = Buffer.from(mac(secret, t, body), 'hex');
  return timingSafeEqual(expected, Buffer.from(given, 'hex')) ? { ok: true } : { ok: false, reason: 'bad signature' };
}
