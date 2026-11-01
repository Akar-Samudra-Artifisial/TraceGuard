import type { PullRequest, Release, Requirement, TestCase, TraceSnapshot, WorkItem } from './types';

export class UnknownReleaseError extends Error {
  constructor(
    readonly release: string,
    readonly available: string[],
  ) {
    super(`Unknown release "${release}". Available: ${available.join(', ') || 'none'}`);
    this.name = 'UnknownReleaseError';
  }
}

const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function findRelease(s: TraceSnapshot, name: string): Release {
  const release = s.releases.find((r) => eq(r.name, name));
  if (!release) throw new UnknownReleaseError(name, s.releases.map((r) => r.name));
  return release;
}

/** The release teams are working towards: the first one not yet signed off. */
export function defaultRelease(s: TraceSnapshot): Release | undefined {
  return s.releases.find((r) => !r.signedOff) ?? s.releases[s.releases.length - 1];
}

export function findRequirement(s: TraceSnapshot, id: string): Requirement | undefined {
  return s.requirements.find((r) => eq(r.id, id) || (r.key !== undefined && eq(r.key, id)));
}

export function workItemsFor(s: TraceSnapshot, reqId: string, release?: string): WorkItem[] {
  return s.workItems.filter(
    (w) => w.requirementIds.includes(reqId) && (!release || w.fixVersions.some((v) => eq(v, release))),
  );
}

export function testsFor(s: TraceSnapshot, reqId: string, release?: string): TestCase[] {
  return s.testCases.filter(
    (t) => t.requirementIds.includes(reqId) && (!release || t.fixVersions.some((v) => eq(v, release))),
  );
}

export function pullRequestsFor(s: TraceSnapshot, items: WorkItem[]): PullRequest[] {
  const keys = new Set(items.map((w) => w.key.toUpperCase()));
  return s.pullRequests.filter((pr) => pr.issueKeys.some((k) => keys.has(k.toUpperCase())));
}

/** Requirement IDs a PR traces to through the Jira issues it references. */
export function requirementsOfPullRequest(s: TraceSnapshot, pr: PullRequest): string[] {
  const keys = new Set(pr.issueKeys.map((k) => k.toUpperCase()));
  const ids = s.workItems.filter((w) => keys.has(w.key.toUpperCase())).flatMap((w) => w.requirementIds);
  return [...new Set(ids)];
}
