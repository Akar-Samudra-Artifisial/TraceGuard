import { route } from '@forge/api';
import * as core from '../core';
import { getProject, jira, JiraError, userHasProjectPermissions } from '../adapters/jira';
import { getGapTask, setGapTask } from '../adapters/store';
import type { TraceSource } from '../adapters/source';

export class AssignError extends Error {}

const KEY = /^[A-Z][A-Z0-9_]+-\d+$/;
export const GAP_LABEL = 'traceguard-gap';

interface JiraUser {
  accountId: string;
  displayName?: string;
  emailAddress?: string;
}

export interface OpenGap {
  gap: core.Gap;
  release: string;
}

/** Open gaps across all releases that are not signed off, each with the release it was found in. */
export function openGaps(src: TraceSource): OpenGap[] {
  return src.snapshot.releases
    .filter((r) => !r.signedOff)
    .flatMap((r) => core.detectGaps(src.snapshot, src.config, r.name).map((gap) => ({ gap, release: r.name })));
}

export function findOpenGap(src: TraceSource, gapId: string): OpenGap | undefined {
  return openGaps(src).find((g) => g.gap.id.toLowerCase() === gapId.toLowerCase());
}

/** Jira issue the gap is about: the requirement issue, or the artifact itself when it is a Jira key. */
export function gapIssueKey(s: core.TraceSnapshot, gap: core.Gap): string | undefined {
  const req = gap.requirementId ? core.findRequirement(s, gap.requirementId) : undefined;
  if (req?.key) return req.key;
  // Pull request IDs (PR-63) look like issue keys, so only accept keys of known Jira issues.
  const a = gap.artifactKey;
  if (!a || !KEY.test(a)) return undefined;
  return [...s.testCases, ...s.workItems].some((i) => i.key === a) ? a : undefined;
}

export function taskSummary(gap: core.Gap): string {
  return `Close ${gap.code} gap: ${gap.requirementId ?? gap.artifactKey ?? gap.id}`.slice(0, 250);
}

/** Picks the assignable user whose display name or email matches; a single fuzzy hit also counts. */
export function pickUser(users: JiraUser[], name: string): JiraUser | undefined {
  const n = name.trim().toLowerCase();
  const exact = users.find((u) => u.displayName?.toLowerCase() === n || u.emailAddress?.toLowerCase() === n);
  return exact ?? (users.length === 1 ? users[0] : undefined);
}

async function resolveAssignee(projectKey: string, name: string): Promise<JiraUser | undefined> {
  const users = await jira<JiraUser[]>(
    'GET',
    route`/rest/api/3/user/assignable/search?project=${projectKey}&query=${name}&maxResults=10`,
  );
  return pickUser(users.filter((u) => u.accountId), name);
}

async function taskTypeId(projectKey: string): Promise<string> {
  const meta = await jira<{ issueTypes?: { id: string; name: string }[]; values?: { id: string; name: string }[] }>(
    'GET',
    route`/rest/api/3/issue/createmeta/${projectKey}/issuetypes`,
  );
  const types = meta.issueTypes ?? meta.values ?? [];
  const pick = types.find((t) => t.name === 'Task') ?? types.find((t) => t.name === 'Story');
  if (!pick) throw new AssignError(`Project ${projectKey} has neither a Task nor a Story issue type.`);
  return pick.id;
}

/** The task created earlier for this gap, if it still exists and is not done. */
async function existingTask(gapId: string): Promise<{ key: string; url: string } | undefined> {
  const saved = await getGapTask(gapId);
  if (!saved) return undefined;
  try {
    const issue = await jira<{ key: string; fields?: { status?: { statusCategory?: { key?: string } } } }>(
      'GET',
      route`/rest/api/3/issue/${saved.key}?fields=status`,
    );
    return issue.fields?.status?.statusCategory?.key === 'done' ? undefined : { key: issue.key, url: saved.url };
  } catch (e) {
    if (e instanceof JiraError && e.status === 404) return undefined;
    throw e;
  }
}

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

