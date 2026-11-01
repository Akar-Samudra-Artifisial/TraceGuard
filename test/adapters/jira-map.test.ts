import { describe, expect, it } from 'vitest';
import * as core from '../../src/core';
import { demoConfig, demoSnapshot } from '../../src/demo/cardiosense';
import { PROPERTY_KEY, snapshotFromJira, type JiraIssue } from '../../src/adapters/jira-map';

/** Mirrors what the demo seed creates in Jira, with keys CSM-1.. and links stored on one side only. */
function seededIssues(opts: { linkSpareTest?: boolean } = {}) {
  let n = 0;
  const keyOf = new Map<string, string>();
  const issues: JiraIssue[] = [];
  const add = (ref: string, type: string, summary: string, property: object, extra: Partial<JiraIssue['fields']> = {}) => {
    const key = `CSM-${++n}`;
    keyOf.set(ref, key);
    const issue: JiraIssue = { key, fields: { summary, issuetype: { name: type }, issuelinks: [], ...extra }, properties: { [PROPERTY_KEY]: property } };
    issues.push(issue);
    return issue;
  };
  const link = (type: string, from: string, to: string) => {
    issues.find((i) => i.key === keyOf.get(from))!.fields.issuelinks!.push({ type: { name: type }, outwardIssue: { key: keyOf.get(to)! } });
  };
  const versions = (v: string[]) => ({ fixVersions: v.map((name) => ({ name })) });

  for (const h of demoSnapshot.hazards) add(h.id, 'Hazard', `${h.id} ${h.title}`, { hazardId: h.id, severity: h.severity });
  for (const r of demoSnapshot.requirements) {
    const issue = add(r.id, 'Requirement', `${r.id} ${r.title}`, {
      reqId: r.id, safetyClass: r.safetyClass, status: r.status, approvedAt: r.approvedAt, paths: r.paths,
    });
    if (r.lastEditedAt && r.lastEditedAt !== r.approvedAt) {
      issue.changelog = { histories: [
        { created: '2026-10-26T10:00:00Z', items: [{ field: 'Link' }] },
        { created: r.lastEditedAt, items: [{ field: 'description' }] },
      ] };
    }
  }
  for (const w of demoSnapshot.workItems) add(w.key, 'Story', w.title, {}, { ...versions(w.fixVersions), assignee: { displayName: w.assignee } });
  for (const t of demoSnapshot.testCases) add(t.key, 'Test Case', t.title, { lastRun: t.lastRun }, versions(t.fixVersions));
  add('SPARE', 'Test Case', 'Battery warning shown at 15%', { lastRun: { result: 'passed', at: '2026-10-12T10:00:00Z' } }, versions(['2.3']));
  add('NOISE', 'Bug', 'Unrelated bug', {});

  for (const r of demoSnapshot.requirements) for (const h of r.hazardIds) link('Mitigates', r.id, h);
  // Implements stored from the requirement side, to prove direction does not matter.
  for (const w of demoSnapshot.workItems) for (const r of w.requirementIds) link('Implements', r, w.key);
  for (const t of demoSnapshot.testCases) for (const r of t.requirementIds) link('Verifies', t.key, r);
  if (opts.linkSpareTest) link('Verifies', 'SPARE', 'REQ-109');

  const pullRequests = demoSnapshot.pullRequests.map((pr) => ({ ...pr, issueKeys: pr.issueKeys.map((k) => keyOf.get(k)!) }));
  return { issues, keyOf, pullRequests };
}

const VERSIONS = [
  { name: '2.2', releaseDate: '2026-08-15', released: true },
  { name: '2.3', releaseDate: '2026-12-01', released: false },
  { name: '1.0', released: true, archived: true },
];

describe('snapshotFromJira', () => {
  it('maps the seeded project to the same six gaps as the fixture', () => {
    const { issues, pullRequests } = seededIssues();
    const s = { ...snapshotFromJira(issues, VERSIONS), pullRequests };
    const gaps = core.detectGaps(s, demoConfig, '2.3');
    const expected = core.detectGaps(demoSnapshot, demoConfig, '2.3');
    const shape = (list: core.Gap[]) => list.map((g) => `${g.code}:${g.requirementId ?? g.artifactKey}`).sort();
    expect(shape(gaps)).toEqual(shape(expected));
    expect(core.computeCoverage(s, gaps)).toEqual({ total: 8, traced: 3, percent: 38 });
    expect(s.releases.map((r) => r.name)).toEqual(['2.2', '2.3']);
  });

  it('reads IDs, titles, hazards and owners from issues and properties', () => {
    const { issues, keyOf } = seededIssues();
    const s = snapshotFromJira(issues, VERSIONS);
    const req = s.requirements.find((r) => r.id === 'REQ-112')!;
    expect(req).toMatchObject({ key: keyOf.get('REQ-112'), title: 'Enforce maximum dose limit', safetyClass: 'C', hazardIds: ['HAZ-07'] });
    expect(req.lastEditedAt).toBeUndefined();
    expect(s.requirements.find((r) => r.id === 'REQ-118')!.lastEditedAt).toBe('2026-10-25T14:30:00.000Z');
    expect(s.workItems.find((w) => w.key === keyOf.get('CSM-41'))).toMatchObject({ requirementIds: ['REQ-112'], assignee: 'Bayu' });
    expect(s.workItems.some((w) => w.title === 'Unrelated bug')).toBe(false);
  });

  it('linking the spare test closes G2 and raises coverage to 50%', () => {
    const { issues, pullRequests } = seededIssues({ linkSpareTest: true });
    const s = { ...snapshotFromJira(issues, VERSIONS), pullRequests };
    const gaps = core.detectGaps(s, demoConfig, '2.3');
    expect(gaps.some((g) => g.code === 'G2')).toBe(false);
    expect(gaps).toHaveLength(5);
    expect(core.computeCoverage(s, gaps).percent).toBe(50);
  });

  it('finds a requirement by its Jira key as well as its ID', () => {
    const { issues, keyOf } = seededIssues();
    const s = { ...snapshotFromJira(issues, VERSIONS), pullRequests: [] };
    expect(core.findRequirement(s, keyOf.get('REQ-112')!)?.id).toBe('REQ-112');
  });
});
