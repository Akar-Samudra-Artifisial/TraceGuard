import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_REPO, demoConfig, demoSnapshot } from '../../src/demo/cardiosense';

const jiraState = vi.hoisted(() => ({
  calls: [] as { method: string; path: string; body?: any }[],
  users: [] as { accountId: string; displayName: string }[],
  allowed: true,
  saved: new Map<string, { key: string; url: string }>(),
  status: 'new',
}));

vi.mock('@forge/api', () => ({
  route: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    value: strings.reduce((acc, s, i) => acc + s + (i < values.length ? encodeURIComponent(String(values[i])) : ''), ''),
  }),
}));
vi.mock('../../src/adapters/jira', async (original) => {
  const real = await original<typeof import('../../src/adapters/jira')>();
  return {
    JiraError: real.JiraError,
    getProject: async () => ({ id: '10000', key: 'CSM', name: 'CardioSense' }),
    userHasProjectPermissions: async () => jiraState.allowed,
    jira: async (method: string, path: { value: string }, body?: unknown) => {
      jiraState.calls.push({ method, path: path.value, body });
      if (path.value.startsWith('/rest/api/3/user/assignable/search')) return jiraState.users;
      if (path.value.includes('/createmeta/')) return { issueTypes: [{ id: '1', name: 'Story' }, { id: '2', name: 'Task' }] };
      if (path.value === '/rest/api/3/issue' && method === 'POST') return { key: 'CSM-99', self: 'x' };
      if (path.value === '/rest/api/3/serverInfo') return { baseUrl: 'https://acme.atlassian.net' };
      if (path.value.startsWith('/rest/api/3/issue/CSM-50')) return { key: 'CSM-50', fields: { status: { statusCategory: { key: jiraState.status } } } };
      return undefined;
    },
  };
});
vi.mock('../../src/adapters/store', () => ({
  getGapTask: async (id: string) => jiraState.saved.get(id),
  setGapTask: async (id: string, t: { key: string; url: string }) => void jiraState.saved.set(id, t),
}));

const { createGapTask, pickUser, gapIssueKey, openGaps } = await import('../../src/surfaces/assign');

const snapshot = {
  ...demoSnapshot,
  requirements: demoSnapshot.requirements.map((r) => (r.id === 'REQ-109' ? { ...r, key: 'CSM-7' } : r)),
};
const src = { snapshot, config: demoConfig, defaultRepo: DEMO_REPO, simulated: false, projectKey: 'CSM' };
const g2 = openGaps(src).find((g) => g.gap.code === 'G2')!.gap;

describe('assign_gap (live)', () => {
  beforeEach(() => {
    jiraState.calls = [];
    jiraState.users = [{ accountId: 'acc-dimas', displayName: 'Dimas' }];
    jiraState.allowed = true;
    jiraState.saved = new Map();
    jiraState.status = 'new';
  });

  it('creates an assigned Task in the release, related to the requirement', async () => {
    const r = await createGapTask(src, 'me', g2.id, 'Dimas');
    expect(r).toMatchObject({ issueKey: 'CSM-99', issueUrl: 'https://acme.atlassian.net/browse/CSM-99', assignee: 'Dimas', relatedTo: 'CSM-7', created: true });
    const create = jiraState.calls.find((c) => c.path === '/rest/api/3/issue')!;
    expect(create.body.fields).toMatchObject({
      issuetype: { id: '2' },
      summary: `Close G2 gap: REQ-109`,
      labels: ['traceguard-gap'],
      assignee: { accountId: 'acc-dimas' },
    });
    const link = jiraState.calls.find((c) => c.path === '/rest/api/3/issueLink')!;
    expect(link.body).toEqual({ type: { name: 'Relates' }, inwardIssue: { key: 'CSM-99' }, outwardIssue: { key: 'CSM-7' } });
  });

  it('returns the existing open task instead of a duplicate', async () => {
    jiraState.saved.set(g2.id, { key: 'CSM-50', url: 'https://acme.atlassian.net/browse/CSM-50' });
    const r = await createGapTask(src, 'me', g2.id.toLowerCase());
    expect(r).toMatchObject({ issueKey: 'CSM-50', created: false });
    expect(jiraState.calls.some((c) => c.path === '/rest/api/3/issue')).toBe(false);
    jiraState.status = 'done';
    expect((await createGapTask(src, 'me', g2.id)).created).toBe(true);
  });

  it('leaves the task unassigned when no Jira user matches', async () => {
    jiraState.users = [];
    const r = await createGapTask(src, 'me', g2.id, 'Nobody Here');
    expect(r.summary).toContain('unassigned (no assignable Jira user matches "Nobody Here")');
    expect(jiraState.calls.find((c) => c.path === '/rest/api/3/issue')!.body.fields.assignee).toBeUndefined();
  });

  it('refuses without the caller identity or permissions, and on sample data', async () => {
    await expect(createGapTask(src, undefined, g2.id)).rejects.toThrow('could not identify you');
    jiraState.allowed = false;
    await expect(createGapTask(src, 'me', g2.id)).rejects.toThrow('permissions in CSM');
    await expect(createGapTask({ ...src, simulated: true }, 'me', g2.id)).rejects.toThrow('needs live Jira data');
    await expect(createGapTask(src, 'me', 'G9:NOPE')).rejects.toThrow('No open gap');
    expect(jiraState.calls.some((c) => c.path === '/rest/api/3/issue')).toBe(false);
  });
});

describe('helpers', () => {
  it('pickUser prefers exact names, accepts a single fuzzy hit', () => {
    const a = { accountId: 'a', displayName: 'Bayu Trisnapati' };
    const b = { accountId: 'b', displayName: 'Bayu Lain' };
    expect(pickUser([a, b], 'bayu trisnapati')).toBe(a);
    expect(pickUser([a, b], 'Bayu')).toBeUndefined();
    expect(pickUser([b], 'Bayu')).toBe(b);
  });

  it('gapIssueKey uses the requirement issue, else a Jira-key artifact', () => {
    expect(gapIssueKey(snapshot, g2)).toBe('CSM-7');
    expect(gapIssueKey(snapshot, { id: 'G4:x', code: 'G4', severity: 'critical', message: '', artifactKey: 'PR-63' })).toBeUndefined();
  });
});
