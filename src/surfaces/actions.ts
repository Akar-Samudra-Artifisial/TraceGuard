import * as core from '../core';
import { ConfluenceError, createPage, findSpace } from '../adapters/confluence';
import { loadTraceSource, type TraceSource } from '../adapters/source';
import { getBitbucketSecret, getSettings } from '../adapters/store';
import { evidencePageTitle, renderEvidencePage, type EvidencePageContext } from './evidence-page';

/** Payload Forge passes to an `action` function: the declared inputs plus an optional context object. */
export type ActionPayload = Record<string, unknown> & {
  context?: { cloudId?: string; moduleKey?: string; jira?: { issueKey?: string | number } };
};

export type ActionResult = Record<string, unknown> & { summary: string } | { error: string };

const MAX_INPUT = 200;
const MAX_FILES = 100;

class InputError extends Error {}

function optionalString(payload: ActionPayload, name: string): string | undefined {
  const raw = payload[name];
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' && typeof raw !== 'number') throw new InputError(`Input "${name}" must be a string.`);
  const value = String(raw).trim();
  if (value.length > MAX_INPUT) throw new InputError(`Input "${name}" is longer than ${MAX_INPUT} characters.`);
  return value || undefined;
}

function requiredString(payload: ActionPayload, name: string): string {
  const value = optionalString(payload, name);
  if (!value) throw new InputError(`Input "${name}" is required.`);
  return value;
}

/** Accepts a comma/newline separated string or an array of strings. */
function fileList(payload: ActionPayload, name: string): string[] {
  const raw = payload[name];
  const items = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,\n]/) : [];
  const files = items.map((f) => String(f).trim()).filter(Boolean);
  if (files.length === 0) throw new InputError(`Input "${name}" must list at least one file path.`);
  if (files.length > MAX_FILES) throw new InputError(`Input "${name}" lists more than ${MAX_FILES} files.`);
  if (files.some((f) => f.length > MAX_INPUT)) throw new InputError(`A path in "${name}" is too long.`);
  return files;
}

function releaseOf(src: TraceSource, payload: ActionPayload): string {
  const requested = optionalString(payload, 'release');
  if (requested) return core.findRelease(src.snapshot, requested).name;
  const fallback = core.defaultRelease(src.snapshot);
  if (!fallback) throw new InputError('No releases found. Create a Jira fix version first.');
  return fallback.name;
}

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

async function run(
  payload: ActionPayload,
  body: (src: TraceSource) => ActionResult | Promise<ActionResult>,
): Promise<ActionResult> {
  try {
    const src = await loadTraceSource();
    return await body(src);
  } catch (err) {
    if (err instanceof InputError || err instanceof core.UnknownReleaseError) return { error: err.message };
    if (err instanceof ConfluenceError) {
      console.error('TraceGuard Confluence call failed', { moduleKey: payload.context?.moduleKey, err });
      return { error: `Confluence refused the request (${err.message}). Check that Confluence is installed and the app can create pages in the space.` };
    }
    console.error('TraceGuard action failed', { moduleKey: payload.context?.moduleKey, err });
    return { error: 'TraceGuard could not complete this request. Check the app logs.' };
  }
}

const count = (gaps: core.Gap[], severity: core.Severity) => gaps.filter((g) => g.severity === severity).length;

