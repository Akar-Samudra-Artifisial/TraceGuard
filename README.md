# TraceGuard (Forge app: Jira + Confluence)

Reads traceability live from the Jira project `CSM`. Until that project exists, every surface falls back to the fictional CardioSense sample in `src/demo/cardiosense.ts` and responses carry `"simulated": true`.

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
3. Repository settings → Merge checks: enable *TraceGuard trace check* and mark it Required.

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
forge install           # choose Jira, then your developer site (org admin needed for read:graph scopes)
```

Spike D: open Rovo chat in Jira, pick **Audit Prep Agent**, ask "What blocks release 2.3 from being audit-ready?". Expected: 6 gaps (1 critical, 3 high, 2 medium).

Spike B:

1. Atlassian Administration → Apps → Sites → your site → Connected apps → TraceGuard → turn on the MCP tools.
2. Add the remote MCP server `https://mcp.atlassian.com/forge/<app-uuid>` to Claude Code or Cursor (UUID = part of `app.id` after `ari:cloud:ecosystem::app/`).
3. Ask the agent to change `src/dosing/limits.ts`. Expected from `check_change_impact`: REQ-112 (class C, HAZ-07), re-run the two dose tests (CSM-T12/T13 in the sample, CSM-23/24 after Load demo data on a fresh site).

## License

[MIT](LICENSE)
