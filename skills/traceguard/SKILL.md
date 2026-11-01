---
name: traceguard
description: Use when changing code in a regulated repository that has TraceGuard installed. Checks requirement traceability before and after edits.
---

# TraceGuard

TraceGuard exposes these tools through the Atlassian MCP server
(`https://mcp.atlassian.com/forge/d762877f-0818-47f7-9ed7-a02c246bd78e`):
`check_change_impact`, `find_requirements_for_path`, `get_trace`, `list_gaps`, `generate_evidence_pack`.

Before editing any file:

1. Call `check_change_impact` with the repository name and the files you plan to touch.
2. If any affected requirement is safety class C (or ASIL C/D), tell the user which requirements and hazards are affected before writing code.
3. If the user has not given a Jira issue that implements those requirements, stop and ask for the issue key. Do not invent one. You may suggest the issue that the tool result names.

When committing:

- Put the Jira issue key in the commit message and the pull request title. The TraceGuard merge check in Bitbucket looks for it there.
- List the tests returned by `check_change_impact` under "Tests to re-run" in the pull request description.

Never build URLs for Jira issues or pull requests yourself. Use only links that a tool result returns.