function gapSummary(release: string, gaps: core.Gap[]): string {
  if (gaps.length === 0) return `Release ${release} has no open traceability gaps.`;
  const parts = SEVERITIES.map((s) => [s, count(gaps, s)] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`);
  return `Release ${release} has ${gaps.length} open gap${gaps.length === 1 ? '' : 's'}: ${parts.join(', ')}.`;
}

export const listGaps = (payload: ActionPayload) =>
  run(payload, (src) => {
    const release = releaseOf(src, payload);
    const severity = optionalString(payload, 'severity')?.toLowerCase();
    if (severity && !SEVERITIES.includes(severity as core.Severity)) {
      throw new InputError(`Input "severity" must be one of: ${SEVERITIES.join(', ')}.`);
    }
    const all = core.detectGaps(src.snapshot, src.config, release);
    const gaps = severity ? all.filter((g) => g.severity === severity) : all;
    return {
      summary: gapSummary(release, gaps),
      release,
      coverage: core.computeCoverage(src.snapshot, all),
      gaps,
      simulated: src.simulated,
    };
  });

export const getTrace = (payload: ActionPayload) =>
  run(payload, (src) => {
    const issueFromContext = payload.context?.jira?.issueKey;
    const key = optionalString(payload, 'key') ?? (typeof issueFromContext === 'string' ? issueFromContext : undefined);
    if (!key) throw new InputError('Input "key" is required (requirement ID or Jira issue key).');
    const release = releaseOf(src, payload);
    const result = core.getTrace(src.snapshot, src.config, key, release);
    const summary =
      result.chains.length === 0
        ? `No requirement is traced to ${key}.`
        : result.chains
            .map((c) => `${c.requirement.id} (class ${c.requirement.safetyClass}): ${c.gaps.length} open gap(s)`)
            .join('; ');
    return { summary, ...result, simulated: src.simulated };
  });

function impactSummary(impact: core.ChangeImpact): string {
  if (impact.requirements.length === 0) {
    return impact.requiresTracedIssue
      ? 'These files are safety-critical but no requirement is traced to them. Ask for a Jira issue before editing.'
      : 'No traced requirements are affected.';
  }
  const reqs = impact.requirements
    .map((r) => `${r.id} (class ${r.safetyClass}${r.hazards.length ? `, mitigates ${r.hazards.map((h) => h.id).join(', ')}` : ''})`)
    .join('; ');
  const tests = impact.testsToRerun.map((t) => t.key).join(', ') || 'none';
  return `Affects ${reqs}. Tests to re-run: ${tests}.${impact.requiresTracedIssue ? ' A traced Jira issue is required.' : ''}`;
}

export const checkChangeImpact = (payload: ActionPayload) =>
  run(payload, (src) => {
    const repo = optionalString(payload, 'repo') ?? src.defaultRepo;
    const impact = core.checkChangeImpact(src.snapshot, src.config, repo, fileList(payload, 'files'));
    return { summary: impactSummary(impact), repo, ...impact, simulated: src.simulated };
  });

export const findRequirementsForPath = (payload: ActionPayload) =>
  run(payload, (src) => {
    const repo = optionalString(payload, 'repo') ?? src.defaultRepo;
    const impact = core.findRequirementsForPath(src.snapshot, src.config, repo, requiredString(payload, 'path'));
    return { summary: impactSummary(impact), repo, ...impact, simulated: src.simulated };
  });

const SPACE_KEY = /^~?[A-Za-z0-9]{1,255}$/;

/** Builds the evidence pack and publishes it as a new Confluence page (one page per run, never overwritten). */
export const generateEvidencePack = (payload: ActionPayload) =>
  run(payload, async (src) => {
    const release = releaseOf(src, payload);
    const requestedSpace = optionalString(payload, 'space');
    if (requestedSpace && !SPACE_KEY.test(requestedSpace)) throw new InputError('Input "space" must be a Confluence space key.');
    const spaceKey = requestedSpace ?? (await getSettings())?.confluenceSpaceKey;

    // Explicit or configured space; otherwise a space named like the Jira project (the demo creates CSM),
    // otherwise the first global space.
    let { space, siteUrl } = await findSpace(spaceKey ?? src.projectKey);
    if (!space && !spaceKey) ({ space, siteUrl } = await findSpace());
    if (!space) {
      throw new InputError(
        spaceKey
          ? `Confluence space "${spaceKey}" was not found or the app cannot see it.`
          : 'No Confluence space found. Create a space or pass the "space" input.',
      );
    }

    const pack = core.buildEvidencePack(src.snapshot, src.config, release);
    const ctx: EvidencePageContext = {
      projectKey: src.projectKey,
      siteUrl,
      simulated: src.simulated,
      simulatedPullRequests: src.snapshot.pullRequests.some((pr) => pr.simulated),
    };
    const page = await createPage(
      space.id,
      evidencePageTitle(pack, ctx),
      renderEvidencePage(pack, src.snapshot, ctx),
      evidencePageTitle(pack, ctx, true),
    );
    return {
      summary: `Published the evidence pack for ${release} to Confluence space ${space.key}: ${pack.coverage.traced}/${pack.coverage.total} requirements fully traced (${pack.coverage.percent}%), ${pack.gaps.length} open gap(s). ${page.url}`,
      release,
      generatedAt: pack.generatedAt,
      coverage: pack.coverage,
      gaps: pack.gaps,
      pageTitle: page.title,
      pageUrl: page.url,
      space: space.key,
      simulated: src.simulated,
    };
  });

export const assignGap = (payload: ActionPayload) =>
  run(payload, (src) => {
    const gapId = requiredString(payload, 'gapId');
    const open = src.snapshot.releases
      .filter((r) => !r.signedOff)
      .flatMap((r) => core.detectGaps(src.snapshot, src.config, r.name));
    const gap = open.find((g) => g.id.toLowerCase() === gapId.toLowerCase());
    if (!gap) throw new InputError(`No open gap with ID "${gapId}". Call list_gaps to see current gap IDs.`);
    const assignee = optionalString(payload, 'assignee') ?? gap.owner;
    return {
      summary: `Would create a Jira task "Close ${gap.code} gap: ${gap.requirementId ?? gap.artifactKey}" assigned to ${assignee ?? 'nobody'}. Issue creation is not enabled yet.`,
      gap,
      wouldCreate: {
        summary: `Close ${gap.code} gap: ${gap.requirementId ?? gap.artifactKey}`,
        description: gap.message,
        assignee: assignee ?? null,
      },
      issueKey: null,
      simulated: true,
    };
  });

/** Data behind the Jira project page and Confluence macro: one row per requirement plus all open gaps. */
export const getOverview = (payload: ActionPayload) =>
  run(payload, (src) => {
    const release = releaseOf(src, payload);
    const pack = core.buildEvidencePack(src.snapshot, src.config, release);
    const hazards = Object.fromEntries(src.snapshot.hazards.map((h) => [h.id, h]));
    return {
      summary: gapSummary(release, pack.gaps),
      release,
      releases: src.snapshot.releases,
      coverage: pack.coverage,
      rows: pack.rows.map((row) => ({
        ...row,
        hazards: row.hazards.map((id) => hazards[id] ?? { id, title: id, severity: 'minor' as const }),
        gaps: pack.gaps.filter((g) => g.requirementId === row.requirementId),
      })),
      gaps: pack.gaps,
      untracedChanges: pack.gaps.filter((g) => !g.requirementId),
      projectKey: src.projectKey ?? null,
      simulatedPullRequests: src.snapshot.pullRequests.some((pr) => pr.simulated),
      simulated: src.simulated,
    };
  });

/** Data behind the Jira admin page: what TraceGuard reads and how it classifies code. */
export const getSetupInfo = (payload: ActionPayload) =>
  run(payload, async (src) => {
    const s = src.snapshot;
    const bitbucketConnected = Boolean(await getBitbucketSecret());
    return {
      summary: `TraceGuard reads ${s.requirements.length} requirements across ${s.releases.length} releases.`,
      dataSource: src.simulated ? 'demo' : 'live',
      projectKey: src.projectKey ?? null,
      fallbackReason: src.fallbackReason ?? null,
      defaultRepo: src.defaultRepo,
      safetyCriticalPaths: src.config.safetyCriticalPaths,
      releases: s.releases,
      counts: {
        requirements: s.requirements.length,
        hazards: s.hazards.length,
        workItems: s.workItems.length,
        testCases: s.testCases.length,
        pullRequests: s.pullRequests.length,
        bitbucketPullRequests: s.pullRequests.filter((pr) => !pr.simulated).length,
      },
      bitbucketConnected,
      requirementPaths: s.requirements.map((r) => ({ id: r.id, safetyClass: r.safetyClass, paths: r.paths })),
      simulated: src.simulated,
    };
  });
