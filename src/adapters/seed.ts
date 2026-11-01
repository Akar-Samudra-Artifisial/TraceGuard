import { route } from '@forge/api';
import type { PullRequest } from '../core/types';
import { DEMO_REPO, demoConfig, demoSnapshot } from '../demo/cardiosense';
import { ensureSpace } from './confluence';
import { createLink as link, getProject, jira, searchProjectIssues, type JiraProject } from './jira';
import { ISSUE_TYPES, LINK_TYPES, PROPERTY_KEY } from './jira-map';
import { DEFAULT_PROJECT_KEY } from './source';
import { saveSettings, savePullRequests } from './store';

const PROJECT_NAME = 'CardioSense Monitor';
const KANBAN_TEMPLATE = 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic';

const ISSUE_TYPE_DESCRIPTIONS: Record<string, string> = {
  [ISSUE_TYPES.requirement]: 'Software requirement traced by TraceGuard (IEC 62304).',
  [ISSUE_TYPES.hazard]: 'Hazard from the risk analysis (ISO 14971).',
  [ISSUE_TYPES.test]: 'Verification test case traced by TraceGuard.',
};

/** Test that exists in the project but is not linked yet, so the demo can close G2 on REQ-109 with one click. */
export const UNLINKED_TEST = {
  title: 'Battery warning shown at 15%',
  requirementId: 'REQ-109',
  lastRun: { result: 'passed' as const, at: '2026-10-12T10:00:00Z', build: '2.3.0-rc1' },
};

/** REQ-118 is approved on this date; the seed then edits its text, which produces G6. */
const REQ_118_APPROVED_AT = '2026-09-01T09:00:00Z';

export interface SeedResult {
  projectKey: string;
  created: { requirements: number; hazards: number; workItems: number; testCases: number; links: number };
  keyMap: Record<string, string>;
  /** Confluence space for evidence packs, or null when Confluence is not available. */
  confluenceSpace: string | null;
}

