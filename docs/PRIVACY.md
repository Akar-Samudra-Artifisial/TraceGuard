# TraceGuard Privacy Policy

Last updated: 1 November 2026

TraceGuard is an Atlassian Forge app built by Bayu Trisnapati as an entry to Atlassian Codegeist 2026. This policy explains what data the app handles.

## Where the app runs

TraceGuard is a "Runs on Atlassian" Forge app. All code runs on Atlassian's Forge platform. The app sends no data to servers operated by the developer or by any third party, and it declares no external egress.

## Data the app accesses

Within the Atlassian site where it is installed, and only to the extent allowed by the permissions you approve at install time, the app reads:

- Jira issues, projects, fix versions and links (`read:jira-work`)
- Confluence page content and summaries (`read:confluence-content.*`)
- Teamwork Graph relationships between issues, pages, projects and users (`read:graph:*`)

The app uses this data to build traceability views (requirements, hazards, stories, pull requests, tests and releases) and to answer questions in Rovo or from MCP-compatible clients that an admin has authorized.

## Data the app writes

With `write:jira-work` and `write:confluence-content`, the app writes only when a user explicitly asks it to, for example to assign a traceability gap or to publish an evidence pack page.

## Data storage

Any data the app persists is kept in Atlassian-hosted Forge storage on the same site. The developer has no access to your site's data. The app does not sell, share or use your data for advertising or model training.

## Personal data

The app may display user names and account IDs that Atlassian returns (for example, the owner of a gap). It does not copy personal data to systems outside Atlassian.

## Removing data

Uninstalling the app removes its Forge storage, following Atlassian's Forge data retention rules.

## Contact

Questions: bayutrisnapati@gmail.com
