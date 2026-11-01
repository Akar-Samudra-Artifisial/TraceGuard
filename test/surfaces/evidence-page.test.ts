import { describe, expect, it } from 'vitest';
import * as core from '../../src/core';
import { demoConfig, demoSnapshot } from '../../src/demo/cardiosense';
import { escapeXml, evidencePageTitle, renderEvidencePage, stamp } from '../../src/surfaces/evidence-page';

const NOW = new Date('2026-11-01T10:32:05.123Z');
const pack = core.buildEvidencePack(demoSnapshot, demoConfig, '2.3', NOW);
const live = { projectKey: 'CSM', siteUrl: 'https://acme.atlassian.net', simulated: false, simulatedPullRequests: true };

describe('evidence page', () => {
  it('escapes XML special characters', () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
  });

  it('titles the page with project, release and time', () => {
    expect(stamp(pack.generatedAt)).toBe('2026-11-01 10:32 UTC');
    expect(evidencePageTitle(pack, live)).toBe('TraceGuard evidence pack · CSM 2.3 · 2026-11-01 10:32 UTC');
    expect(evidencePageTitle(pack, live, true)).toBe('TraceGuard evidence pack · CSM 2.3 · 2026-11-01 10:32:05 UTC');
    expect(evidencePageTitle(pack, { ...live, simulated: true })).toBe('TraceGuard evidence pack · release 2.3 · 2026-11-01 10:32 UTC');
  });

  it('renders summary, every gap and every requirement row', () => {
    const body = renderEvidencePage(pack, demoSnapshot, live);
    expect(body).toContain('<strong>38%</strong>');
    for (const g of pack.gaps) expect(body).toContain(escapeXml(g.message));
    for (const r of pack.rows) expect(body).toContain(`>${r.requirementId}<`);
    expect(body).toContain('Pull requests are simulated history.');
    expect(body).toContain('ac:name="status"');
    expect(body).not.toContain('ac:name="warning"');
  });

  it('links Jira keys to the site only for live data', () => {
    const s = { ...demoSnapshot, requirements: demoSnapshot.requirements.map((r) => ({ ...r, key: r.id === 'REQ-112' ? 'CSM-9' : undefined })) };
    const body = renderEvidencePage(pack, s, live);
    expect(body).toContain('<a href="https://acme.atlassian.net/browse/CSM-9">REQ-112</a>');
    expect(body).toContain('<a href="https://acme.atlassian.net/browse/CSM-41">CSM-41</a>');
    expect(body).not.toContain('/browse/PR-63');
    const sample = renderEvidencePage(pack, s, { ...live, simulated: true });
    expect(sample).not.toContain('/browse/');
    expect(sample).toContain('ac:name="warning"');
  });

  it('escapes requirement titles from Jira', () => {
    const s = { ...demoSnapshot, requirements: [{ ...demoSnapshot.requirements[0]!, title: '<script>x</script>' }] };
    const body = renderEvidencePage(core.buildEvidencePack(s, demoConfig, '2.3', NOW), s, live);
    expect(body).not.toContain('<script>');
    expect(body).toContain('&lt;script&gt;');
  });
});
