# TraceGuard (Forge app: Jira + Confluence)

Reads traceability live from the Jira project `CSM`. Until that project exists, every surface falls back to the fictional CardioSense sample in `src/demo/cardiosense.ts` and responses carry `"simulated": true`.

## Try it

1. Install [TraceGuard for Jira + Confluence](https://developer.atlassian.com/console/install/d762877f-0818-47f7-9ed7-a02c246bd78e?signature=AYABeOtB%2Fd4vb41GJqgj5TsECSkAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBdTOOJrGMYM0TyDpYaVtkMQAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDJeGhPhXXOynh1w4awIBEIA7FS0ErZoWPb%2BcB3nsd3lXcqPYCXYyjieG13lZxacGSaGPTf7wX1GtY4BYvkCmVqNZ0AITg6r5OEh5O3sAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgGhlQ%2BQpLvrbwg6o9wiwxy4AAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQM7rtcT5hxjk%2FmHsmqAgEQgDsHOg0fDoyati4qJV5fxMSSRzeDz5ydVIoc9o0tfpWIfRHYccJS5B7JTxFlrcaPLX2wnq69GzdKv3O4IAAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEARbthSDfFWSd5M6gB84wWV0AAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAwTipJ5ZvfyYJ0RrEsCARCAO1q2qqKJzytFg8Jx1%2BgIF08QVo2FaRHXR%2FQn3ElSScgKXUNYm3snvpM3gWeJCYb%2FMdERJmXxl0cg9pZiAgAAAAAMAAAQAAAAAAAAAAAAAAAAABOh5B5GwTWiyQ4rTv%2BnUGP%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADLLNOnyjihA47Y59Rx9WiqGIc8O1w1r0eL8VKilN3Ae0NGt1kexsJgkIFJzqZMtG9KO8KVzB9Pvl0w8UHXJ3eEmXtU%3D&product=jira&product=confluence) on your site (Confluence is optional; it enables evidence packs).
2. Jira admin → Apps → Manage apps → TraceGuard setup → **Load demo data**. The project page then shows release 2.3 at 38% coverage with 6 gaps.
3. Optional, for the merge check: install [TraceGuard for Bitbucket](https://developer.atlassian.com/console/install/346c4e15-82c1-453c-babc-216f7b5aa73c?signature=AYABeIdEkXvwLP5Kd%2B49rk%2F3Vf4AAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucB9wl8gDPDKKaeQcSgyXbOVwAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDJT7aiRp2AyBO7qMGQIBEIA79mPpGGQRlnQR2YDf%2Fg1u0TaoktBL%2B8JCDb6jPxut335kmSp6aIEun31f2w5Wr3G6AGr3N2Ac%2F5CshWMAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgFxx24oc%2B%2F9%2B5ihXqqXLrHNAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMMyy6W%2BALDfDNgt1rAgEQgDseGnIbQyMcUsyU4R9YUxtXqi0Hz7Nmnf3xUZhbCMJmDgbImlzFcrZD36JkDjUOYZyO1FNG1BZy%2B4NdagAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAXnEggvsRCt4yX0N1bIXsqgAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAxRGzcL%2FBdwT5%2Fh7AoCARCAO5RPgSktLqKt%2BdStoCCijo0hO2X0OrKo%2FSqVgM%2BVlo0A%2F32BhXaF4IVVT8mhOKMjBJhZIZ0ruQc9mP3nAgAAAAAMAAAQAAAAAAAAAAAAAAAAAFFqmcakjuiOPxPPjrTMBPH%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADKRmD1B3%2Frfb%2ByQ0sNKvLpCrIO91uV%2Fm76qckb5tUb8qmO3JCpYHbIWVAk8pfdbg444PFYqeUCMrPkjlQT5SzFEnis%3D&product=bitbucket) in a Bitbucket workspace and follow *Connect* below.

## Jira data model

| Concept | In Jira |
| --- | --- |
| Requirement | Issue type `Requirement`; issue property `traceguard` = `{ reqId, safetyClass, status, approvedAt, paths }` |
| Hazard | Issue type `Hazard`; property `{ hazardId, severity }`; link `Mitigates` from the requirement |
| Work item | Any other issue linked with `Implements` to a requirement |
| Test case | Issue type `Test Case`; property `{ lastRun: { result, at, build } }`; link `Verifies` |
| Release | Fix version (released = signed off) |
| Edited after approval (G6) | Summary/description change in the changelog after `approvedAt` |
| Pull requests | Forge KVS: simulated seed history plus merged PRs reported by the Bitbucket app |

**Load demo data** (Jira admin → Apps → TraceGuard setup) creates all of the above as project `CSM`, plus a Confluence space `CSM` when Confluence is installed.

**Evidence pack**: `generate_evidence_pack` (Rovo/MCP) or *Publish evidence pack* on the project page creates a new Confluence page per run (summary, open gaps, matrix). Target space: `space` input → setting → space whose key equals the Jira project key → first global space.

## Bitbucket merge check (`bitbucket-app/`)

A second Forge app, **TraceGuard for Bitbucket**, adds the merge check *TraceGuard trace check* (`on-code-pushed`, `on-merge`). For each pull request it collects changed files and Jira issue keys (title, source branch, commits) and asks this app's `trace-lookup` web trigger, signed with HMAC-SHA256 (`x-traceguard-signature: t=<unix>,v1=<hex>`). A change to safety-critical code passes only when a referenced issue traces to every affected requirement. The check fails closed when Jira cannot be reached. Merged PRs that pass are stored as real trace history.

Connect:

1. Jira: Apps → TraceGuard setup → **Connect Bitbucket** → *Create connection*. Copy the URL and the secret (shown once).
2. Bitbucket: install the app, Workspace settings → **TraceGuard**, paste both values (workspace admin only; a signed test request is sent before saving).
3. Repository settings → Merge checks: add *TraceGuard trace check* for the main branch. Marking it Required (and adding it at workspace level) needs Bitbucket Premium; on other plans the check still runs and shows its result on every pull request.

Optional `.traceguard.yml` on the destination branch:

```yaml
repo: cardiosense-firmware   # name in TraceGuard (default: Bitbucket slug)
safety-critical:             # overrides the globs set in Jira
  - src/dosing/**
  - src/alarms/**
```

```bash
cd bitbucket-app && npm install && npm test && npm run typecheck
forge deploy -e production && forge install   # choose Bitbucket and the workspace
```

## Layout

| Path | Contents |
| --- | --- |
| `src/core/` | Gap engine G1–G6, change impact, trace chain, evidence pack (pure, no Forge imports) |
| `src/adapters/` | Jira REST reader (`jira.ts`, `jira-map.ts`), demo seed (`seed.ts`), KVS settings (`store.ts`), source with fixture fallback (`source.ts`) |
| `src/surfaces/actions.ts` | Rovo actions, also exposed as MCP tools through `rovo:mcp` |
| `src/surfaces/ui.ts`, `events.ts` | UI resolver and background stubs |
| `src/surfaces/webtrigger.ts` | `trace-lookup` web trigger for the Bitbucket merge check |
| `bitbucket-app/` | TraceGuard for Bitbucket (merge check + workspace settings page) |
| `ui/src/` | Custom UI views (React): project page, issue panel, admin page, Confluence macro |
| `static/*/build` | Build output of `npm run build:ui` (git-ignored; required before `forge deploy`) |
| `prompts/prompt.md` | Audit Prep Agent prompt |

## Local checks

```bash
npm install
npm test
npm run typecheck
npm run build:ui   # builds static/{matrix,chain,setup,macro}/build
```

## Deploy for spikes B (MCP) and D (Rovo agent)

Forge CLI needs Node `^22.23.4 || ^24.22.1 || >=26.12.1`.

```bash
npm install -g @forge/cli
forge login
forge register          # replaces the placeholder app.id in manifest.yml
forge lint
npm run build:ui
forge deploy
forge install           # choose Jira, then your developer site
```

Spike D: open Rovo chat in Jira, pick **Audit Prep Agent**, ask "What blocks release 2.3 from being audit-ready?". Expected: 6 gaps (1 critical, 3 high, 2 medium).

Spike B:

1. Atlassian Administration → Apps → Sites → your site → Connected apps → TraceGuard → turn on the MCP tools.
2. Add the remote MCP server `https://mcp.atlassian.com/forge/<app-uuid>` to Claude Code or Cursor (UUID = part of `app.id` after `ari:cloud:ecosystem::app/`).
3. Ask the agent to change `src/dosing/limits.ts`. Expected from `check_change_impact`: REQ-112 (class C, HAZ-07), re-run the two dose tests (CSM-T12/T13 in the sample, CSM-23/24 after Load demo data on a fresh site).

## License

[MIT](LICENSE)
