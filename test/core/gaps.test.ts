import { describe, expect, it } from 'vitest';
import { computeCoverage, detectGaps, UnknownReleaseError, type TraceSnapshot } from '../../src/core';
import { demoConfig, demoSnapshot } from '../../src/demo/cardiosense';

const clone = (): TraceSnapshot => structuredClone(demoSnapshot);

describe('detectGaps on CardioSense 2.3', () => {
  const gaps = detectGaps(demoSnapshot, demoConfig, '2.3');

  it('finds exactly one intentional example of each rule', () => {
    expect(gaps.map((g) => g.id).sort()).toEqual(
      [
        'G1:REQ-110',
        'G2:REQ-109',
        'G3:REQ-115:CSM-T15',
        'G4:cardiosense-firmware:PR-63',
        'G5:REQ-112',
        'G6:REQ-118',
      ].sort(),
    );
  });

  it('orders by severity, critical first', () => {
    expect(gaps[0]).toMatchObject({ code: 'G4', severity: 'critical', owner: 'Andi' });
    expect(gaps.at(-1)?.severity).toBe('medium');
  });

  it('rates G1 by safety class', () => {
    expect(gaps.find((g) => g.code === 'G1')?.severity).toBe('medium');
    const s = clone();
    s.workItems = s.workItems.filter((w) => w.key !== 'CSM-41');
    expect(detectGaps(s, demoConfig, '2.3').find((g) => g.id === 'G1:REQ-112')?.severity).toBe('high');
  });

  it('reports coverage over requirements without gaps', () => {
    expect(computeCoverage(demoSnapshot, gaps)).toEqual({ total: 8, traced: 3, percent: 38 });
  });

  it('matches release names case-insensitively and rejects unknown ones', () => {
    expect(detectGaps(demoSnapshot, demoConfig, ' 2.3 ')).toHaveLength(gaps.length);
    expect(() => detectGaps(demoSnapshot, demoConfig, '9.9')).toThrow(UnknownReleaseError);
  });
});

describe('individual rules', () => {
  it('G3 reports a test that was never run', () => {
    const s = clone();
    delete s.testCases.find((t) => t.key === 'CSM-T1')!.lastRun;
    const g = detectGaps(s, demoConfig, '2.3').find((x) => x.id === 'G3:REQ-101:CSM-T1');
    expect(g?.message).toContain('has not been run');
  });

  it('G5 is suppressed while a linked test is failing (G3 wins)', () => {
    const s = clone();
    s.testCases.find((t) => t.key === 'CSM-T12')!.lastRun = { result: 'failed', at: '2026-10-21T00:00:00Z' };
    const ids = detectGaps(s, demoConfig, '2.3').map((g) => g.id);
    expect(ids).toContain('G3:REQ-112:CSM-T12');
    expect(ids).not.toContain('G5:REQ-112');
  });

  it('G5 clears once tests are re-run after the merge', () => {
    const s = clone();
    for (const t of s.testCases.filter((t) => t.requirementIds.includes('REQ-112'))) {
      t.lastRun = { result: 'passed', at: '2026-10-21T00:00:00Z' };
    }
    expect(detectGaps(s, demoConfig, '2.3').map((g) => g.id)).not.toContain('G5:REQ-112');
  });

  it('G4 clears when the PR references an issue traced to a requirement', () => {
    const s = clone();
    s.pullRequests.find((p) => p.id === 'PR-63')!.issueKeys = ['CSM-41'];
    expect(detectGaps(s, demoConfig, '2.3').some((g) => g.code === 'G4')).toBe(false);
  });

  it('G4 still fires when the referenced issue has no requirement', () => {
    const s = clone();
    s.workItems.push({ key: 'CSM-99', title: 'Chore', requirementIds: [], fixVersions: ['2.3'] });
    s.pullRequests.find((p) => p.id === 'PR-63')!.issueKeys = ['CSM-99'];
    expect(detectGaps(s, demoConfig, '2.3').some((g) => g.code === 'G4')).toBe(true);
  });

  it('G6 clears when a change request is recorded', () => {
    const s = clone();
    s.requirements.find((r) => r.id === 'REQ-118')!.changeRequestKey = 'CSM-CR-3';
    expect(detectGaps(s, demoConfig, '2.3').map((g) => g.id)).not.toContain('G6:REQ-118');
  });

  it('only counts work items and tests in the requested release', () => {
    const ids = detectGaps(demoSnapshot, demoConfig, '2.2').map((g) => g.code);
    expect(ids.filter((c) => c === 'G1')).toHaveLength(demoSnapshot.requirements.length);
    expect(ids.filter((c) => c === 'G2')).toHaveLength(demoSnapshot.requirements.length);
  });
});
