import api, { assumeTrustedRoute, route, type Route } from '@forge/api';

export class BitbucketError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'BitbucketError';
  }
}

const API_ROOT = 'https://api.bitbucket.org';
const MAX_PAGES = 10;

async function get(path: Route, accept = 'application/json') {
  const res = await api.asApp().requestBitbucket(path, { headers: { Accept: accept } });
  if (!res.ok) throw new BitbucketError(res.status, `Bitbucket ${res.status} for ${path.value.split('?')[0]}`);
  return res;
}

/** Follows Bitbucket `next` links; only links back to the Bitbucket API are trusted. */
async function paged<T>(first: Route): Promise<T[]> {
  const out: T[] = [];
  let path: Route | undefined = first;
  for (let i = 0; path && i < MAX_PAGES; i++) {
    const page = (await (await get(path)).json()) as { values?: T[]; next?: string };
    out.push(...(page.values ?? []));
    path = page.next?.startsWith(`${API_ROOT}/2.0/`) ? assumeTrustedRoute(page.next.slice(API_ROOT.length)) : undefined;
  }
  return out;
}

export interface PullRequestInfo {
  id: number;
  title: string;
  description: string;
  sourceBranch: string;
  destinationCommit: string;
  author?: string;
}

export interface PrRef {
  workspace: string;
  repository: string;
  id: number;
}

export async function getRepoSlug(ref: PrRef): Promise<string> {
  const repo = (await (await get(route`/2.0/repositories/${ref.workspace}/${ref.repository}`)).json()) as { slug: string };
  return repo.slug;
}

export async function getPullRequest(ref: PrRef): Promise<PullRequestInfo> {
  const pr = (await (await get(route`/2.0/repositories/${ref.workspace}/${ref.repository}/pullrequests/${ref.id}`)).json()) as {
    id: number;
    title?: string;
    description?: string;
    source?: { branch?: { name?: string } };
    destination?: { commit?: { hash?: string }; branch?: { name?: string } };
    author?: { display_name?: string };
  };
  return {
    id: pr.id,
    title: pr.title ?? '',
    description: pr.description ?? '',
    sourceBranch: pr.source?.branch?.name ?? '',
    destinationCommit: pr.destination?.commit?.hash ?? pr.destination?.branch?.name ?? '',
    author: pr.author?.display_name,
  };
}

/** Old and new paths of every file the pull request changes. */
export async function getChangedFiles(ref: PrRef): Promise<string[]> {
  const stats = await paged<{ old?: { path?: string } | null; new?: { path?: string } | null }>(
    route`/2.0/repositories/${ref.workspace}/${ref.repository}/pullrequests/${ref.id}/diffstat?pagelen=500`,
  );
  return [...new Set(stats.flatMap((s) => [s.new?.path, s.old?.path]).filter((p): p is string => Boolean(p)))];
}

export async function getCommitMessages(ref: PrRef): Promise<string[]> {
  const commits = await paged<{ message?: string }>(
    route`/2.0/repositories/${ref.workspace}/${ref.repository}/pullrequests/${ref.id}/commits?pagelen=100`,
  );
  return commits.map((c) => c.message ?? '');
}

/** Raw file content at a commit, or undefined when the file does not exist. */
export async function getFile(ref: PrRef, commit: string, path: string): Promise<string | undefined> {
  try {
    const res = await get(route`/2.0/repositories/${ref.workspace}/${ref.repository}/src/${commit}/${path}`, 'text/plain');
    return await res.text();
  } catch (e) {
    if (e instanceof BitbucketError && e.status === 404) return undefined;
    throw e;
  }
}
