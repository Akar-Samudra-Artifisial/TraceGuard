import { computeCoverage, detectGaps, type Coverage } from './gaps';
import { findRequirement, pullRequestsFor, testsFor, workItemsFor } from './links';
import type { Gap, Hazard, PullRequest, Requirement, TestCase, TraceConfig, TraceSnapshot, WorkItem } from './types';

export interface TraceChain {
  requirement: Requirement;
  hazards: Hazard[];
  workItems: WorkItem[];
  pullRequests: PullRequest[];
  testCases: TestCase[];
  releases: string[];
  gaps: Gap[];
}

export interface TraceResult {
  key: string;
  matchedAs: 'requirement' | 'work-item' | 'test-case' | 'pull-request' | 'none';
  release: string;
  chains: TraceChain[];
}

const up = (v: string) => v.trim().toUpperCase();

function resolveRequirementIds(s: TraceSnapshot, key: string): Pick<TraceResult, 'matchedAs'> & { ids: string[] } {
  const k = up(key);
  const req = findRequirement(s, k);
  if (req) return { matchedAs: 'requirement', ids: [req.id] };
  const item = s.workItems.find((w) => up(w.key) === k);
  if (item) return { matchedAs: 'work-item', ids: item.requirementIds };
  const test = s.testCases.find((t) => up(t.key) === k);
  if (test) return { matchedAs: 'test-case', ids: test.requirementIds };
  const pr = s.pullRequests.find((p) => up(p.id) === k);
  if (pr) {
    const keys = new Set(pr.issueKeys.map(up));
    return {
      matchedAs: 'pull-request',
      ids: [...new Set(s.workItems.filter((w) => keys.has(up(w.key))).flatMap((w) => w.requirementIds))],
    };
  }
  return { matchedAs: 'none', ids: [] };
}

/** Full chain REQ -> work item -> PR -> test -> release for a requirement, issue, test or PR key. */
export function getTrace(s: TraceSnapshot, config: TraceConfig, key: string, release: string): TraceResult {
  const { matchedAs, ids } = resolveRequirementIds(s, key);
  const gaps = detectGaps(s, config, release);
  const chains = ids
    .map((id) => findRequirement(s, id))
    .filter((r): r is Requirement => Boolean(r))
    .map((requirement) => {
      const workItems = workItemsFor(s, requirement.id);
      const testCases = testsFor(s, requirement.id);
      return {
        requirement,
        hazards: s.hazards.filter((h) => requirement.hazardIds.includes(h.id)),
        workItems,
        pullRequests: pullRequestsFor(s, workItems),
        testCases,
        releases: [...new Set([...workItems, ...testCases].flatMap((x) => x.fixVersions))].sort(),
        gaps: gaps.filter((g) => g.requirementId === requirement.id),
      };
    });
  return { key, matchedAs, release, chains };
}

export interface EvidenceRow {
  requirementId: string;
  title: string;
  safetyClass: Requirement['safetyClass'];
  hazards: string[];
  workItems: string[];
  pullRequests: string[];
  tests: { key: string; result: 'passed' | 'failed' | 'not-run' }[];
  status: 'traced' | 'gap';
}

export interface EvidencePack {
  release: string;
  generatedAt: string;
  coverage: Coverage;
  rows: EvidenceRow[];
  gaps: Gap[];
}

/** Data behind the Confluence evidence pack page for one release. */
export function buildEvidencePack(
  s: TraceSnapshot,
  config: TraceConfig,
  release: string,
  now: Date = new Date(),
): EvidencePack {
  const gaps = detectGaps(s, config, release);
  const gapReqs = new Set(gaps.map((g) => g.requirementId));
  const rows = s.requirements.map((r) => {
    const items = workItemsFor(s, r.id, release);
    return {
      requirementId: r.id,
      title: r.title,
      safetyClass: r.safetyClass,
      hazards: r.hazardIds,
      workItems: items.map((w) => w.key),
      pullRequests: pullRequestsFor(s, items).map((p) => p.id),
      tests: testsFor(s, r.id, release).map((t) => ({ key: t.key, result: t.lastRun?.result ?? ('not-run' as const) })),
      status: gapReqs.has(r.id) ? ('gap' as const) : ('traced' as const),
    };
  });
  return { release, generatedAt: now.toISOString(), coverage: computeCoverage(s, gaps), rows, gaps };
}
