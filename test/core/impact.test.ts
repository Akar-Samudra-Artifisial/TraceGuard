import { describe, expect, it } from 'vitest';
import { checkChangeImpact, findRequirementsForPath, globBase, isWithin, matchesGlob } from '../../src/core';
import { DEMO_REPO, demoConfig, demoSnapshot } from '../../src/demo/cardiosense';

describe('glob', () => {
  it.each([
    ['src/dosing/limits.ts', 'src/dosing/**', true],
    ['src/dosing/a/b.ts', 'src/dosing/**', true],
    ['src/dosing.ts', 'src/dosing/**', false],
    ['src/a.ts', 'src/*.ts', true],
    ['src/x/a.ts', 'src/*.ts', false],
    ['src/x/a.ts', 'src/**/a.ts', true],
    ['src/a.ts', 'src/**/a.ts', true],
    ['./src/a.ts', 'src/a?ts', true],
    ['src/a+b.ts', 'src/a+b.ts', true],
  ])('%s vs %s -> %s', (path, glob, expected) => {
    expect(matchesGlob(path, glob)).toBe(expected);
  });

  it('isWithin and globBase', () => {
    expect(isWithin('src/dosing/limits.ts', 'src/dosing/')).toBe(true);
    expect(isWithin('src/dosingx/a.ts', 'src/dosing')).toBe(false);
    expect(globBase('src/dosing/**')).toBe('src/dosing');
    expect(globBase('src/do*')).toBe('src');
    expect(globBase('src/dosing/limits.ts')).toBe('src/dosing/limits.ts');
  });
});

describe('checkChangeImpact', () => {
  it('reproduces the demo: limits.ts -> REQ-112, HAZ-07, two tests', () => {
    const impact = checkChangeImpact(demoSnapshot, demoConfig, DEMO_REPO, ['src/dosing/limits.ts']);
    expect(impact.requirements).toHaveLength(1);
    expect(impact.requirements[0]).toMatchObject({
      id: 'REQ-112',
      safetyClass: 'C',
      hazards: [{ id: 'HAZ-07', title: 'Dose advisory above safe maximum' }],
      linkedIssues: ['CSM-41'],
      matchedBy: ['declared-path', 'pr-history'],
    });
    expect(impact.testsToRerun.map((t) => t.key)).toEqual(['CSM-T12', 'CSM-T13']);
    expect(impact.highestSafetyClass).toBe('C');
    expect(impact.requiresTracedIssue).toBe(true);
  });

  it('flags safety-critical files that no requirement covers', () => {
    const impact = checkChangeImpact(demoSnapshot, demoConfig, DEMO_REPO, ['src/dosing/rounding.ts']);
    expect(impact.requirements).toEqual([]);
    expect(impact.files[0]).toMatchObject({ safetyCritical: true, requirementIds: [] });
    expect(impact.requiresTracedIssue).toBe(true);
  });

  it('ignores PR history from other repositories', () => {
    const impact = checkChangeImpact(demoSnapshot, demoConfig, 'other-repo', ['src/dosing/limits.test.ts']);
    expect(impact.requirements).toEqual([]);
  });

  it('is calm for non-critical files and de-duplicates input', () => {
    const impact = checkChangeImpact(demoSnapshot, demoConfig, DEMO_REPO, ['src/ui/theme.ts', './src/ui/theme.ts']);
    expect(impact.files).toHaveLength(1);
    expect(impact.requiresTracedIssue).toBe(false);
  });
});

describe('findRequirementsForPath', () => {
  it('finds every requirement under a folder', () => {
    const r = findRequirementsForPath(demoSnapshot, demoConfig, DEMO_REPO, 'src/alarms/');
    expect(r.requirements.map((x) => x.id).sort()).toEqual(['REQ-104', 'REQ-115']);
    expect(r.files[0]?.safetyCritical).toBe(true);
  });

  it('works for a single file', () => {
    const r = findRequirementsForPath(demoSnapshot, demoConfig, DEMO_REPO, 'src/ecg/qrs/detector.ts');
    expect(r.requirements.map((x) => x.id)).toEqual(['REQ-101']);
  });
});
