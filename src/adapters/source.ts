import type { TraceConfig, TraceSnapshot } from '../core/types';
import { DEMO_REPO, demoConfig, demoSnapshot } from '../demo/cardiosense';
import { getProject, getVersions, searchProjectIssues } from './jira';
import { snapshotFromJira } from './jira-map';
import { getPullRequests, getSettings } from './store';

export const DEFAULT_PROJECT_KEY = 'CSM';

export interface TraceSource {
  snapshot: TraceSnapshot;
  config: TraceConfig;
  defaultRepo: string;
  /** True while data comes from the built-in CardioSense fixture instead of Jira. */
  simulated: boolean;
  /** Jira project the data was read from, when live. */
  projectKey?: string;
  /** Numeric Jira project ID, when live (used for permission checks). */
  projectId?: string;
  /** Why the fixture is shown instead of Jira data. */
  fallbackReason?: string;
}

function fixture(projectKey: string, reason: string): TraceSource {
  return {
    snapshot: demoSnapshot,
    config: demoConfig,
    defaultRepo: DEMO_REPO,
    simulated: true,
    projectKey,
    fallbackReason: reason,
  };
}

/**
 * Reads the configured Jira project live. Falls back to the CardioSense fixture while the
 * project does not exist or has no Requirement issues yet, so a fresh install is never empty.
 */
export async function loadTraceSource(): Promise<TraceSource> {
  const settings = await getSettings();
  const projectKey = settings?.projectKey ?? DEFAULT_PROJECT_KEY;

  const project = await getProject(projectKey);
  if (!project) return fixture(projectKey, `Jira project ${projectKey} does not exist yet.`);

  const [issues, versions, pullRequests] = await Promise.all([
    searchProjectIssues(projectKey),
    getVersions(projectKey),
    getPullRequests(),
  ]);
  const snapshot = { ...snapshotFromJira(issues, versions), pullRequests };
  if (snapshot.requirements.length === 0) {
    return fixture(projectKey, `Jira project ${projectKey} has no Requirement issues yet.`);
  }
  if (snapshot.releases.length === 0) {
    return fixture(projectKey, `Jira project ${projectKey} has no fix versions yet.`);
  }

  return {
    snapshot,
    config: { safetyCriticalPaths: settings?.safetyCriticalPaths ?? demoConfig.safetyCriticalPaths },
    defaultRepo: settings?.defaultRepo ?? DEMO_REPO,
    simulated: false,
    projectKey,
    projectId: project.id,
  };
}
