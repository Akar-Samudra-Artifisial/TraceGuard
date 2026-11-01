import { CONFIG_FILE, ConfigError, parseRepoConfig } from './config';
import { extractIssueKeys } from './keys';
import { sign, SIGNATURE_HEADER } from './signature';
import type { Connection } from './store';
import type { PrRef, PullRequestInfo } from './bitbucket';

/** Payload Bitbucket passes to a `bitbucket:mergeCheck` function. */
export interface MergeCheckEvent {
  workspace: { uuid: string };
  repository: { uuid: string };
  pullrequest: { id: number };
  trigger: { type: string };
}

export interface MergeCheckResponse {
  success: boolean;
  message?: string;
}

export interface CheckDeps {
  getConnection(): Promise<Connection | undefined>;
  getPullRequest(ref: PrRef): Promise<PullRequestInfo>;
  getRepoSlug(ref: PrRef): Promise<string>;
  getChangedFiles(ref: PrRef): Promise<string[]>;
  getCommitMessages(ref: PrRef): Promise<string[]>;
  getFile(ref: PrRef, commit: string, path: string): Promise<string | undefined>;
  post(url: string, body: string, headers: Record<string, string>): Promise<{ status: number; text: string }>;
}

const MAX_MESSAGE = 1000;
const fail = (message: string): MergeCheckResponse => ({ success: false, message: message.slice(0, MAX_MESSAGE) });

function errorOf(text: string): string | undefined {
  try {
    const body = JSON.parse(text) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Collects the changed files and Jira issue keys of a pull request, asks TraceGuard for Jira whether
 * the change is traced, and returns its verdict. Fails closed: if Jira cannot be asked, the check fails.
 */
export async function runMergeCheck(event: MergeCheckEvent, deps: CheckDeps): Promise<MergeCheckResponse> {
  const connection = await deps.getConnection();
  if (!connection) {
    return fail('TraceGuard is not connected to Jira yet. A workspace admin must open Workspace settings → TraceGuard and paste the connection from TraceGuard setup in Jira.');
  }

  const ref: PrRef = { workspace: event.workspace.uuid, repository: event.repository.uuid, id: event.pullrequest.id };
  const [pr, slug, files, commits] = await Promise.all([
    deps.getPullRequest(ref),
    deps.getRepoSlug(ref),
    deps.getChangedFiles(ref),
    deps.getCommitMessages(ref),
  ]);

  let config;
  try {
    config = parseRepoConfig(pr.destinationCommit ? await deps.getFile(ref, pr.destinationCommit, CONFIG_FILE) : undefined);
  } catch (e) {
    if (e instanceof ConfigError) return fail(e.message);
    throw e;
  }

  const body = JSON.stringify({
    repo: config.repo ?? slug,
    trigger: event.trigger.type,
    pullRequest: { id: pr.id, title: pr.title.slice(0, 500), author: pr.author },
    files: files.slice(0, 500),
    issueKeys: extractIssueKeys([pr.title, pr.sourceBranch, ...commits]),
    ...(config.safetyCriticalPaths ? { safetyCriticalPaths: config.safetyCriticalPaths } : {}),
  });

  let res: { status: number; text: string };
  try {
    res = await deps.post(connection.url, body, {
      'Content-Type': 'application/json',
      [SIGNATURE_HEADER]: sign(connection.secret, body),
    });
  } catch (e) {
    console.error('TraceGuard: Jira web trigger unreachable', e);
    return fail('TraceGuard could not reach Jira, so this change cannot be verified. Re-run the check in a moment.');
  }

  if (res.status !== 200) {
    const reason = errorOf(res.text) ?? `HTTP ${res.status}`;
    return fail(`TraceGuard for Jira refused the check: ${reason}`);
  }
  let verdict: { success?: unknown; message?: unknown; simulated?: unknown };
  try {
    verdict = JSON.parse(res.text);
  } catch {
    return fail('TraceGuard for Jira sent an unreadable reply. Re-run the check.');
  }
  if (typeof verdict.success !== 'boolean' || typeof verdict.message !== 'string') {
    return fail('TraceGuard for Jira sent an unexpected reply. Update both TraceGuard apps.');
  }
  const note = verdict.simulated === true ? ' (Jira shows the built-in sample: load the demo project or add Requirement issues.)' : '';
  return { success: verdict.success, message: `${verdict.message}${note}`.slice(0, MAX_MESSAGE) };
}
