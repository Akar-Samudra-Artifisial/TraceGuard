# TraceGuard: Devpost submission

**Tagline:** TraceGuard turns your existing Jira, Confluence and Bitbucket work into a live, audit-ready traceability matrix, and stops untraced changes to safety-critical code before they merge.

## Inspiration

Teams that build medical, automotive or industrial software must prove, for every release, that each requirement is implemented, verified by a passing test and linked to the hazards it controls (IEC 62304, ISO 26262, ISO 13485). In practice that proof is a spreadsheet rebuilt by hand before each audit. It is out of date the day after it is finished, and nobody notices when a developer changes dosing code without a ticket until an auditor does. We wanted the trace to live where the work already happens and to be enforced at the moment a change is made.

## What it does

TraceGuard reads the requirement → hazard → story → test → pull request chain directly from Jira and keeps it current for every release (fix version).

- **Project page "TraceGuard" in Jira**: coverage score per release, a traceability matrix and a list of gaps sorted by severity. Six gap types are detected: G1 requirement not implemented, G2 not verified, G3 failed test, G4 untraced change to safety-critical code, G5 verification older than the last change, G6 requirement edited after approval.
- **Issue panel "Trace chain"**: the full chain of the open issue, with a one-click *Link test case* fix for missing verification.
- **Audit Prep Agent (Rovo)**: answers "What blocks release 2.3 from being audit-ready?", groups gaps by severity and owner, assigns a gap as a real Jira task, and publishes an evidence pack (summary, open gaps, matrix) as a Confluence page. Every write asks for confirmation first.
- **MCP server (Rovo MCP)**: the same tools (`check_change_impact`, `find_requirements_for_path`, `get_trace`, `list_gaps`, `generate_evidence_pack`) are available to coding agents such as Claude Code or Cursor, so an agent can ask "which requirements and tests does `src/dosing/limits.ts` affect?" before it edits the file.
- **Confluence macro "Traceability matrix"** for quality documents.
- **TraceGuard for Bitbucket**: a custom merge check. A pull request that changes safety-critical code must reference a Jira issue traced to every affected requirement. Otherwise the check fails and names the requirement, its hazard, an issue to reference and the tests to re-run. Merged pull requests that pass are recorded as trace history in Jira.
- **Load demo data**: one button creates a realistic CardioSense Monitor project (8 requirements, 3 hazards, 7 stories, 9 test cases, two releases) so judges can try everything in minutes.

TraceGuard reports evidence; it does not certify compliance.

## How we built it

- Two Atlassian Forge apps: one for Jira + Confluence, one for Bitbucket (a Forge app cannot span Bitbucket and Jira). Both are TypeScript on the Node.js 24 runtime.
- Traceability lives in Jira itself: issue types Requirement, Hazard and Test Case, link types Implements / Verifies / Mitigates, a `traceguard` issue property for attributes such as safety class and last test run, and fix versions as releases. No external database.
- A pure core (`src/core`: gap engine, change impact, glob matching, merge-check decision) is shared by every surface and covered by unit tests (96 tests in the Jira app, 12 in the Bitbucket app).
- Surfaces: Custom UI (React) for the project page, issue panel, admin page and macro; Rovo agent + six actions; Rovo MCP module exposing five of those actions; a web trigger for the Bitbucket app.
- The Bitbucket app reads the pull request diffstat, title, branch and commits plus an optional `.traceguard.yml`, then calls a web trigger in the Jira app. Requests are signed with HMAC-SHA256 and a shared secret that a Jira admin creates in TraceGuard setup and a Bitbucket workspace admin pastes into workspace settings. The check fails closed.
- Data is read as the app, but every surface first checks the calling user's own permissions (Browse projects in Jira, read access to the Confluence space), so TraceGuard never shows a user more than Jira or Confluence would.

## Challenges we ran into

