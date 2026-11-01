import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_REPO, demoConfig, demoSnapshot } from '../../src/demo/cardiosense';

const jira = vi.hoisted(() => ({
  getProject: vi.fn(async () => ({ id: '10001', key: 'CSM', name: 'CardioSense Monitor' })),
  getVersions: vi.fn(async () => []),
  searchProjectIssues: vi.fn(async () => []),
  userHasProjectPermissions: vi.fn(async (accountId: string) => accountId === 'allowed'),
}));
vi.mock('../../src/adapters/jira', () => jira);
vi.mock('../../src/adapters/store', () => ({
  getSettings: async () => undefined,
  getPullRequests: async () => [],
  getBitbucketSecret: async () => undefined,
}));
const source = vi.hoisted(() => ({ simulated: false }));
vi.mock('../../src/adapters/source', () => ({
  loadTraceSource: async () => ({
    snapshot: demoSnapshot,
    config: demoConfig,
    defaultRepo: DEMO_REPO,
    simulated: source.simulated,
    projectKey: 'CSM',
    projectId: source.simulated ? undefined : '10001',
  }),
}));

const { listGaps, getTrace, checkChangeImpact, getOverview } = await import('../../src/surfaces/actions');
const { accountOf } = await import('../../src/surfaces/access');

beforeEach(() => {
  vi.clearAllMocks();
  source.simulated = false;
});

describe('per-user access to live data', () => {
  it('serves live data to users who can browse the project', async () => {
    const r = await listGaps({}, { principal: { accountId: 'allowed' } });
    expect(r).toMatchObject({ release: '2.3', simulated: false });
    expect(jira.userHasProjectPermissions).toHaveBeenCalledWith('allowed', '10001', ['BROWSE_PROJECTS']);
  });

  it('refuses users without Browse projects on every read surface', async () => {
    const denied = { error: 'You need the Browse projects permission in Jira project CSM to see its traceability data.' };
    const ctx = { principal: { accountId: 'other' } };
    expect(await listGaps({}, ctx)).toEqual(denied);
    expect(await getTrace({ key: 'REQ-112' }, ctx)).toEqual(denied);
    expect(await checkChangeImpact({ files: 'src/dosing/limits.ts' }, ctx)).toEqual(denied);
    // UI resolvers pass the user from the resolver context.
    expect(await getOverview({}, { accountId: 'other' })).toEqual(denied);
  });

  it('refuses anonymous calls on live data but serves the built-in sample', async () => {
    expect(await listGaps({})).toEqual({ error: 'TraceGuard could not identify you, so it cannot check your Jira permissions.' });
    source.simulated = true;
    expect(await listGaps({})).toMatchObject({ simulated: true });
    expect(jira.userHasProjectPermissions).not.toHaveBeenCalled();
  });

  it('trusts only the Forge context, never an accountId sent as input', async () => {
    expect(accountOf({ principal: { accountId: 'a' } })).toBe('a');
    expect(accountOf({ accountId: 'c' })).toBe('c');
    expect(accountOf({ accountId: '' })).toBeUndefined();
    const spoofed = { context: { accountId: 'allowed' } } as Parameters<typeof listGaps>[0];
    expect(await listGaps(spoofed)).toEqual({ error: 'TraceGuard could not identify you, so it cannot check your Jira permissions.' });
  });
});
