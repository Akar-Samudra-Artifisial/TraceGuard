import type { Hazard, Release, Requirement, SafetyClass, TestCase, TestRun, TraceSnapshot, WorkItem } from '../core/types';

/** Jira conventions TraceGuard reads and the demo seed creates. */
export const ISSUE_TYPES = { requirement: 'Requirement', hazard: 'Hazard', test: 'Test Case' } as const;

export const LINK_TYPES = {
  implements: { name: 'Implements', outward: 'implements', inward: 'is implemented by' },
  verifies: { name: 'Verifies', outward: 'verifies', inward: 'is verified by' },
  mitigates: { name: 'Mitigates', outward: 'mitigates', inward: 'is mitigated by' },
} as const;

/** Issue property holding the structured TraceGuard fields of an issue. */
export const PROPERTY_KEY = 'traceguard';

export interface RequirementProperty {
  reqId?: string;
  safetyClass?: SafetyClass;
  status?: 'draft' | 'approved';
  approvedAt?: string;
  changeRequestKey?: string;
  paths?: string[];
}

export interface HazardProperty {
  hazardId?: string;
  severity?: Hazard['severity'];
}

export interface TestProperty {
  lastRun?: TestRun;
}

interface IssueRef {
  key: string;
}

export interface JiraIssue {
  key: string;
  fields: {
    summary?: string;
    issuetype?: { name?: string };
    fixVersions?: { name: string }[];
    assignee?: { displayName?: string } | null;
    issuelinks?: { type?: { name?: string }; inwardIssue?: IssueRef; outwardIssue?: IssueRef }[];
  };
  properties?: Record<string, unknown>;
  changelog?: { histories?: { created: string; items?: { field?: string }[] }[] };
}

export interface JiraVersion {
  name: string;
  releaseDate?: string;
  released?: boolean;
  archived?: boolean;
}

const CLASSES: SafetyClass[] = ['A', 'B', 'C'];
const HAZARD_SEVERITIES: Hazard['severity'][] = ['catastrophic', 'critical', 'serious', 'minor'];
const EDIT_FIELDS = new Set(['summary', 'description']);

const typeOf = (issue: JiraIssue) => issue.fields.issuetype?.name?.toLowerCase() ?? '';
const eqName = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();

function prop<T>(issue: JiraIssue): T {
  const value = issue.properties?.[PROPERTY_KEY];
  return (value && typeof value === 'object' ? value : {}) as T;
}

