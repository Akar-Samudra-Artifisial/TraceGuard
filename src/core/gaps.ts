import { matchesAny } from './glob';
import {
  findRelease,
  pullRequestsFor,
  requirementsOfPullRequest,
  testsFor,
  workItemsFor,
} from './links';
import type { Gap, Requirement, Severity, TraceConfig, TraceSnapshot } from './types';

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const time = (iso: string) => Date.parse(iso);

function g1(s: TraceSnapshot, req: Requirement, release: string): Gap[] {
  if (workItemsFor(s, req.id, release).length > 0) return [];
  return [
    {
      id: `G1:${req.id}`,
      code: 'G1',
      severity: req.safetyClass === 'C' ? 'high' : 'medium',
      requirementId: req.id,
      message: `${req.id} has no linked story or task in release ${release}.`,
    },
  ];
}

function g2(s: TraceSnapshot, req: Requirement, release: string): Gap[] {
  if (testsFor(s, req.id, release).length > 0) return [];
  return [
    {
      id: `G2:${req.id}`,
      code: 'G2',
      severity: 'high',
      requirementId: req.id,
      message: `${req.id} has no linked test case in release ${release}.`,
    },
  ];
}

function g3(s: TraceSnapshot, req: Requirement, release: string): Gap[] {
  return testsFor(s, req.id, release)
    .filter((t) => t.lastRun?.result !== 'passed')
    .map((t) => ({
      id: `G3:${req.id}:${t.key}`,
      code: 'G3' as const,
      severity: 'high' as const,
      requirementId: req.id,
      artifactKey: t.key,
      owner: t.owner,
      message: t.lastRun
        ? `Test ${t.key} for ${req.id} failed on ${t.lastRun.at}.`
        : `Test ${t.key} for ${req.id} has not been run for release ${release}.`,
    }));
}

function g5(s: TraceSnapshot, req: Requirement, release: string): Gap[] {
  const tests = testsFor(s, req.id, release);
  // Failed or missing runs are already G3; staleness only matters once everything passed.
  if (tests.length === 0 || tests.some((t) => t.lastRun?.result !== 'passed')) return [];

  const items = workItemsFor(s, req.id, release);
  const merges = pullRequestsFor(s, items)
    .filter((pr) => pr.mergedAt)
    .map((pr) => ({ pr, at: time(pr.mergedAt!) }));
  if (merges.length === 0) return [];

  const latest = merges.reduce((a, b) => (b.at > a.at ? b : a));
  const stale = tests.filter((t) => time(t.lastRun!.at) < latest.at);
  if (stale.length === 0) return [];

  return [
    {
      id: `G5:${req.id}`,
      code: 'G5',
      severity: 'medium',
      requirementId: req.id,
      artifactKey: latest.pr.id,
      owner: items[0]?.assignee,
      message: `PR ${latest.pr.id} for ${req.id} merged after the last passing run of ${stale
        .map((t) => t.key)
        .join(', ')}. Re-run before release ${release}.`,
    },
  ];
}

function g6(req: Requirement): Gap[] {
  if (req.status !== 'approved' || !req.approvedAt || !req.lastEditedAt || req.changeRequestKey) return [];
  if (time(req.lastEditedAt) <= time(req.approvedAt)) return [];
  return [
    {
      id: `G6:${req.id}`,
      code: 'G6',
      severity: 'high',
      requirementId: req.id,
      message: `${req.id} was edited on ${req.lastEditedAt} after approval on ${req.approvedAt} without a change request.`,
    },
  ];
}

function g4(s: TraceSnapshot, config: TraceConfig): Gap[] {
  return s.pullRequests.flatMap((pr) => {
    const critical = pr.files.filter((f) => matchesAny(f, config.safetyCriticalPaths));
    if (critical.length === 0 || requirementsOfPullRequest(s, pr).length > 0) return [];
    return [
      {
        id: `G4:${pr.repo}:${pr.id}`,
        code: 'G4' as const,
        severity: 'critical' as const,
        artifactKey: pr.id,
        owner: pr.author,
        message: `PR ${pr.id} touches safety-critical ${critical.join(', ')} with no traced requirement.`,
      },
    ];
  });
}

export function sortGaps(gaps: Gap[]): Gap[] {
  return [...gaps].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.id.localeCompare(b.id),
  );
}

/** Detect G1–G6 for one release. Throws UnknownReleaseError for an unknown release name. */
export function detectGaps(s: TraceSnapshot, config: TraceConfig, releaseName: string): Gap[] {
  const release = findRelease(s, releaseName).name;
  const perRequirement = s.requirements.flatMap((req) => [
    ...g1(s, req, release),
    ...g2(s, req, release),
    ...g3(s, req, release),
    ...g5(s, req, release),
    ...g6(req),
  ]);
  return sortGaps([...perRequirement, ...g4(s, config)]);
}

export interface Coverage {
  total: number;
  traced: number;
  percent: number;
}

/** Share of requirements with no open gap. */
export function computeCoverage(s: TraceSnapshot, gaps: Gap[]): Coverage {
  const withGap = new Set(gaps.map((g) => g.requirementId).filter(Boolean));
  const total = s.requirements.length;
  const traced = s.requirements.filter((r) => !withGap.has(r.id)).length;
  return { total, traced, percent: total === 0 ? 100 : Math.round((traced / total) * 100) };
}