- **Bitbucket to Jira.** Forge apps cannot call each other, so the merge check needed a signed web trigger, replay protection (timestamped signatures, 5-minute window) and a secret rotation flow. The trade-off is that a dynamic web trigger means neither app qualifies for "Runs on Atlassian"; we chose a merge check that knows the real requirements over a self-contained one that duplicates them.
- **Bitbucket API drift.** The endpoint we first used to check workspace admin rights had been removed, so the settings page rejected every admin. We switched to the current workspace permission endpoint after testing on a real workspace.
- **UI Kit typings.** `@forge/react` 12 ships React 18 typings; with React 19 every component prop became required and the Forge bundler refused to build. Pinning React 18 fixed it.
- **Scopes.** Confluence v2 APIs reject classic scopes, and each new scope or the web trigger forces a major version upgrade on every site, so we had to plan scope changes carefully.
- **Keeping the agent honest.** Early Rovo answers invented links to issues and pull requests. The prompt now allows only URLs returned by an action, and every action result says when it is based on sample data.
- **Real writes from an agent.** `assign_gap` creates a Jira task, so it checks the user's create/assign permissions, avoids duplicates for the same gap and asks for an assignee instead of guessing.

## Accomplishments that we're proud of

- The demo path is fully real: from *Load demo data* to the gap list, the Rovo answer, the Confluence evidence pack, the MCP answer in Claude Code and the Bitbucket merge check, all read the same Jira project.
- A blocked pull request tells the developer exactly how to fix it (which story to reference and which tests to re-run), not just "failed".
- Installation was tested from scratch on a clean site and a non-Premium Bitbucket workspace by following the judge instructions below.

## What we learned

- Regulated teams already have most of the trace data in Jira; the missing piece is checking it continuously and at the point of change.
- Forge's permission model rewards designing scopes and data flows up front.
- Agent features need the same guardrails as an API: confirmation before writes, permission checks per user and answers grounded only in tool results.

## What's next for TraceGuard

- Read Bitbucket and Confluence context through Teamwork Graph instead of app storage.
- Configurable requirement and hazard issue types, so existing projects work without the demo schema.
- Signed, versioned evidence pack baselines per release and an export for auditors.
- Marketplace listing.

## Built with

Atlassian Forge, Jira, Confluence, Bitbucket, Rovo agents and actions, Rovo MCP, Forge Custom UI, Forge UI Kit, Forge KVS, web triggers, TypeScript, React, Node.js, Vitest.

## Links

- Source code: https://github.com/Akar-Samudra-Artifisial/TraceGuard (MIT)
- Video: _to be added_

## Installation links

