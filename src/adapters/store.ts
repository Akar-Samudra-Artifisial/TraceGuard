import { kvs } from '@forge/kvs';
import type { PullRequest } from '../core/types';

/** Per-installation settings, written by the demo seed or (later) the setup page. */
export interface Settings {
  projectKey: string;
  defaultRepo: string;
  safetyCriticalPaths: string[];
  /** Space for evidence packs; the first global space when unset. */
  confluenceSpaceKey?: string;
}

const SETTINGS = 'settings';
const PULL_REQUESTS = 'pull-requests';

export const getSettings = () => kvs.get<Settings>(SETTINGS);
export const saveSettings = (value: Settings) => kvs.set(SETTINGS, value);

/** Pull request history: simulated by the demo seed, or reported by the Bitbucket app. */
export async function getPullRequests(): Promise<PullRequest[]> {
  return (await kvs.get<PullRequest[]>(PULL_REQUESTS)) ?? [];
}

export const savePullRequests = (value: PullRequest[]) => kvs.set(PULL_REQUESTS, value);

const MAX_PULL_REQUESTS = 300;

/** Adds or replaces a pull request reported by the Bitbucket app (matched on repo + id). */
export async function upsertPullRequest(pr: PullRequest): Promise<void> {
  const all = await getPullRequests();
  const rest = all.filter((p) => !(p.repo === pr.repo && p.id === pr.id));
  await savePullRequests([...rest, pr].slice(-MAX_PULL_REQUESTS));
}

const BITBUCKET_SECRET = 'bitbucket-connection-secret';

/** Shared secret for requests from the TraceGuard Bitbucket app (Forge KVS secret storage). */
export const getBitbucketSecret = () => kvs.getSecret<string>(BITBUCKET_SECRET);
export const setBitbucketSecret = (value: string) => kvs.setSecret(BITBUCKET_SECRET, value);
