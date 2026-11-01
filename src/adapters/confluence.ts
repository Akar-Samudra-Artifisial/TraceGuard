import api, { route, type Route } from '@forge/api';

export class ConfluenceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ConfluenceError';
  }
}

function messageOf(status: number, text: string): string {
  try {
    const body = JSON.parse(text) as { errors?: { title?: string; detail?: string }[]; message?: string };
    const parts = [...(body.errors ?? []).map((e) => e.detail || e.title), body.message].filter(Boolean);
    if (parts.length) return `Confluence ${status}: ${parts.join('; ')}`;
  } catch {
    // not JSON
  }
  return `Confluence ${status}: ${text.slice(0, 200) || 'no body'}`;
}

/** Calls the Confluence REST API as the app. Throws ConfluenceError for non-2xx replies. */
async function confluence<T>(method: 'GET' | 'POST', path: Route, body?: unknown): Promise<T> {
  const res = await api.asApp().requestConfluence(path, {
    method,
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new ConfluenceError(res.status, messageOf(res.status, text));
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface Space {
  id: string;
  key: string;
  name: string;
}

export interface SpaceLookup {
  space?: Space;
  /** Site base URL (https://acme.atlassian.net), read from Confluence itself. */
  siteUrl?: string;
}

/** The space with this key, or the first global space when no key is given. */
export async function findSpace(key?: string): Promise<SpaceLookup> {
  type Page = { results?: Space[]; _links?: { base?: string } };
  const page = key
    ? await confluence<Page>('GET', route`/wiki/api/v2/spaces?keys=${key}&limit=1`)
    : await confluence<Page>('GET', route`/wiki/api/v2/spaces?type=global&status=current&limit=1`);
  return { space: page.results?.[0], siteUrl: page._links?.base?.replace(/\/wiki\/?$/, '') };
}

/** Creates the space unless it exists. Returns its key. */
export async function ensureSpace(key: string, name: string, description: string): Promise<string> {
  const { space } = await findSpace(key);
  if (space) return space.key;
  const created = await confluence<{ key: string }>('POST', route`/wiki/rest/api/space`, {
    key,
    name,
    description: { plain: { value: description, representation: 'plain' } },
  });
  return created.key;
}

export interface CreatedPage {
  id: string;
  title: string;
  url: string;
  siteUrl: string;
}

const TITLE_TAKEN = /already exists|same title/i;

/**
 * Creates a page in storage format. When a page with the same title exists, retries once with
 * `fallbackTitle` (titles are unique per space).
 */
export async function createPage(spaceId: string, title: string, body: string, fallbackTitle?: string): Promise<CreatedPage> {
  const post = (t: string) =>
    confluence<{ id: string; title: string; _links?: { base?: string; webui?: string } }>('POST', route`/wiki/api/v2/pages`, {
      spaceId,
      status: 'current',
      title: t,
      body: { representation: 'storage', value: body },
    });
  let page;
  try {
    page = await post(title);
  } catch (e) {
    if (!(fallbackTitle && e instanceof ConfluenceError && e.status === 400 && TITLE_TAKEN.test(e.message))) throw e;
    page = await post(fallbackTitle);
  }
  const base = page._links?.base ?? '';
  return {
    id: page.id,
    title: page.title,
    url: `${base}${page._links?.webui ?? `/pages/${page.id}`}`,
    siteUrl: base.replace(/\/wiki\/?$/, ''),
  };
}
