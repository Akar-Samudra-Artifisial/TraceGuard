import { describe, expect, it } from 'vitest';
import { ConfigError, parseRepoConfig } from '../src/config';
import { extractIssueKeys } from '../src/keys';
import { validateConnection } from '../src/store';

describe('extractIssueKeys', () => {
  it('finds keys in titles, lower-case branch names and commits, once each', () => {
    expect(extractIssueKeys(['CSM-16 raise dose limit', 'feature/csm-16-dose-table', 'Fix CSM-23 and ABC_X-9', undefined])).toEqual([
      'CSM-16',
      'CSM-23',
      'ABC_X-9',
    ]);
  });

  it('ignores look-alikes', () => {
    expect(extractIssueKeys(['UTF-8 is not ISO8859-1? x-CSM-1y', 'CSM-0'])).toEqual(['UTF-8', 'ISO8859-1']);
  });
});

describe('parseRepoConfig', () => {
  it('reads repo and safety-critical globs', () => {
    expect(parseRepoConfig('repo: cardiosense-firmware\nsafety-critical:\n  - src/dosing/**\n  - " src/alarms/** "\n')).toEqual({
      repo: 'cardiosense-firmware',
      safetyCriticalPaths: ['src/dosing/**', 'src/alarms/**'],
    });
  });

  it('treats a missing or empty file as defaults', () => {
    expect(parseRepoConfig(undefined)).toEqual({});
    expect(parseRepoConfig('# nothing\n')).toEqual({});
  });

  it('rejects invalid content with a readable message', () => {
    expect(() => parseRepoConfig('safety-critical: src/dosing/**')).toThrow(ConfigError);
    expect(() => parseRepoConfig('repo: ../x')).toThrow('repository slug');
    expect(() => parseRepoConfig('- a\n- b')).toThrow('YAML mapping');
    expect(() => parseRepoConfig('a: [')).toThrow('not valid YAML');
  });
});

describe('validateConnection', () => {
  const secret = `tgs_${'a'.repeat(64)}`;
  it('accepts Forge web trigger URLs only', () => {
    expect(validateConnection(' https://abc-123.webtrigger.atlassian.app/public/xyz ', secret).url).toBe(
      'https://abc-123.webtrigger.atlassian.app/public/xyz',
    );
    expect(() => validateConnection('https://evil.example.com/x', secret)).toThrow('Forge web trigger URL');
    expect(() => validateConnection('http://abc.webtrigger.atlassian.app/x', secret)).toThrow();
    expect(() => validateConnection('https://abc.webtrigger.atlassian.app.evil.com/x', secret)).toThrow();
    expect(() => validateConnection('https://abc.webtrigger.atlassian.app/x', 'short')).toThrow('tgs_');
  });
});

describe('workspaceUuid', async () => {
  const { workspaceUuid } = await import('../src/index');
  it('normalises bare, braced and ARI workspace ids', () => {
    const id = '9c5c60f7-f4ba-4783-ba87-8a12b5f1473e';
    expect(workspaceUuid(id)).toBe(`{${id}}`);
    expect(workspaceUuid(`{${id.toUpperCase()}}`)).toBe(`{${id}}`);
    expect(workspaceUuid(`ari:cloud:bitbucket::workspace/${id}`)).toBe(`{${id}}`);
    expect(workspaceUuid(undefined)).toBeUndefined();
  });
});
