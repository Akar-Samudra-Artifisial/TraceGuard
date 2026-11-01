import api, { route, type Route } from '@forge/api';
import { PROPERTY_KEY, type JiraIssue, type JiraVersion } from './jira-map';

export class JiraError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'JiraError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

function messageOf(status: number, text: string): string {
  try {
    const body = JSON.parse(text) as { errorMessages?: string[]; errors?: Record<string, string>; message?: string };
    const parts = [...(body.errorMessages ?? []), ...Object.values(body.errors ?? {}), body.message].filter(Boolean);
    if (parts.length) return `Jira ${status}: ${parts.join('; ')}`;
  } catch {
    // not JSON
  }
  return `Jira ${status}: ${text.slice(0, 200) || 'no body'}`;
}

/** Calls the Jira REST API as the app. Throws JiraError for non-2xx replies. */
export async function jira<T = unknown>(method: Method, path: Route, body?: unknown): Promise<T> {
  const res = await api.asApp().requestJira(path, {
    method,
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new JiraError(res.status, messageOf(res.status, text));
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

/** Undefined when the project does not exist (or the app cannot see it). */
export async function getProject(key: string): Promise<JiraProject | undefined> {
  try {
    return await jira<JiraProject>('GET', route`/rest/api/3/project/${key}`);
  } catch (e) {
    if (e instanceof JiraError && e.status === 404) return undefined;
    throw e;
  }
}

export const getVersions = (projectKey: string) =>
  jira<JiraVersion[]>('GET', route`/rest/api/3/project/${projectKey}/versions`);

const FIELDS = ['summary', 'issuetype', 'fixVersions', 'assignee', 'issuelinks'];
const PAGE = 100;
const MAX_ISSUES = 1000;

/** All issues of a project with links, fix versions, the TraceGuard property and text-edit history. */
export async function searchProjectIssues(projectKey: string): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  do {
    const page = await jira<{ issues?: JiraIssue[]; nextPageToken?: string }>('POST', route`/rest/api/3/search/jql`, {
      jql: `project = "${projectKey.replace(/"/g, '')}" ORDER BY key ASC`,
      fields: FIELDS,
      properties: [PROPERTY_KEY],
      expand: 'changelog',
      maxResults: PAGE,
      ...(nextPageToken ? { nextPageToken } : {}),
    });
    issues.push(...(page.issues ?? []));
    nextPageToken = page.nextPageToken;
  } while (nextPageToken && issues.length < MAX_ISSUES);
  return issues;
}

/** Creates "from <outward verb> to", e.g. CSM-26 verifies CSM-6 (Jira's inward/outward fields read the other way). */
export async function createLink(type: string, from: string, to: string): Promise<void> {
  await jira('POST', route`/rest/api/3/issueLink`, { type: { name: type }, inwardIssue: { key: from }, outwardIssue: { key: to } });
}

/** True when the user holds every listed project permission in the project. */
export async function userHasProjectPermissions(accountId: string, projectId: string, permissions: string[]): Promise<boolean> {
  const res = await jira<{ projectPermissions?: { permission: string; projects?: number[] }[] }>(
    'POST',
    route`/rest/api/3/permissions/check`,
    { accountId, projectPermissions: [{ permissions, projects: [Number(projectId)] }] },
  );
  const granted = new Set(
    (res.projectPermissions ?? []).filter((p) => (p.projects ?? []).includes(Number(projectId))).map((p) => p.permission),
  );
  return permissions.every((p) => granted.has(p));
}
