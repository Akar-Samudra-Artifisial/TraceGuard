import type { WebTriggerRequest, WebTriggerResponse } from '@forge/api';
import * as core from '../core';
import { SIGNATURE_HEADER, verify } from '../adapters/signature';
import { loadTraceSource } from '../adapters/source';
import { getBitbucketSecret, upsertPullRequest } from '../adapters/store';

/**
 * Web trigger `trace-lookup`, called by the TraceGuard Bitbucket app's merge check.
 * Request (JSON, signed with the shared secret):
 *   { repo, trigger, pullRequest: { id, title }, files[], issueKeys[], safetyCriticalPaths? }
 * A `pullRequest.author` sent by older Bitbucket app versions is accepted but never stored (no personal data).
 * Response: core.MergeCheckResult plus `simulated`.
 */

const MAX_BODY = 256 * 1024;
const MAX_FILES = 500;
const MAX_KEYS = 50;
const MAX_GLOBS = 50;
const MAX_TEXT = 300;
const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

export interface LookupRequest {
  repo: string;
  trigger: string;
  pullRequest: { id: string; title: string; author?: string };
  files: string[];
  issueKeys: string[];
  safetyCriticalPaths?: string[];
}

class BadRequest extends Error {}

const json = (statusCode: number, body: unknown): WebTriggerResponse => ({
  statusCode,
  headers: { 'Content-Type': ['application/json'] },
  body: JSON.stringify(body),
});

function header(req: WebTriggerRequest, name: string): string | undefined {
  const entry = Object.entries(req.headers ?? {}).find(([k]) => k.toLowerCase() === name);
  return entry?.[1]?.[0];
}

function text(value: unknown, name: string, max = MAX_TEXT, required = true): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) throw new BadRequest(`"${name}" is required.`);
    return undefined;
  }
  if (typeof value !== 'string' && typeof value !== 'number') throw new BadRequest(`"${name}" must be a string.`);
  return String(value).slice(0, max);
}

function strings(value: unknown, name: string, max: number, test?: (s: string) => boolean): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) throw new BadRequest(`"${name}" must be an array of at most ${max} items.`);
  const items = value.map((v) => (typeof v === 'string' ? v.trim() : ''));
  if (items.some((s) => !s || s.length > MAX_TEXT || (test && !test(s)))) throw new BadRequest(`"${name}" has an invalid item.`);
  return [...new Set(items)];
}

export function parseLookup(body: string): LookupRequest {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new BadRequest('Body must be JSON.');
  }
  if (!raw || typeof raw !== 'object') throw new BadRequest('Body must be a JSON object.');
  const repo = text(raw.repo, 'repo')!;
  if (!REPO.test(repo)) throw new BadRequest('"repo" must be a repository slug.');
  const pr = (raw.pullRequest ?? {}) as Record<string, unknown>;
  const paths = raw.safetyCriticalPaths;
  return {
    repo,
    trigger: text(raw.trigger, 'trigger', 40)!,
    pullRequest: {
      id: text(pr.id, 'pullRequest.id', 20)!,
      title: text(pr.title, 'pullRequest.title', 500)!,
      author: text(pr.author, 'pullRequest.author', 200, false),
    },
    files: strings(raw.files, 'files', MAX_FILES),
    issueKeys: strings(raw.issueKeys, 'issueKeys', MAX_KEYS, (k) => ISSUE_KEY.test(k)),
    safetyCriticalPaths: paths === undefined ? undefined : strings(paths, 'safetyCriticalPaths', MAX_GLOBS),
  };
}

export async function traceLookup(req: WebTriggerRequest): Promise<WebTriggerResponse> {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  const body = req.body ?? '';
  if (body.length > MAX_BODY) return json(413, { error: 'Body too large.' });

  const secret = await getBitbucketSecret();
  if (!secret) return json(503, { error: 'TraceGuard for Jira has no Bitbucket connection yet. Generate one in TraceGuard setup.' });
  const auth = verify(secret, body, header(req, SIGNATURE_HEADER));
  if (!auth.ok) {
    console.warn('TraceGuard trace-lookup rejected', { reason: auth.reason });
    return json(401, { error: 'Invalid or expired signature. Reconnect the Bitbucket app with the current secret.' });
  }

  try {
    const input = parseLookup(body);
    const src = await loadTraceSource();
    const config = input.safetyCriticalPaths?.length ? { safetyCriticalPaths: input.safetyCriticalPaths } : src.config;
    const result = core.evaluateMergeCheck(src.snapshot, config, input);

    // Merged pull requests become trace history (replacing the demo's simulated ones over time).
    // Open PRs are not recorded, so an unmerged change never shows up as a release gap.
    if (input.trigger === 'on-merge' && result.success && !src.simulated) {
      await upsertPullRequest({
        id: `PR-${input.pullRequest.id}`,
        repo: input.repo,
        title: input.pullRequest.title,
        issueKeys: input.issueKeys,
        files: input.files,
        mergedAt: new Date().toISOString(),
      });
    }
    return json(200, { ...result, simulated: src.simulated, projectKey: src.projectKey ?? null });
  } catch (err) {
    if (err instanceof BadRequest || err instanceof core.UnknownReleaseError) return json(400, { error: err.message });
    console.error('TraceGuard trace-lookup failed', err);
    return json(500, { error: 'TraceGuard could not evaluate this pull request. Check the Jira app logs.' });
  }
}
