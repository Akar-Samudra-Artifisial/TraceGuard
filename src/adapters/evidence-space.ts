import { ProxyRequestError } from '@forge/api';
import { DEMO_REPO, demoConfig } from '../demo/cardiosense';
import { ConfluenceError, ensureSpace, findSpace } from './confluence';
import { getProject } from './jira';
import { DEFAULT_PROJECT_KEY } from './source';
import { getSettings, saveSettings } from './store';

export const DEMO_SPACE_NAME = 'CardioSense Monitor Quality';
const DEMO_SPACE_DESCRIPTION = 'Traceability evidence packs published by TraceGuard. Demo data.';

export const CONFLUENCE_UNAVAILABLE =
  'Confluence is not available to TraceGuard on this site. Add Confluence to the site, then open the TraceGuard install link again and install it for Confluence.';

/** Thrown when the evidence space cannot be set up for a reason the admin can fix. */
export class SpaceSetupError extends Error {}

/** Creates the Confluence space for evidence packs unless it exists. Returns its key. */
export const createDemoSpace = (key: string) => ensureSpace(key, DEMO_SPACE_NAME, DEMO_SPACE_DESCRIPTION);

export interface EvidenceSpaceStatus {
  /** False when Confluence is not installed on the site (or not for the app). */
  available: boolean;
  spaceKey: string;
  exists: boolean;
  /** Set when Confluence could not be checked for another reason (auth, permission, outage). */
  error: string | null;
}

/**
 * True when the failure means Confluence is not installed. Assumption (not observed in a log yet):
 * without Confluence on the site, `/wiki/...` answers 404, either from Confluence's router or as a
 * Forge proxy error. With Confluence installed, `GET /wiki/api/v2/spaces?keys=X` answers 200 with an
 * empty list for an unknown key, so a 404 there does not mean "space missing".
 */
function isNotInstalled(err: unknown): boolean {
  return (err instanceof ConfluenceError || err instanceof ProxyRequestError) && err.status === 404;
}

/** Where evidence packs go for this project (configured space, else the project key) and whether it exists. */
export async function evidenceSpaceStatus(projectKey: string): Promise<EvidenceSpaceStatus> {
  const spaceKey = (await getSettings())?.confluenceSpaceKey ?? projectKey;
  try {
    const { space } = await findSpace(spaceKey);
    return { available: true, spaceKey, exists: Boolean(space), error: null };
  } catch (err) {
    if (isNotInstalled(err)) return { available: false, spaceKey, exists: false, error: null };
    console.warn('TraceGuard: could not check Confluence', err);
    const status = err instanceof ConfluenceError || err instanceof ProxyRequestError ? ` (HTTP ${err.status})` : '';
    return { available: false, spaceKey, exists: false, error: `Could not check Confluence${status}. Try again later or check the app logs.` };
  }
}

export interface EvidenceSpaceResult {
  summary: string;
  spaceKey: string;
  created: boolean;
}

/**
 * Creates the evidence-pack space for an existing project, e.g. when Confluence was added to the
 * site after the demo was loaded. A no-op when the space already exists. Saves it in the settings.
 */
export async function ensureEvidenceSpace(): Promise<EvidenceSpaceResult> {
  const settings = await getSettings();
  const projectKey = settings?.projectKey ?? DEFAULT_PROJECT_KEY;
  if (!(await getProject(projectKey))) {
    throw new SpaceSetupError(`Jira project ${projectKey} does not exist yet. Use Load demo data instead.`);
  }
  const status = await evidenceSpaceStatus(projectKey);
  if (status.error) throw new SpaceSetupError(status.error);
  if (!status.available) throw new SpaceSetupError(CONFLUENCE_UNAVAILABLE);
  const spaceKey = status.exists ? status.spaceKey : await createDemoSpace(status.spaceKey);
  // Keep every other setting; only fill the required ones when no settings were saved yet.
  await saveSettings({
    projectKey,
    defaultRepo: DEMO_REPO,
    safetyCriticalPaths: demoConfig.safetyCriticalPaths,
    ...settings,
    confluenceSpaceKey: spaceKey,
  });
  return {
    summary: status.exists
      ? `Confluence space ${spaceKey} already exists. Nothing to create.`
      : `Created Confluence space ${spaceKey} for evidence packs.`,
    spaceKey,
    created: !status.exists,
  };
}