/**
 * Creates a Jira task that closes one gap, assigns it (to the requested person or the gap owner)
 * and relates it to the requirement. Runs as the app, so the caller's own Create/Assign/Link
 * permissions in the project are checked first. Calling it again for the same open gap returns
 * the existing task instead of creating a duplicate.
 */
export async function createGapTask(src: TraceSource, accountId: string | undefined, gapId: string, assigneeName?: string) {
  if (src.simulated || !src.projectKey) {
    throw new AssignError('Assigning gaps needs live Jira data. Load demo data in TraceGuard setup first.');
  }
  const found = findOpenGap(src, gapId);
  if (!found) throw new AssignError(`No open gap with ID "${gapId}". Call list_gaps to see current gap IDs.`);
  const { gap, release } = found;

  const existing = await existingTask(gap.id);
  if (existing) {
    return {
      summary: `Gap ${gap.id} already has an open task: ${existing.key}. ${existing.url}`,
      gap,
      issueKey: existing.key,
      issueUrl: existing.url,
      created: false,
    };
  }

  if (!accountId) throw new AssignError('TraceGuard could not identify you, so it cannot check your Jira permissions.');
  const project = await getProject(src.projectKey);
  if (!project) throw new AssignError(`Jira project ${src.projectKey} was not found.`);
  const wanted = assigneeName ?? gap.owner;
  const needed = ['BROWSE_PROJECTS', 'CREATE_ISSUES', 'LINK_ISSUES', ...(wanted ? ['ASSIGN_ISSUES'] : [])];
  if (!(await userHasProjectPermissions(accountId, project.id, needed))) {
    throw new AssignError(`You need the Create, Assign and Link work items permissions in ${src.projectKey} to do this.`);
  }

  const user = wanted ? await resolveAssignee(src.projectKey, wanted) : undefined;
  const target = gapIssueKey(src.snapshot, gap);
  const versionExists = src.snapshot.releases.some((r) => r.name === release);

  const created = await jira<{ key: string; self: string }>('POST', route`/rest/api/3/issue`, {
    fields: {
      project: { id: project.id },
      issuetype: { id: await taskTypeId(src.projectKey) },
      summary: taskSummary(gap),
      labels: [GAP_LABEL],
      ...(versionExists ? { fixVersions: [{ name: release }] } : {}),
      ...(user ? { assignee: { accountId: user.accountId } } : {}),
      description: {
        type: 'doc',
        version: 1,
        content: [
          paragraph(gap.message),
          paragraph(`Severity: ${gap.severity}. Release: ${release}. Gap ID: ${gap.id}.`),
          paragraph('Created by TraceGuard. The gap closes when the trace chain is complete; TraceGuard re-checks it on every change.'),
        ],
      },
    },
  });

  let linked = false;
  if (target) {
    try {
      await jira('POST', route`/rest/api/3/issueLink`, {
        type: { name: 'Relates' },
        inwardIssue: { key: created.key },
        outwardIssue: { key: target },
      });
      linked = true;
    } catch (e) {
      console.warn('TraceGuard assign_gap: could not link task', { key: created.key, target, e });
    }
  }

  const { baseUrl } = await jira<{ baseUrl: string }>('GET', route`/rest/api/3/serverInfo`);
  const url = `${baseUrl}/browse/${created.key}`;
  await setGapTask(gap.id, { key: created.key, url });

  const who = user ? `assigned to ${user.displayName ?? wanted}` : wanted ? `unassigned (no assignable Jira user matches "${wanted}")` : 'unassigned';
  return {
    summary: `Created ${created.key} "${taskSummary(gap)}", ${who}${linked ? `, related to ${target}` : ''}. ${url}`,
    gap,
    issueKey: created.key,
    issueUrl: url,
    assignee: user?.displayName ?? null,
    relatedTo: linked ? target : null,
    created: true,
  };
}
