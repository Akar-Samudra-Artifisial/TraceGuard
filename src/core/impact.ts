import { isWithin, matchesGlob, normalizePath } from './glob';
import { requirementsOfPullRequest, testsFor, workItemsFor } from './links';
import type { Requirement, SafetyClass, TraceConfig, TraceSnapshot } from './types';

type MatchReason = 'declared-path' | 'pr-history';

export interface ImpactedRequirement {
  id: string;
  title: string;
  safetyClass: SafetyClass;
  hazards: { id: string; title: string }[];
  linkedIssues: string[];
  /** Why this requirement matched: a declared path glob or earlier PR history. */
  matchedBy: MatchReason[];
}

export interface ChangeImpact {
  files: { path: string; safetyCritical: boolean; requirementIds: string[] }[];
  requirements: ImpactedRequirement[];
  testsToRerun: { key: string; title: string; requirementIds: string[] }[];
  highestSafetyClass?: SafetyClass;
  /** True when the change must reference a Jira issue traced to a requirement before merge. */
  requiresTracedIssue: boolean;
}

type Mode = 'file' | 'folder';

/** Literal directory prefix of a glob, e.g. `src/dosing/**` -> `src/dosing`. */
export function globBase(glob: string): string {
  const g = normalizePath(glob);
  const wildcard = g.search(/[*?]/);
  if (wildcard === -1) return g;
  return g.slice(0, wildcard).replace(/\/[^/]*$/, '');
}

/** Does a glob cover `target`? In folder mode, a glob that lives under the folder also counts. */
function globCovers(glob: string, target: string, mode: Mode): boolean {
  if (matchesGlob(target, glob)) return true;
  if (mode === 'file') return false;
  const base = globBase(glob);
  return base !== '' && isWithin(base, target);
}

const CLASS_RANK: Record<SafetyClass, number> = { A: 0, B: 1, C: 2 };

function analyse(s: TraceSnapshot, config: TraceConfig, repo: string, targets: string[], mode: Mode): ChangeImpact {
  const reasons = new Map<string, Set<MatchReason>>();
  const add = (id: string, why: MatchReason) => {
    if (!reasons.has(id)) reasons.set(id, new Set());
    reasons.get(id)!.add(why);
  };
  const touches = (file: string, target: string) =>
    mode === 'file' ? normalizePath(file) === target : isWithin(file, target);

  const files = targets.map((path) => {
    const ids = new Set<string>();
    for (const req of s.requirements) {
      if (req.paths.some((g) => globCovers(g, path, mode))) {
        ids.add(req.id);
        add(req.id, 'declared-path');
      }
    }
    for (const pr of s.pullRequests) {
      if (pr.repo !== repo || !pr.files.some((f) => touches(f, path))) continue;
      for (const id of requirementsOfPullRequest(s, pr)) {
        ids.add(id);
        add(id, 'pr-history');
      }
    }
    return {
      path,
      safetyCritical: config.safetyCriticalPaths.some((g) => globCovers(g, path, mode)),
      requirementIds: [...ids].sort(),
    };
  });

  const reqs: Requirement[] = s.requirements.filter((r) => reasons.has(r.id));
  const requirements = reqs.map((r) => ({
    id: r.id,
    title: r.title,
    safetyClass: r.safetyClass,
    hazards: s.hazards.filter((h) => r.hazardIds.includes(h.id)).map((h) => ({ id: h.id, title: h.title })),
    linkedIssues: workItemsFor(s, r.id).map((w) => w.key),
    matchedBy: [...reasons.get(r.id)!].sort(),
  }));

  const tests = new Map<string, ChangeImpact['testsToRerun'][number]>();
  for (const r of reqs) {
    for (const t of testsFor(s, r.id)) {
      const entry = tests.get(t.key) ?? { key: t.key, title: t.title, requirementIds: [] };
      entry.requirementIds.push(r.id);
      tests.set(t.key, entry);
    }
  }

  const highestSafetyClass = reqs.reduce<SafetyClass | undefined>(
    (acc, r) => (!acc || CLASS_RANK[r.safetyClass] > CLASS_RANK[acc] ? r.safetyClass : acc),
    undefined,
  );

  return {
    files,
    requirements,
    testsToRerun: [...tests.values()],
    highestSafetyClass,
    requiresTracedIssue: files.some((f) => f.safetyCritical) || highestSafetyClass === 'C',
  };
}

/** Requirements, hazards and tests affected by changing exactly these files. */
export function checkChangeImpact(s: TraceSnapshot, config: TraceConfig, repo: string, files: string[]): ChangeImpact {
  const targets = [...new Set(files.map(normalizePath).filter(Boolean))];
  return analyse(s, config, repo, targets, 'file');
}

/** Requirements and hazards linked to a file or folder. */
export function findRequirementsForPath(
  s: TraceSnapshot,
  config: TraceConfig,
  repo: string,
  path: string,
): ChangeImpact {
  return analyse(s, config, repo, [normalizePath(path).replace(/\/$/, '')], 'folder');
}
