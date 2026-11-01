import { checkChangeImpact, type ChangeImpact } from './impact';
import { findRequirement, workItemsFor } from './links';
import type { TraceConfig, TraceSnapshot } from './types';

export interface MergeCheckInput {
  repo: string;
  /** Files changed by the pull request (new and old paths). */
  files: string[];
  /** Jira issue keys found in the PR title, branch name and commit messages. */
  issueKeys: string[];
}

export interface MergeCheckResult {
  success: boolean;
  /** Shown on the pull request in Bitbucket. */
  message: string;
  safetyCriticalFiles: string[];
  /** Requirements whose declared code paths (or earlier PRs) cover the changed files. */
  affectedRequirementIds: string[];
  /** Requirements reached through the referenced Jira issues. */
  tracedRequirementIds: string[];
  /** Referenced issue keys that TraceGuard knows (work items or requirements). */
  knownIssueKeys: string[];
  testsToRerun: string[];
}

const MAX_MESSAGE = 900;
const up = (v: string) => v.trim().toUpperCase();

function list(items: string[], max = 4): string {
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')} and ${items.length - max} more`;
}

function describeRequirements(impact: ChangeImpact, ids: string[]): string {
  return list(
    ids.map((id) => {
      const r = impact.requirements.find((x) => x.id === id);
      if (!r) return id;
      const hazards = r.hazards.map((h) => h.id);
      return `${id} (class ${r.safetyClass}${hazards.length ? `, hazard ${hazards.join(', ')}` : ''})`;
    }),
  );
}

/** Requirement IDs reached from issue keys: work items that implement them, or the requirement issue itself. */
function tracedRequirements(s: TraceSnapshot, issueKeys: string[]): { ids: string[]; known: string[] } {
  const ids = new Set<string>();
  const known: string[] = [];
  for (const key of new Set(issueKeys.map(up))) {
    const item = s.workItems.find((w) => up(w.key) === key);
    const req = findRequirement(s, key);
    if (item) item.requirementIds.forEach((id) => ids.add(id));
    if (req) ids.add(req.id);
    if (item || req || s.testCases.some((t) => up(t.key) === key)) known.push(key);
  }
  return { ids: [...ids].sort(), known };
}

/**
 * Decides whether a pull request may merge. A change to safety-critical code must reference a Jira
 * issue that traces to every requirement the change affects; otherwise the check fails and names
 * the requirement, its hazards, an issue to reference and the tests to re-run.
 */
export function evaluateMergeCheck(s: TraceSnapshot, config: TraceConfig, input: MergeCheckInput): MergeCheckResult {
  const impact = checkChangeImpact(s, config, input.repo, input.files);
  const critical = impact.files.filter((f) => f.safetyCritical).map((f) => f.path);
  const affected = impact.requirements.map((r) => r.id);
  const traced = tracedRequirements(s, input.issueKeys);
  const tests = impact.testsToRerun.map((t) => t.key);
  const base = {
    safetyCriticalFiles: critical,
    affectedRequirementIds: affected,
    tracedRequirementIds: traced.ids,
    knownIssueKeys: traced.known,
    testsToRerun: tests,
  };
  const rerun = tests.length ? ` Re-run tests: ${list(tests, 6)}.` : '';
  const done = (success: boolean, message: string): MergeCheckResult => ({
    success,
    message: message.length > MAX_MESSAGE ? `${message.slice(0, MAX_MESSAGE - 1)}…` : message,
    ...base,
  });

  if (!impact.requiresTracedIssue) {
    return done(true, `No safety-critical code changed (${impact.files.length} file(s) checked).`);
  }

  const where = critical.length ? `safety-critical ${list(critical, 3)}` : `class ${impact.highestSafetyClass} code`;

  if (traced.ids.length === 0) {
    const suggestion = affected
      .flatMap((id) => workItemsFor(s, id).map((w) => w.key))
      .find(Boolean);
    const affects = affected.length
      ? ` It affects ${describeRequirements(impact, affected)}.`
      : ' No requirement declares this code yet.';
    const ask = suggestion
      ? ` Add a Jira issue that implements ${affected[0]} to the PR title, for example ${suggestion}.`
      : ' Add a Jira issue that is linked to a requirement to the PR title.';
    const unknown = input.issueKeys.length && !traced.known.length ? ` (${list(input.issueKeys.map(up), 3)} is not traced to a requirement.)` : '';
    return done(false, `Untraced change to ${where}.${affects}${ask}${unknown}${rerun}`);
  }

  const missing = affected.filter((id) => !traced.ids.includes(id));
  if (missing.length) {
    return done(
      false,
      `${list(traced.known, 3)} traces to ${list(traced.ids)}, but this change also affects ${describeRequirements(impact, missing)}. Reference an issue for ${list(missing)} or split the pull request.${rerun}`,
    );
  }

  return done(true, `Traced: ${list(traced.known, 3)} → ${describeRequirements(impact, traced.ids.filter((id) => affected.includes(id) || !affected.length))}.${rerun}`);
}
