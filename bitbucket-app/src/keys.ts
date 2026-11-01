/** Jira issue keys such as CSM-16, as written in PR titles, branch names and commit messages. */
const KEY = /(?<![A-Za-z0-9])([A-Z][A-Z0-9_]+-[1-9]\d{0,8})(?![A-Za-z0-9])/g;
const MAX_KEYS = 50;

export function extractIssueKeys(texts: (string | undefined)[]): string[] {
  const keys = new Set<string>();
  for (const text of texts) {
    // Branch names are often lower case: feature/csm-16-dose-table.
    for (const source of [text ?? '', (text ?? '').toUpperCase()]) {
      for (const m of source.matchAll(KEY)) keys.add(m[1]!);
    }
  }
  return [...keys].slice(0, MAX_KEYS);
}
