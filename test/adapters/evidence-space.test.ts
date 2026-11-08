import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../src/adapters/store';

const state = vi.hoisted(() => ({
  project: true,
  confluence: 'up' as 'up' | 'down' | 'forbidden',
  spaces: new Set<string>(),
  created: [] as { key: string; name: string }[],
  settings: undefined as Settings | undefined,
}));

vi.mock('../../src/adapters/jira', () => ({
  getProject: async (key: string) => (state.project ? { id: '10000', key, name: 'CardioSense' } : undefined),
}));
vi.mock('../../src/adapters/store', () => ({
  getSettings: async () => state.settings,
  saveSettings: async (s: Settings) => void (state.settings = s),
}));
vi.mock('../../src/adapters/confluence', async (original) => ({
  ConfluenceError: (await original<typeof import('../../src/adapters/confluence')>()).ConfluenceError,
  findSpace: async (key: string) => {
    const { ConfluenceError } = await import('../../src/adapters/confluence');
    if (state.confluence === 'down') throw new ConfluenceError(404, 'Confluence 404: no body');
    if (state.confluence === 'forbidden') throw new ConfluenceError(403, 'Confluence 403: Forbidden');
    return state.spaces.has(key) ? { space: { id: '1', key, name: key } } : {};
  },
  ensureSpace: async (key: string, name: string) => {
    if (!state.spaces.has(key)) {
      state.spaces.add(key);
      state.created.push({ key, name });
    }
    return key;
  },
}));

const { ensureEvidenceSpace, evidenceSpaceStatus, CONFLUENCE_UNAVAILABLE, SpaceSetupError } = await import(
  '../../src/adapters/evidence-space'
);

beforeEach(() => {
  state.project = true;
  state.confluence = 'up';
  state.spaces.clear();
  state.created = [];
  state.settings = { projectKey: 'CSM', defaultRepo: 'cardiosense-firmware', safetyCriticalPaths: ['src/dosing/**'] };
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('evidence space', () => {
  it('reports a missing space, an existing one, and Confluence not installed (404)', async () => {
    expect(await evidenceSpaceStatus('CSM')).toEqual({ available: true, spaceKey: 'CSM', exists: false, error: null });
    state.spaces.add('CSM');
    expect(await evidenceSpaceStatus('CSM')).toEqual({ available: true, spaceKey: 'CSM', exists: true, error: null });
    state.confluence = 'down';
    expect(await evidenceSpaceStatus('CSM')).toEqual({ available: false, spaceKey: 'CSM', exists: false, error: null });
  });

  it('reports other Confluence failures as an error, not as "not installed"', async () => {
    state.confluence = 'forbidden';
    const s = await evidenceSpaceStatus('CSM');
    expect(s).toMatchObject({ available: false, exists: false, error: 'Could not check Confluence (HTTP 403). Try again later or check the app logs.' });
    await expect(ensureEvidenceSpace()).rejects.toThrow('Could not check Confluence (HTTP 403).');
    expect(state.created).toEqual([]);
  });

  it('keeps the other settings when saving the space', async () => {
    state.settings = { projectKey: 'CSM', defaultRepo: 'firmware', safetyCriticalPaths: ['src/a/**'], extra: 'kept' } as Settings;
    await ensureEvidenceSpace();
    expect(state.settings).toEqual({
      projectKey: 'CSM',
      defaultRepo: 'firmware',
      safetyCriticalPaths: ['src/a/**'],
      extra: 'kept',
      confluenceSpaceKey: 'CSM',
    });
  });

  it('fills defaults when no settings were saved yet', async () => {
    state.settings = undefined;
    await ensureEvidenceSpace();
    const saved = state.settings as Settings | undefined;
    expect(saved).toMatchObject({ projectKey: 'CSM', confluenceSpaceKey: 'CSM' });
    expect(saved?.safetyCriticalPaths.length).toBeGreaterThan(0);
  });

  it('prefers the configured space key', async () => {
    state.settings = { ...state.settings!, confluenceSpaceKey: 'QA' };
    expect(await evidenceSpaceStatus('CSM')).toMatchObject({ spaceKey: 'QA' });
  });

  it('creates the space for an existing project and saves it in the settings', async () => {
    const r = await ensureEvidenceSpace();
    expect(r).toEqual({ summary: 'Created Confluence space CSM for evidence packs.', spaceKey: 'CSM', created: true });
    expect(state.created).toEqual([{ key: 'CSM', name: 'CardioSense Monitor Quality' }]);
    expect(state.settings).toEqual({
      projectKey: 'CSM',
      defaultRepo: 'cardiosense-firmware',
      safetyCriticalPaths: ['src/dosing/**'],
      confluenceSpaceKey: 'CSM',
    });
  });

  it('is a no-op when the space already exists', async () => {
    state.spaces.add('CSM');
    const r = await ensureEvidenceSpace();
    expect(r).toEqual({ summary: 'Confluence space CSM already exists. Nothing to create.', spaceKey: 'CSM', created: false });
    expect(state.created).toEqual([]);
  });

  it('explains when Confluence is not available', async () => {
    state.confluence = 'down';
    await expect(ensureEvidenceSpace()).rejects.toThrow(CONFLUENCE_UNAVAILABLE);
    await expect(ensureEvidenceSpace()).rejects.toBeInstanceOf(SpaceSetupError);
    expect(state.created).toEqual([]);
  });

  it('refuses when the Jira project does not exist yet', async () => {
    state.project = false;
    await expect(ensureEvidenceSpace()).rejects.toThrow('Jira project CSM does not exist yet. Use Load demo data instead.');
  });
});
