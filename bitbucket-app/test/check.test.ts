import { describe, expect, it } from 'vitest';
import { runMergeCheck, type CheckDeps } from '../src/check';
import { verify } from '../src/signature';

const secret = `tgs_${'b'.repeat(64)}`;
const event = {
  workspace: { uuid: '{ws}' },
  repository: { uuid: '{repo}' },
  pullrequest: { id: 7 },
  trigger: { type: 'on-code-pushed' },
};

function deps(over: Partial<CheckDeps> = {}, reply: { status: number; text: string } | Error = { status: 200, text: '{"success":false,"message":"Untraced change."}' }) {
  const sent: { url: string; body: string; headers: Record<string, string> }[] = [];
  const d: CheckDeps = {
    getConnection: async () => ({ url: 'https://x.webtrigger.atlassian.app/public/abc', secret }),
    getPullRequest: async () => ({ id: 7, title: 'Raise max dose', description: '', sourceBranch: 'feature/csm-16-limits', destinationCommit: 'abc123' }),
    getRepoSlug: async () => 'cardiosense-firmware',
    getChangedFiles: async () => ['src/dosing/limits.ts'],
    getCommitMessages: async () => ['tune limits'],
    getFile: async () => undefined,
    post: async (url, body, headers) => {
      sent.push({ url, body, headers });
      if (reply instanceof Error) throw reply;
      return reply;
    },
    ...over,
  };
  return { d, sent };
}

describe('runMergeCheck', () => {
  it('sends a signed lookup with files, keys from title/branch/commits and returns the verdict', async () => {
    const { d, sent } = deps();
    expect(await runMergeCheck(event, d)).toEqual({ success: false, message: 'Untraced change.' });
    const req = sent[0]!;
    expect(JSON.parse(req.body)).toEqual({
      repo: 'cardiosense-firmware',
      trigger: 'on-code-pushed',
      pullRequest: { id: 7, title: 'Raise max dose' },
      files: ['src/dosing/limits.ts'],
      issueKeys: ['CSM-16'],
    });
    expect(verify(secret, req.body, req.headers['x-traceguard-signature'])).toEqual({ ok: true });
  });

  it('passes .traceguard.yml settings through', async () => {
    const { d, sent } = deps({ getFile: async () => 'repo: firmware\nsafety-critical: [src/ui/**]' });
    await runMergeCheck(event, d);
    expect(JSON.parse(sent[0]!.body)).toMatchObject({ repo: 'firmware', safetyCriticalPaths: ['src/ui/**'] });
  });

  it('fails closed when not connected, unreachable, refused or malformed', async () => {
    expect((await runMergeCheck(event, deps({ getConnection: async () => undefined }).d)).message).toMatch(/not connected/);
    expect(await runMergeCheck(event, deps({}, new Error('timeout')).d)).toMatchObject({ success: false, message: expect.stringMatching(/could not reach Jira/) });
    expect((await runMergeCheck(event, deps({}, { status: 401, text: '{"error":"Invalid signature."}' }).d)).message).toBe(
      'TraceGuard for Jira refused the check: Invalid signature.',
    );
    expect((await runMergeCheck(event, deps({}, { status: 200, text: '<html>' }).d)).success).toBe(false);
    expect((await runMergeCheck(event, deps({}, { status: 200, text: '{"ok":true}' }).d)).success).toBe(false);
  });

  it('fails with the config error for a broken .traceguard.yml', async () => {
    const r = await runMergeCheck(event, deps({ getFile: async () => 'safety-critical: nope' }).d);
    expect(r).toEqual({ success: false, message: expect.stringContaining('"safety-critical"') });
  });

  it('notes when Jira only has the built-in sample', async () => {
    const r = await runMergeCheck(event, deps({}, { status: 200, text: '{"success":true,"message":"Traced.","simulated":true}' }).d);
    expect(r.success).toBe(true);
    expect(r.message).toMatch(/^Traced\. \(Jira shows the built-in sample/);
  });
});
