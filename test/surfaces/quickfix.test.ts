import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TraceSnapshot } from '../../src/core/types';
import { demoConfig, demoSnapshot } from '../../src/demo/cardiosense';

const jira = vi.hoisted(() => ({
  createLink: vi.fn(async () => undefined),
  getProject: vi.fn(async () => ({ id: '10001', key: 'CSM', name: 'CardioSense Monitor' })),
  userHasProjectPermissions: vi.fn(async () => true),
}));
const source = vi.hoisted(() => ({ value: undefined as unknown }));

vi.mock('../../src/adapters/jira', () => jira);
vi.mock('../../src/adapters/source', () => ({ loadTraceSource: async () => source.value }));

const { linkTestCase, rankTestCandidates, getTestCandidates } = await import('../../src/surfaces/quickfix');

/** Fixture with Jira keys on requirements and one spare, unlinked test. */
function liveSnapshot(): TraceSnapshot {
  return {
    ...demoSnapshot,
    requirements: demoSnapshot.requirements.map((r, i) => ({ ...r, key: `CSM-${i + 4}` })),
    testCases: [
      ...demoSnapshot.testCases,
      { key: 'CSM-26', title: 'Battery warning shown at 15%', requirementIds: [], fixVersions: ['2.3'], lastRun: { result: 'passed', at: '2026-10-12T10:00:00Z' } },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  source.value = { snapshot: liveSnapshot(), config: demoConfig, defaultRepo: 'r', simulated: false, projectKey: 'CSM', projectId: '10001' };
});

describe('rankTestCandidates', () => {
  it('puts unlinked tests in the release first and skips tests already verifying the requirement', () => {
    const s = liveSnapshot();
    const list = rankTestCandidates(s, 'REQ-112', '2.3');
    expect(list[0]).toMatchObject({ key: 'CSM-26', verifies: [], inRelease: true });
    expect(list.some((t) => t.verifies.includes('REQ-112'))).toBe(false);
  });
});

describe('linkTestCase', () => {
  it('links the test with Verifies after checking the user permissions', async () => {
    const r = await linkTestCase('acc-1', 'REQ-109', 'csm-26');
    expect(jira.userHasProjectPermissions).toHaveBeenCalledWith('acc-1', '10001', ['BROWSE_PROJECTS', 'LINK_ISSUES']);
    expect(jira.createLink).toHaveBeenCalledWith('Verifies', 'CSM-26', expect.stringMatching(/^CSM-\d+$/));
    expect(r).toMatchObject({ created: true, summary: 'Linked CSM-26 → verifies → REQ-109.' });
  });

  it('refuses users without the Link work items permission', async () => {
    jira.userHasProjectPermissions.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(linkTestCase('acc-1', 'REQ-109', 'CSM-26')).rejects.toThrow(/Link work items permission/);
    expect(jira.createLink).not.toHaveBeenCalled();
  });

  it('refuses users who cannot browse the project before reading anything', async () => {
    jira.userHasProjectPermissions.mockResolvedValueOnce(false);
    await expect(getTestCandidates('acc-2', 'REQ-109')).rejects.toThrow(/Browse projects permission in Jira project CSM/);
    expect(jira.userHasProjectPermissions).toHaveBeenCalledWith('acc-2', '10001', ['BROWSE_PROJECTS']);
  });

  it('rejects keys that are not Test Case issues in the project', async () => {
    await expect(linkTestCase('acc-1', 'REQ-109', 'CSM-4')).rejects.toThrow(/not a Test Case/);
    await expect(linkTestCase('acc-1', 'REQ-109', 'x; DROP')).rejects.toThrow(/not a Jira issue key/);
    expect(jira.createLink).not.toHaveBeenCalled();
  });

  it('does nothing when the link already exists', async () => {
    const s = liveSnapshot();
    s.testCases.find((t) => t.key === 'CSM-26')!.requirementIds = ['REQ-109'];
    source.value = { snapshot: s, config: demoConfig, defaultRepo: 'r', simulated: false, projectKey: 'CSM', projectId: '10001' };
    const r = await linkTestCase('acc-1', 'REQ-109', 'CSM-26');
    expect(r.created).toBe(false);
    expect(jira.createLink).not.toHaveBeenCalled();
  });

  it('needs live Jira data', async () => {
    source.value = { snapshot: demoSnapshot, config: demoConfig, defaultRepo: 'r', simulated: true, projectKey: 'CSM' };
    await expect(getTestCandidates('acc-1', 'REQ-109')).rejects.toThrow(/Load demo data/);
  });
});
