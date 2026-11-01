import api, { fetch, route } from '@forge/api';
import Resolver from '@forge/resolver';
import * as bitbucket from './bitbucket';
import { runMergeCheck, type MergeCheckEvent, type MergeCheckResponse } from './check';
import { sign, SIGNATURE_HEADER } from './signature';
import { connectionStatus, getConnection, saveConnection, validateConnection, type Connection } from './store';

const TIMEOUT_MS = 10_000;

async function post(url: string, body: string, headers: Record<string, string>) {
  const res = await fetch(url, { method: 'POST', body, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  return { status: res.status, text: await res.text() };
}

/** `bitbucket:mergeCheck` handler. Any thrown error is reported by Bitbucket as a failed check. */
export async function mergeCheck(event: MergeCheckEvent): Promise<MergeCheckResponse> {
  try {
    return await runMergeCheck(event, { ...bitbucket, getConnection, post });
  } catch (e) {
    console.error('TraceGuard merge check failed', e);
    const reason = e instanceof bitbucket.BitbucketError ? ` (${e.message})` : '';
    return { success: false, message: `TraceGuard could not read this pull request${reason}. Re-run the check.` };
  }
}

// --- Workspace settings page ---

type Context = { accountId?: string; workspaceId?: string; extension?: { workspace?: { uuid?: string } } };

/** Only workspace administrators may change the connection. */
async function isWorkspaceAdmin(context: Context): Promise<boolean> {
  const uuid = context.extension?.workspace?.uuid ?? context.workspaceId;
  if (!uuid) return false;
  const res = await api
    .asUser()
    .requestBitbucket(route`/2.0/user/permissions/workspaces?q=${`workspace.uuid="${uuid}"`}`, {
      headers: { Accept: 'application/json' },
    });
  if (!res.ok) return false;
  const body = (await res.json()) as { values?: { permission?: string }[] };
  return body.values?.[0]?.permission === 'owner';
}

/** Sends a signed request with no files, which TraceGuard for Jira always answers with a pass. */
async function ping(c: Connection): Promise<string> {
  const body = JSON.stringify({ repo: 'connection-test', trigger: 'connection-test', pullRequest: { id: 0, title: 'Connection test' }, files: [], issueKeys: [] });
  const res = await post(c.url, body, { 'Content-Type': 'application/json', [SIGNATURE_HEADER]: sign(c.secret, body) });
  if (res.status === 200) return 'ok';
  if (res.status === 401) return 'Jira rejected the secret. Paste the newest secret from TraceGuard setup.';
  if (res.status === 503) return 'TraceGuard for Jira has no connection yet. Create one in TraceGuard setup.';
  return `Jira answered HTTP ${res.status}.`;
}

const resolver = new Resolver();

resolver.define('getStatus', () => connectionStatus());

resolver.define('saveConnection', async ({ payload, context }) => {
  try {
    if (!(await isWorkspaceAdmin(context as Context))) return { error: 'Only workspace administrators can change the TraceGuard connection.' };
    const input = (payload ?? {}) as { url?: unknown; secret?: unknown };
    const c = validateConnection(String(input.url ?? ''), String(input.secret ?? ''));
    const result = await ping(c);
    if (result !== 'ok') return { error: result };
    await saveConnection(c);
    return { ok: true, status: await connectionStatus() };
  } catch (e) {
    console.error('TraceGuard saveConnection failed', e);
    return { error: e instanceof Error ? e.message : 'Saving failed.' };
  }
});

resolver.define('testConnection', async () => {
  const c = await getConnection();
  if (!c) return { error: 'Not connected yet.' };
  try {
    const result = await ping(c);
    return result === 'ok' ? { ok: true } : { error: result };
  } catch {
    return { error: 'Jira could not be reached.' };
  }
});

export const settingsResolver = resolver.getDefinitions();
