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

  it('generate_evidence_pack is simulated and does not publish', async () => {
    const r = data<{ pageUrl: unknown; rows: unknown[] }>(await generateEvidencePack({ release: '2.3' }));
    expect(r.pageUrl).toBeNull();
    expect(r.rows).toHaveLength(8);
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
