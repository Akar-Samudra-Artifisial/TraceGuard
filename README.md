# TraceGuard (Forge app: Jira + Confluence)

Spike-stage scaffold. All surfaces read the fictional CardioSense dataset in `src/demo/cardiosense.ts`; responses carry `"simulated": true`.

## Layout

| Path | Contents |
| --- | --- |
| `src/core/` | Gap engine G1–G6, change impact, trace chain, evidence pack (pure, no Forge imports) |
| `src/adapters/source.ts` | Data source. Currently the demo fixture; Forge SQL comes later |
| `src/surfaces/actions.ts` | Rovo actions, also exposed as MCP tools through `rovo:mcp` |
| `src/surfaces/ui.ts`, `events.ts` | UI resolver and background stubs |
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
3. Ask the agent to change `src/dosing/limits.ts`. Expected from `check_change_impact`: REQ-112 (class C, HAZ-07), re-run CSM-T12 and CSM-T13.
