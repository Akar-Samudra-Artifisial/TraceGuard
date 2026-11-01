import { describe, expect, it, vi } from 'vitest';

// No Forge runtime in tests: Jira has no CSM project, so every action falls back to the fixture.
vi.mock('../../src/adapters/jira', () => ({
  getProject: async () => undefined,
  getVersions: async () => [],
  searchProjectIssues: async () => [],
}));
vi.mock('../../src/adapters/store', () => ({
  getSettings: async () => undefined,
  getPullRequests: async () => [],
}));
const confluence = vi.hoisted(() => ({
  pages: [] as { spaceId: string; title: string; body: string }[],
}));
vi.mock('../../src/adapters/confluence', async (original) => ({
  ...(await original<typeof import('../../src/adapters/confluence')>()),
  findSpace: async (key?: string) =>
    key === 'NOPE'
      ? { siteUrl: 'https://acme.atlassian.net' }
      : { space: { id: '42', key: key ?? 'QA', name: 'Quality' }, siteUrl: 'https://acme.atlassian.net' },
  createPage: async (spaceId: string, title: string, body: string) => {
    confluence.pages.push({ spaceId, title, body });
    return { id: '9', title, url: 'https://acme.atlassian.net/wiki/spaces/QA/pages/9', siteUrl: 'https://acme.atlassian.net' };
  },
}));
import {
  assignGap,
  checkChangeImpact,
  findRequirementsForPath,
  generateEvidencePack,
  getTrace,
  listGaps,
  type ActionResult,
} from '../../src/surfaces/actions';

const data = <T>(r: ActionResult) => r as unknown as T;

describe('Rovo / MCP actions (demo data)', () => {
  it('list_gaps defaults to the next unreleased version', async () => {
    const r = data<{ release: string; summary: string; simulated: boolean }>(await listGaps({}));
    expect(r).toMatchObject({ release: '2.3', simulated: true });
    expect(r.summary).toBe('Release 2.3 has 6 open gaps: 1 critical, 3 high, 2 medium.');
  });

  it('list_gaps filters by severity and validates it', async () => {
    const r = data<{ gaps: unknown[] }>(await listGaps({ release: '2.3', severity: 'Critical' }));
    expect(r.gaps).toHaveLength(1);
    expect(await listGaps({ severity: 'urgent' })).toEqual({
      error: 'Input "severity" must be one of: critical, high, medium, low.',
    });
  });

  it('returns a readable error for an unknown release', async () => {
    expect(await listGaps({ release: '9.9' })).toEqual({ error: 'Unknown release "9.9". Available: 2.2, 2.3' });
  });

  it('get_trace resolves a Jira issue key to its requirement', async () => {
    const r = data<{ matchedAs: string; chains: { requirement: { id: string } }[] }>(await getTrace({ key: 'csm-41' }));
    expect(r.matchedAs).toBe('work-item');
    expect(r.chains.map((c) => c.requirement.id)).toEqual(['REQ-112']);
  });

  it('get_trace falls back to the issue in the Rovo context', async () => {
    const r = data<{ summary: string }>(await getTrace({ context: { jira: { issueKey: 'CSM-45' } } }));
    expect(r.summary).toBe('REQ-115 (class B): 1 open gap(s)');
    expect(await getTrace({})).toEqual({ error: 'Input "key" is required (requirement ID or Jira issue key).' });
  });

  it('check_change_impact accepts comma-separated files and names the tests', async () => {
    const r = data<{ summary: string }>(await checkChangeImpact({ files: 'src/dosing/limits.ts, src/ui/theme.ts' }));
    expect(r.summary).toBe(
      'Affects REQ-112 (class C, mitigates HAZ-07). Tests to re-run: CSM-T12, CSM-T13. A traced Jira issue is required.',
    );
  });

  it('check_change_impact rejects empty and oversized input', async () => {
    expect(await checkChangeImpact({ files: ' , ' })).toEqual({
      error: 'Input "files" must list at least one file path.',
    });
    expect(await checkChangeImpact({ files: Array.from({ length: 101 }, (_, i) => `f${i}`) })).toHaveProperty('error');
    expect(await checkChangeImpact({ repo: 'x'.repeat(201), files: 'a' })).toHaveProperty('error');
  });

  it('find_requirements_for_path requires a path', async () => {
    expect(await findRequirementsForPath({})).toEqual({ error: 'Input "path" is required.' });
    const r = data<{ requirements: { id: string }[] }>(await findRequirementsForPath({ path: 'src/dosing' }));
    expect(r.requirements.map((x) => x.id)).toEqual(['REQ-112']);
  });

  it('generate_evidence_pack publishes a Confluence page', async () => {
    const r = data<{ pageUrl: string; space: string; summary: string; coverage: { percent: number } }>(
      await generateEvidencePack({ release: '2.3' }),
    );
    expect(r).toMatchObject({ pageUrl: 'https://acme.atlassian.net/wiki/spaces/QA/pages/9', space: 'CSM', coverage: { percent: 38 } });
    expect(r.summary).toContain('3/8 requirements fully traced (38%), 6 open gap(s)');
    const page = confluence.pages.at(-1)!;
    expect(page.spaceId).toBe('42');
    expect(page.title).toMatch(/^TraceGuard evidence pack · release 2\.3 · \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/);
    expect(page.body).toContain('sample dataset');
  });

  it('generate_evidence_pack validates the space', async () => {
    expect(await generateEvidencePack({ space: 'NOPE' })).toEqual({
      error: 'Confluence space "NOPE" was not found or the app cannot see it.',
    });
    expect(await generateEvidencePack({ space: 'bad key!' })).toEqual({
      error: 'Input "space" must be a Confluence space key.',
    });
  });

  it('assign_gap previews the task and defaults to the gap owner', async () => {
    const r = data<{ wouldCreate: { assignee: string }; issueKey: unknown }>(
      await assignGap({ gapId: 'g3:req-115:csm-t15' }),
    );
    expect(r.wouldCreate.assignee).toBe('Dimas');
    expect(r.issueKey).toBeNull();
    expect(await assignGap({ gapId: 'G9:NOPE' })).toEqual({
      error: 'No open gap with ID "G9:NOPE". Call list_gaps to see current gap IDs.',
    });
  });
});

describe('UI data (demo data)', () => {
  it('getOverview returns one row per requirement with its gaps and hazards', async () => {
    const { getOverview } = await import('../../src/surfaces/actions');
    const r = data<{
      release: string;
      coverage: { percent: number };
      rows: { requirementId: string; status: string; hazards: { id: string }[]; gaps: { code: string }[] }[];
      untracedChanges: { artifactKey: string }[];
    }>(await getOverview({}));
    expect(r.release).toBe('2.3');
    expect(r.coverage.percent).toBe(38);
    expect(r.rows).toHaveLength(8);
    const req112 = r.rows.find((x) => x.requirementId === 'REQ-112')!;
    expect(req112.hazards.map((h) => h.id)).toEqual(['HAZ-07']);
    expect(req112.gaps.map((g) => g.code)).toEqual(['G5']);
    expect(r.untracedChanges.map((g) => g.artifactKey)).toEqual(['PR-63']);
  });

  it('getSetupInfo reports the demo source and safety-critical paths', async () => {
    const { getSetupInfo } = await import('../../src/surfaces/actions');
    const r = data<{ dataSource: string; safetyCriticalPaths: string[]; counts: { requirements: number } }>(
      await getSetupInfo({}),
    );
    expect(r).toMatchObject({ dataSource: 'demo', counts: { requirements: 8 } });
    expect(r.safetyCriticalPaths).toContain('src/dosing/**');
  });
});