- TraceGuard for Jira + Confluence: https://developer.atlassian.com/console/install/d762877f-0818-47f7-9ed7-a02c246bd78e?signature=AYABeOtB%2Fd4vb41GJqgj5TsECSkAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBdTOOJrGMYM0TyDpYaVtkMQAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDJeGhPhXXOynh1w4awIBEIA7FS0ErZoWPb%2BcB3nsd3lXcqPYCXYyjieG13lZxacGSaGPTf7wX1GtY4BYvkCmVqNZ0AITg6r5OEh5O3sAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgGhlQ%2BQpLvrbwg6o9wiwxy4AAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQM7rtcT5hxjk%2FmHsmqAgEQgDsHOg0fDoyati4qJV5fxMSSRzeDz5ydVIoc9o0tfpWIfRHYccJS5B7JTxFlrcaPLX2wnq69GzdKv3O4IAAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEARbthSDfFWSd5M6gB84wWV0AAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAwTipJ5ZvfyYJ0RrEsCARCAO1q2qqKJzytFg8Jx1%2BgIF08QVo2FaRHXR%2FQn3ElSScgKXUNYm3snvpM3gWeJCYb%2FMdERJmXxl0cg9pZiAgAAAAAMAAAQAAAAAAAAAAAAAAAAABOh5B5GwTWiyQ4rTv%2BnUGP%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADLLNOnyjihA47Y59Rx9WiqGIc8O1w1r0eL8VKilN3Ae0NGt1kexsJgkIFJzqZMtG9KO8KVzB9Pvl0w8UHXJ3eEmXtU%3D&product=jira&product=confluence
- TraceGuard for Bitbucket (merge check): https://developer.atlassian.com/console/install/346c4e15-82c1-453c-babc-216f7b5aa73c?signature=AYABeIdEkXvwLP5Kd%2B49rk%2F3Vf4AAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucB9wl8gDPDKKaeQcSgyXbOVwAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDJT7aiRp2AyBO7qMGQIBEIA79mPpGGQRlnQR2YDf%2Fg1u0TaoktBL%2B8JCDb6jPxut335kmSp6aIEun31f2w5Wr3G6AGr3N2Ac%2F5CshWMAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgFxx24oc%2B%2F9%2B5ihXqqXLrHNAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMMyy6W%2BALDfDNgt1rAgEQgDseGnIbQyMcUsyU4R9YUxtXqi0Hz7Nmnf3xUZhbCMJmDgbImlzFcrZD36JkDjUOYZyO1FNG1BZy%2B4NdagAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAXnEggvsRCt4yX0N1bIXsqgAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAxRGzcL%2FBdwT5%2Fh7AoCARCAO5RPgSktLqKt%2BdStoCCijo0hO2X0OrKo%2FSqVgM%2BVlo0A%2F32BhXaF4IVVT8mhOKMjBJhZIZ0ruQc9mP3nAgAAAAAMAAAQAAAAAAAAAAAAAAAAAFFqmcakjuiOPxPPjrTMBPH%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADKRmD1B3%2Frfb%2ByQ0sNKvLpCrIO91uV%2Fm76qckb5tUb8qmO3JCpYHbIWVAk8pfdbg444PFYqeUCMrPkjlQT5SzFEnis%3D&product=bitbucket

## Testing instructions for judges

**Jira + Confluence (about 3 minutes)**

1. Open the Jira installation link, choose your site and tick Confluence (optional; needed for evidence packs).
2. Jira → Apps → Manage apps → **TraceGuard setup** → **Load demo data**. This creates project `CSM` (8 requirements, 3 hazards, 7 stories, 9 test cases, releases 2.2 and 2.3) and a Confluence space `CSM`.
3. Open project CSM → **TraceGuard**. Release 2.3 shows 38% coverage (3 of 8 requirements traced) and 6 gaps: 1 critical, 3 high, 2 medium.
4. Rovo → Agents → **Audit Prep Agent**: ask "What blocks release 2.3 from being audit-ready?", then "Generate the traceability evidence pack for 2.3" and confirm. A page appears in Confluence space `CSM`.

**Bitbucket merge check (about 5 minutes, optional)**

1. In Jira, TraceGuard setup → **Connect Bitbucket** → **Create connection**. Keep the URL and secret (the secret is shown once).
2. Open the Bitbucket installation link and choose a workspace you administer.
3. Bitbucket → Workspace settings → Forge apps → **TraceGuard**: paste the URL and secret, then **Connect**.
4. Create a repository with `.traceguard.yml` on `main`:
   ```yaml
   repo: cardiosense-firmware
   safety-critical:
     - src/dosing/**
   ```
   and a file `src/dosing/limits.ts`.
5. Repository settings → Merge checks → add **TraceGuard trace check** for the main branch. (Marking it Required needs Bitbucket Premium; the result is shown on every pull request either way.)
6. Open a pull request that changes `src/dosing/limits.ts` with no issue key in the title. The check fails and names REQ-112, hazard HAZ-07, the story to reference (CSM-16) and the tests to re-run.
7. Add `CSM-16` to the pull request title and re-run the check. It passes.

## Known limitations

- The Bitbucket app calls a dynamic web trigger in the Jira app, so neither app qualifies for "Runs on Atlassian".
- Pull request history before the Bitbucket app was connected is simulated seed data (marked as such).
