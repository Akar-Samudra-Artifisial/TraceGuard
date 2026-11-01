import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sign } from '../../src/adapters/signature';
import { DEMO_REPO, demoConfig, demoSnapshot } from '../../src/demo/cardiosense';

const state = vi.hoisted(() => ({
  secret: 'tgs_test' as string | undefined,
  simulated: false,
  saved: [] as unknown[],
}));
vi.mock('../../src/adapters/store', () => ({
  getBitbucketSecret: async () => state.secret,
  upsertPullRequest: async (pr: unknown) => void state.saved.push(pr),
}));
vi.mock('../../src/adapters/source', () => ({
  loadTraceSource: async () => ({
    snapshot: demoSnapshot,
    config: demoConfig,
    defaultRepo: DEMO_REPO,
    simulated: state.simulated,
    projectKey: 'CSM',
  }),
}));

const { traceLookup, parseLookup } = await import('../../src/surfaces/webtrigger');

const payload = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    repo: DEMO_REPO,
    trigger: 'on-code-pushed',
    pullRequest: { id: 7, title: 'Raise max dose', author: 'Andi' },
    files: ['src/dosing/limits.ts'],
    issueKeys: [],
    ...over,
  });

const request = (body: string, signature: string | null = sign('tgs_test', body)) => ({
  method: 'POST' as const,
  body,
  path: '/public/x',
  headers: (signature ? { 'X-TraceGuard-Signature': [signature] } : {}) as Record<string, string[]>,
  queryParameters: {},
});

const parse = (r: { body?: string }) => JSON.parse(r.body ?? '{}');

describe('trace-lookup web trigger', () => {
  beforeEach(() => {
    state.secret = 'tgs_test';
    state.simulated = false;
    state.saved = [];
  });

  it('returns a failing check for an untraced dosing change', async () => {
    const res = await traceLookup(request(payload()));
    expect(res.statusCode).toBe(200);
    expect(parse(res)).toMatchObject({ success: false, affectedRequirementIds: ['REQ-112'], simulated: false });
    expect(state.saved).toHaveLength(0);
  });

  it('records a traced pull request when it merges', async () => {
    const res = await traceLookup(request(payload({ trigger: 'on-merge', issueKeys: ['CSM-41'] })));
    expect(parse(res).success).toBe(true);
    expect((state.saved[0] as { author?: string }).author).toBeUndefined();
    expect(state.saved).toEqual([
      expect.objectContaining({ id: 'PR-7', repo: DEMO_REPO, issueKeys: ['CSM-41'], files: ['src/dosing/limits.ts'] }),
    ]);
  });

  it('does not record pull requests while showing the built-in sample', async () => {
    state.simulated = true;
    await traceLookup(request(payload({ trigger: 'on-merge', issueKeys: ['CSM-41'] })));
    expect(state.saved).toHaveLength(0);
  });

  it('uses safety-critical globs from .traceguard.yml when sent', async () => {
    const res = await traceLookup(request(payload({ files: ['src/ui/theme.ts'], safetyCriticalPaths: ['src/ui/**'] })));
    expect(parse(res).success).toBe(false);
  });

  it('rejects unsigned, badly signed and unconfigured requests', async () => {
    expect((await traceLookup(request(payload(), null))).statusCode).toBe(401);
    expect((await traceLookup(request(payload(), sign('other', payload())))).statusCode).toBe(401);
    state.secret = undefined;
    expect((await traceLookup(request(payload()))).statusCode).toBe(503);
  });

  it('validates input', async () => {
    expect((await traceLookup({ ...request(payload()), method: 'GET' })).statusCode).toBe(405);
    const bad = payload({ issueKeys: ['not a key'] });
    const res = await traceLookup(request(bad));
    expect(res.statusCode).toBe(400);
    expect(() => parseLookup(payload({ repo: '../etc' }))).toThrow('repository slug');
  });
});
