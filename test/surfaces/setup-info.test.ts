import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TraceSource } from '../../src/adapters/source';
import { DEMO_REPO, demoConfig, demoSnapshot } from '../../src/demo/cardiosense';

const state = vi.hoisted(() => ({
  simulated: false,
  space: { available: true, spaceKey: 'CSM', exists: false, error: null as string | null },
}));

vi.mock('../../src/adapters/source', () => ({
  loadTraceSource: async (): Promise<TraceSource> => ({
    snapshot: demoSnapshot,
    config: demoConfig,
    defaultRepo: DEMO_REPO,
    simulated: state.simulated,
    projectKey: 'CSM',
  }),
}));
vi.mock('../../src/surfaces/access', async (original) => ({
  ...(await original<typeof import('../../src/surfaces/access')>()),
  assertCanBrowse: async () => {},
}));
vi.mock('../../src/adapters/store', () => ({
  getSettings: async () => undefined,
  getBitbucketSecret: async () => undefined,
}));
vi.mock('../../src/adapters/evidence-space', () => ({
  evidenceSpaceStatus: async () => state.space,
}));

const { getSetupInfo } = await import('../../src/surfaces/actions');

type Info = { confluence: { available: boolean; spaceKey: string; exists: boolean } | null };

beforeEach(() => {
  state.simulated = false;
  state.space = { available: true, spaceKey: 'CSM', exists: false, error: null };
});

describe('getSetupInfo confluence status', () => {
  it('reports a missing space for a live project so setup offers Create Confluence space', async () => {
    const r = (await getSetupInfo({}, { accountId: 'acc-1' })) as unknown as Info;
    expect(r.confluence).toEqual({ available: true, spaceKey: 'CSM', exists: false, error: null });
  });

  it('reports Confluence being unavailable', async () => {
    state.space = { available: false, spaceKey: 'CSM', exists: false, error: null };
    const r = (await getSetupInfo({}, { accountId: 'acc-1' })) as unknown as Info;
    expect(r.confluence).toMatchObject({ available: false });
  });

  it('is null while the built-in sample is shown (Load demo data creates the space)', async () => {
    state.simulated = true;
    const r = (await getSetupInfo({}, { accountId: 'acc-1' })) as unknown as Info;
    expect(r.confluence).toBeNull();
  });
});
