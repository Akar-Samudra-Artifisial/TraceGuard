import * as core from '../core';
import type { TestCase, TraceSnapshot } from '../core/types';
import { createLink, getProject, userHasProjectPermissions } from '../adapters/jira';
import { LINK_TYPES } from '../adapters/jira-map';
import { loadTraceSource } from '../adapters/source';

export interface TestCandidate {
  key: string;
  title: string;
  /** Requirement IDs the test already verifies. */
  verifies: string[];
  inRelease: boolean;
  lastRun?: TestCase['lastRun'];
}

export class QuickFixError extends Error {}

const KEY = /^[A-Z][A-Z0-9_]+-\d+$/;

/**
 * Test cases that could verify the requirement, best first: unlinked tests in the release,
 * then other tests in the release, then the rest. Tests already verifying it are left out.
 */
export function rankTestCandidates(s: TraceSnapshot, requirementId: string, release: string): TestCandidate[] {
  const score = (t: TestCase) => (t.requirementIds.length === 0 ? 0 : 1) + (t.fixVersions.includes(release) ? 0 : 2);
  return s.testCases
    .filter((t) => !t.requirementIds.includes(requirementId))
    .sort((a, b) => score(a) - score(b) || a.key.localeCompare(b.key, undefined, { numeric: true }))
    .map((t) => ({
      key: t.key,
      title: t.title,
      verifies: t.requirementIds,
      inRelease: t.fixVersions.includes(release),
      lastRun: t.lastRun,
    }));
}

async function liveRequirement(id: string) {
  const src = await loadTraceSource();
  if (src.simulated || !src.projectKey) {
    throw new QuickFixError('Linking needs live Jira data. Load demo data in TraceGuard setup first.');
  }
  const req = core.findRequirement(src.snapshot, id);
  if (!req?.key) throw new QuickFixError(`Requirement ${id} was not found in Jira project ${src.projectKey}.`);
  return { src, req, projectKey: src.projectKey };
}

export async function getTestCandidates(requirementId: string, release?: string) {
  const { src, req } = await liveRequirement(requirementId);
  const rel = release ? core.findRelease(src.snapshot, release).name : core.defaultRelease(src.snapshot)?.name ?? '';
  return {
    summary: `Test cases that could verify ${req.id}.`,
    requirement: { id: req.id, key: req.key },
    release: rel,
    candidates: rankTestCandidates(src.snapshot, req.id, rel),
  };
}

/**
 * Creates "<test> verifies <requirement>" in Jira for the current user. The link is made by the
 * app, so the user's own Browse + Link issues permissions in the project are checked first.
 */
export async function linkTestCase(accountId: string, requirementId: string, testKey: string) {
  const key = testKey.trim().toUpperCase();
  if (!KEY.test(key)) throw new QuickFixError(`"${testKey}" is not a Jira issue key.`);
  const { src, req, projectKey } = await liveRequirement(requirementId);
  const test = src.snapshot.testCases.find((t) => t.key.toUpperCase() === key);
  if (!test) throw new QuickFixError(`${key} is not a Test Case in project ${projectKey}.`);
  if (test.requirementIds.includes(req.id)) {
    return { summary: `${test.key} already verifies ${req.id}.`, requirementId: req.id, testKey: test.key, created: false };
  }

  const project = await getProject(projectKey);
  if (!project || !(await userHasProjectPermissions(accountId, project.id, ['BROWSE_PROJECTS', 'LINK_ISSUES']))) {
    throw new QuickFixError(`You need the Link work items permission in ${projectKey} to do this.`);
  }
  await createLink(LINK_TYPES.verifies.name, test.key, req.key!);
  return { summary: `Linked ${test.key} → verifies → ${req.id}.`, requirementId: req.id, testKey: test.key, created: true };
}