const doc = (text: string) => ({
  type: 'doc',
  version: 1,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

interface IssueType {
  id: string;
  name: string;
  scope?: unknown;
}

async function ensureIssueTypes(): Promise<Record<string, string>> {
  const all = await jira<IssueType[]>('GET', route`/rest/api/3/issuetype`);
  const ids: Record<string, string> = {};
  for (const name of Object.values(ISSUE_TYPES)) {
    const existing = all.find((t) => !t.scope && t.name.toLowerCase() === name.toLowerCase());
    ids[name] =
      existing?.id ??
      (await jira<IssueType>('POST', route`/rest/api/3/issuetype`, {
        name,
        description: ISSUE_TYPE_DESCRIPTIONS[name],
        hierarchyLevel: 0,
      })).id;
  }
  return ids;
}

async function ensureLinkTypes(): Promise<void> {
  const { issueLinkTypes = [] } = await jira<{ issueLinkTypes?: { name: string }[] }>(
    'GET',
    route`/rest/api/3/issueLinkType`,
  );
  for (const type of Object.values(LINK_TYPES)) {
    if (issueLinkTypes.some((t) => t.name.toLowerCase() === type.name.toLowerCase())) continue;
    await jira('POST', route`/rest/api/3/issueLinkType`, type);
  }
}

async function ensureProject(leadAccountId: string): Promise<JiraProject> {
  const existing = await getProject(DEFAULT_PROJECT_KEY);
  if (existing) return existing;
  const created = await jira<{ id: number | string; key: string }>('POST', route`/rest/api/3/project`, {
    key: DEFAULT_PROJECT_KEY,
    name: PROJECT_NAME,
    description: 'Fictional class C ECG monitor with dose advisory. Demo data created by TraceGuard.',
    projectTypeKey: 'software',
    projectTemplateKey: KANBAN_TEMPLATE,
    leadAccountId,
    assigneeType: 'UNASSIGNED',
  });
  return { id: String(created.id), key: created.key, name: PROJECT_NAME };
}

/** Adds the TraceGuard issue types to the project's issue type scheme (the default scheme already has all types). */
async function addTypesToProject(projectId: string, typeIds: string[]): Promise<void> {
  const { values = [] } = await jira<{ values?: { issueTypeScheme: { id: string; isDefault?: boolean } }[] }>(
    'GET',
    route`/rest/api/3/issuetypescheme/project?projectId=${projectId}`,
  );
  const scheme = values[0]?.issueTypeScheme;
  if (!scheme || scheme.isDefault) return;
  const mapping = await jira<{ values?: { issueTypeId: string }[] }>(
    'GET',
    route`/rest/api/3/issuetypescheme/mapping?issueTypeSchemeId=${scheme.id}&maxResults=100`,
  );
  const present = new Set((mapping.values ?? []).map((m) => m.issueTypeId));
  const missing = typeIds.filter((id) => !present.has(id));
  if (missing.length) {
    await jira('PUT', route`/rest/api/3/issuetypescheme/${scheme.id}/issuetype`, { issueTypeIds: missing });
  }
}

async function workItemTypeId(projectKey: string): Promise<string> {
  const meta = await jira<{ issueTypes?: IssueType[]; values?: IssueType[] }>(
    'GET',
    route`/rest/api/3/issue/createmeta/${projectKey}/issuetypes`,
  );
  const types = meta.issueTypes ?? meta.values ?? [];
  const pick = types.find((t) => t.name === 'Story') ?? types.find((t) => t.name === 'Task');
  if (!pick) throw new Error(`Project ${projectKey} has neither a Story nor a Task issue type.`);
  return pick.id;
}

async function ensureVersions(projectId: string): Promise<void> {
  const existing = await jira<{ name: string }[]>('GET', route`/rest/api/3/project/${projectId}/versions`);
  for (const r of demoSnapshot.releases) {
    if (existing.some((v) => v.name === r.name)) continue;
    await jira('POST', route`/rest/api/3/version`, {
      name: r.name,
      projectId: Number(projectId),
      releaseDate: r.releaseDate,
      released: r.signedOff,
    });
  }
}

interface NewIssue {
  ref: string;
  typeId: string;
  summary: string;
  description: string;
  fixVersions?: string[];
  assignee?: string;
  property: Record<string, unknown>;
}

async function createIssues(projectId: string, issues: NewIssue[]): Promise<Record<string, string>> {
  const keys: Record<string, string> = {};
  for (let i = 0; i < issues.length; i += 50) {
    const batch = issues.slice(i, i + 50);
    const res = await jira<{ issues?: { key: string }[]; errors?: { failedElementNumber: number; elementErrors?: unknown }[] }>(
      'POST',
      route`/rest/api/3/issue/bulk`,
      {
        issueUpdates: batch.map((n) => ({
          fields: {
            project: { id: projectId },
            issuetype: { id: n.typeId },
            summary: n.summary,
            description: doc(n.description),
            ...(n.fixVersions ? { fixVersions: n.fixVersions.map((name) => ({ name })) } : {}),
            ...(n.assignee ? { assignee: { accountId: n.assignee } } : {}),
          },
          properties: [{ key: PROPERTY_KEY, value: n.property }],
        })),
      },
    );
    if (res.errors?.length) {
      throw new Error(`Jira rejected ${res.errors.length} demo issue(s): ${JSON.stringify(res.errors[0]).slice(0, 300)}`);
    }
    (res.issues ?? []).forEach((issue, j) => (keys[batch[j]!.ref] = issue.key));
  }
  return keys;
}


/** Runs promises a few at a time so Jira does not rate-limit the seed. */
async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

/**
 * Creates the CardioSense demo in Jira: project CSM, issue types, link types, versions 2.2 and 2.3,
 * and the same requirements, hazards, stories and tests as the built-in fixture, with exactly one
 * example of each gap G1–G6 in release 2.3. Pull requests are stored as simulated history.
 */
export async function seedDemoProject(accountId: string): Promise<SeedResult> {
  const typeIds = await ensureIssueTypes();
  await ensureLinkTypes();
  const project = await ensureProject(accountId);

  const existing = await searchProjectIssues(project.key);
  if (existing.some((i) => i.fields.issuetype?.name === ISSUE_TYPES.requirement)) {
    throw new Error(`Project ${project.key} already contains requirements. Delete it first to reload the demo.`);
  }

  await addTypesToProject(project.id, Object.values(typeIds));
  await ensureVersions(project.id);
  const storyType = await workItemTypeId(project.key);
  const s = demoSnapshot;

  const issues: NewIssue[] = [
    ...s.hazards.map((h) => ({
      ref: h.id,
      typeId: typeIds[ISSUE_TYPES.hazard]!,
      summary: `${h.id} ${h.title}`,
      description: `Hazard from the CardioSense risk analysis. Severity: ${h.severity}.`,
      property: { hazardId: h.id, severity: h.severity },
    })),
    ...s.requirements.map((r) => ({
      ref: r.id,
      typeId: typeIds[ISSUE_TYPES.requirement]!,
      summary: `${r.id} ${r.title}`,
      description: `${r.title}. IEC 62304 software safety class ${r.safetyClass}. Implemented in ${r.paths.join(', ')}.`,
      property: {
        reqId: r.id,
        safetyClass: r.safetyClass,
        status: r.status,
        approvedAt: r.id === 'REQ-118' ? REQ_118_APPROVED_AT : r.approvedAt,
        paths: r.paths,
      },
    })),
    ...s.workItems.map((w) => ({
      ref: w.key,
      typeId: storyType,
      summary: w.title,
      description: `Implements ${w.requirementIds.join(', ')}.`,
      fixVersions: w.fixVersions,
      assignee: accountId,
      property: {},
    })),
    ...s.testCases.map((t) => ({
      ref: t.key,
      typeId: typeIds[ISSUE_TYPES.test]!,
      summary: t.title,
      description: `Verifies ${t.requirementIds.join(', ')}.`,
      fixVersions: t.fixVersions,
      assignee: accountId,
      property: t.lastRun ? { lastRun: t.lastRun } : {},
    })),
    {
      ref: 'UNLINKED-TEST',
      typeId: typeIds[ISSUE_TYPES.test]!,
      summary: UNLINKED_TEST.title,
      description: `Bench test for ${UNLINKED_TEST.requirementId}. Not linked yet.`,
      fixVersions: ['2.3'],
      assignee: accountId,
      property: { lastRun: UNLINKED_TEST.lastRun },
    },
  ];
  const keyMap = await createIssues(project.id, issues);
  const key = (ref: string) => keyMap[ref]!;

  const links: [string, string, string][] = [
    ...s.requirements.flatMap((r) => r.hazardIds.map((h) => [LINK_TYPES.mitigates.name, key(r.id), key(h)] as [string, string, string])),
    ...s.workItems.flatMap((w) => w.requirementIds.map((r) => [LINK_TYPES.implements.name, key(w.key), key(r)] as [string, string, string])),
    ...s.testCases.flatMap((t) => t.requirementIds.map((r) => [LINK_TYPES.verifies.name, key(t.key), key(r)] as [string, string, string])),
  ];
  await inBatches(links, 5, ([type, from, to]) => link(type, from, to));

  // G6: REQ-118 text changes after its approval date without a change request.
  await jira('PUT', route`/rest/api/3/issue/${key('REQ-118')}`, {
    fields: { description: doc('Encrypt patient data at rest with AES-256. Key rotation every 90 days (edited after approval).') },
  });

  const pullRequests: PullRequest[] = s.pullRequests.map((pr) => ({
    ...pr,
    issueKeys: pr.issueKeys.map((k) => keyMap[k] ?? k),
    title: pr.issueKeys.reduce((t, k) => t.replace(k, keyMap[k] ?? k), pr.title),
    simulated: true,
  }));
  await savePullRequests(pullRequests);
  // Best effort: Confluence is optional for TraceGuard, so the Jira demo still works without it.
  let confluenceSpace: string | null = null;
  try {
    confluenceSpace = await ensureSpace(
      project.key,
      `${PROJECT_NAME} Quality`,
      'Traceability evidence packs published by TraceGuard. Demo data.',
    );
  } catch (err) {
    console.warn('TraceGuard demo: Confluence space not created', err);
  }
  await saveSettings({
    projectKey: project.key,
    defaultRepo: DEMO_REPO,
    safetyCriticalPaths: demoConfig.safetyCriticalPaths,
    ...(confluenceSpace ? { confluenceSpaceKey: confluenceSpace } : {}),
  });

  return {
    projectKey: project.key,
    created: {
      requirements: s.requirements.length,
      hazards: s.hazards.length,
      workItems: s.workItems.length,
      testCases: s.testCases.length + 1,
      links: links.length,
    },
    keyMap,
    confluenceSpace,
  };
}
