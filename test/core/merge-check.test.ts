import { describe, expect, it } from 'vitest';
import { evaluateMergeCheck } from '../../src/core';
import { DEMO_REPO, demoConfig, demoSnapshot } from '../../src/demo/cardiosense';

const check = (files: string[], issueKeys: string[] = []) =>
  evaluateMergeCheck(demoSnapshot, demoConfig, { repo: DEMO_REPO, files, issueKeys });

describe('evaluateMergeCheck', () => {
  it('passes changes outside safety-critical code', () => {
    const r = check(['src/ui/theme.ts']);
    expect(r.success).toBe(true);
    expect(r.message).toBe('No safety-critical code changed (1 file(s) checked).');
  });

  it('blocks an untraced dosing change and names requirement, hazard, issue and tests', () => {
    const r = check(['src/dosing/limits.ts']);
    expect(r.success).toBe(false);
    expect(r.affectedRequirementIds).toEqual(['REQ-112']);
    expect(r.message).toBe(
      'Untraced change to safety-critical src/dosing/limits.ts. It affects REQ-112 (class C, hazard HAZ-07). ' +
        'Add a Jira issue that implements REQ-112 to the PR title, for example CSM-41. Re-run tests: CSM-T12, CSM-T13.',
    );
  });

  it('passes when the referenced issue implements the affected requirement', () => {
    const r = check(['src/dosing/limits.ts'], ['csm-41']);
    expect(r.success).toBe(true);
    expect(r.message).toBe('Traced: CSM-41 → REQ-112 (class C, hazard HAZ-07). Re-run tests: CSM-T12, CSM-T13.');
  });

  it('accepts the requirement issue itself as the reference', () => {
    const traced = evaluateMergeCheck(
      { ...demoSnapshot, requirements: demoSnapshot.requirements.map((r) => (r.id === 'REQ-112' ? { ...r, key: 'CSM-9' } : r)) },
      demoConfig,
      { repo: DEMO_REPO, files: ['src/dosing/limits.ts'], issueKeys: ['CSM-9'] },
    );
    expect(traced.success).toBe(true);
  });

  it('blocks when the issue traces to a different requirement than the change affects', () => {
    const r = check(['src/dosing/limits.ts'], ['CSM-14']);
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/^CSM-14 traces to REQ-104, but this change also affects REQ-112 \(class C, hazard HAZ-07\)/);
  });

  it('blocks an unknown issue key with a hint', () => {
    const r = check(['src/dosing/rounding.ts'], ['ABC-1']);
    expect(r.success).toBe(false);
    expect(r.message).toContain('(ABC-1 is not traced to a requirement.)');
  });

  it('blocks safety-critical code that no requirement declares', () => {
    const r = check(['src/alarms/new-module.ts']);
    expect(r.success).toBe(false);
  });
});
