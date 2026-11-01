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