/** Drops a leading "REQ-112 " / "HAZ-07: " style ID from a summary. */
function titleOf(summary: string | undefined, id: string): string {
  const text = (summary ?? '').trim();
  const prefix = new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:\\-–·]?\\s*`, 'i');
  return text.replace(prefix, '') || id;
}

/** Last time a human edited the requirement text, ignoring creation, links and status changes. */
function lastTextEdit(issue: JiraIssue): string | undefined {
  const edits = (issue.changelog?.histories ?? [])
    .filter((h) => h.items?.some((i) => i.field && EDIT_FIELDS.has(i.field.toLowerCase())))
    .map((h) => h.created);
  const latest = edits.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  // Jira returns "2026-10-31T22:49:58.090-0400"; gap messages use plain ISO UTC.
  return latest && !Number.isNaN(Date.parse(latest)) ? new Date(latest).toISOString() : latest;
}

interface Edge {
  from: string;
  type: string;
  to: string;
}

/** Every issue link as from --outward--> to, deduplicated (Jira returns each link on both ends). */
function edgesOf(issues: JiraIssue[]): Edge[] {
  const seen = new Map<string, Edge>();
  for (const issue of issues) {
    for (const link of issue.fields.issuelinks ?? []) {
      const type = link.type?.name ?? '';
      const edge = link.outwardIssue
        ? { from: issue.key, type, to: link.outwardIssue.key }
        : link.inwardIssue
          ? { from: link.inwardIssue.key, type, to: issue.key }
          : undefined;
      if (edge) seen.set(`${edge.from}|${edge.type}|${edge.to}`, edge);
    }
  }
  return [...seen.values()];
}

/**
 * Turns the issues of one Jira project into a trace snapshot.
 * Requirement, Hazard and Test Case are issue types; any other linked issue is a work item.
 * Pull requests come from elsewhere (Bitbucket app or simulated history).
 */
export function snapshotFromJira(issues: JiraIssue[], versions: JiraVersion[]): Omit<TraceSnapshot, 'pullRequests'> {
  const byType = (name: string) => issues.filter((i) => typeOf(i) === name.toLowerCase());
  const reqIssues = byType(ISSUE_TYPES.requirement);
  const hazardIssues = byType(ISSUE_TYPES.hazard);
  const testIssues = byType(ISSUE_TYPES.test);
  const special = new Set([...reqIssues, ...hazardIssues, ...testIssues].map((i) => i.key));

  const reqId = new Map(reqIssues.map((i) => [i.key, prop<RequirementProperty>(i).reqId?.trim() || i.key]));
  const hazardId = new Map(hazardIssues.map((i) => [i.key, prop<HazardProperty>(i).hazardId?.trim() || i.key]));
  const edges = edgesOf(issues);
  // Roles come from issue types, so link direction does not matter: a Verifies link between a
  // test and a requirement counts whichever way round it was created.
  const targets = (key: string, type: string, map: Map<string, string>) => [
    ...new Set(
      edges
        .filter((e) => eqName(e.type, type) && (e.from === key || e.to === key))
        .map((e) => (e.from === key ? e.to : e.from))
        .filter((other) => map.has(other))
        .map((other) => map.get(other)!),
    ),
  ];

  const requirements: Requirement[] = reqIssues.map((issue) => {
    const p = prop<RequirementProperty>(issue);
    const id = reqId.get(issue.key)!;
    return {
      id,
      key: issue.key,
      title: titleOf(issue.fields.summary, id),
      safetyClass: CLASSES.includes(p.safetyClass as SafetyClass) ? p.safetyClass! : 'B',
      status: p.status ?? (p.approvedAt ? 'approved' : 'draft'),
      approvedAt: p.approvedAt,
      lastEditedAt: lastTextEdit(issue),
      changeRequestKey: p.changeRequestKey,
      hazardIds: targets(issue.key, LINK_TYPES.mitigates.name, hazardId),
      paths: Array.isArray(p.paths) ? p.paths.filter((x): x is string => typeof x === 'string') : [],
    };
  });

  const hazards: Hazard[] = hazardIssues.map((issue) => {
    const p = prop<HazardProperty>(issue);
    const id = hazardId.get(issue.key)!;
    return {
      id,
      key: issue.key,
      title: titleOf(issue.fields.summary, id),
      severity: HAZARD_SEVERITIES.includes(p.severity as Hazard['severity']) ? p.severity! : 'serious',
    };
  });

  const versionsOf = (issue: JiraIssue) => (issue.fields.fixVersions ?? []).map((v) => v.name);
  const assignee = (issue: JiraIssue) => issue.fields.assignee?.displayName;

  const workItems: WorkItem[] = issues
    .filter((i) => !special.has(i.key))
    .map((issue) => ({
      key: issue.key,
      title: issue.fields.summary ?? issue.key,
      requirementIds: targets(issue.key, LINK_TYPES.implements.name, reqId),
      fixVersions: versionsOf(issue),
      assignee: assignee(issue),
    }))
    .filter((w) => w.requirementIds.length > 0);

  const testCases: TestCase[] = testIssues.map((issue) => {
    const run = prop<TestProperty>(issue).lastRun;
    return {
      key: issue.key,
      title: issue.fields.summary ?? issue.key,
      requirementIds: targets(issue.key, LINK_TYPES.verifies.name, reqId),
      fixVersions: versionsOf(issue),
      lastRun: run && (run.result === 'passed' || run.result === 'failed') && run.at ? run : undefined,
      owner: assignee(issue),
    };
  });

  const releases: Release[] = versions
    .filter((v) => !v.archived)
    .map((v) => ({ name: v.name, releaseDate: v.releaseDate, signedOff: Boolean(v.released) }));

  return { requirements, hazards, workItems, testCases, releases };
}
