# TraceGuard Privacy Policy

Last updated: 1 November 2026

TraceGuard is built by Bayu Trisnapati as an entry to Atlassian Codegeist 2026. It consists of two Atlassian Forge apps:

- **TraceGuard** for Jira (with optional Confluence features)
- **TraceGuard for Bitbucket**, a merge check

This policy explains what data the two apps handle.

## Where the apps run

Both apps run entirely on Atlassian's Forge platform. Neither app sends data to servers operated by the developer or by any third party.

The only network traffic outside the product APIs is between the two TraceGuard apps themselves. The Bitbucket merge check calls a Forge web trigger of the Jira app (`*.webtrigger.atlassian.app`, hosted by Atlassian). Each request is signed with a shared secret (HMAC-SHA256) that a Jira admin creates and a Bitbucket workspace admin pastes in. A request contains:

- the repository slug
- the pull request number and title
- the changed file paths
- the Jira issue keys found in the title, branch and commits

Because of this web trigger, the apps are not marked "Runs on Atlassian".

## Data the apps access

Within the site or workspace where they are installed, and only as far as the permissions you approve at install time allow:

- **Jira app:**
  - Jira issues, projects, fix versions and links (`read:jira-work`)
  - Assignable users, to assign a gap task (`read:jira-user`)
  - Confluence spaces and pages (`read:confluence-content.*`, `read:space:confluence`)
- **Bitbucket app:**
  - Pull requests, their commits and changed files
  - The `.traceguard.yml` file in the repository (`read:pullrequest`, `read:repository`)
  - Your workspace permission, to limit the settings page to workspace admins (`read:workspace`)

## Data the apps write

The Jira app writes only when a user explicitly asks it to:

- **Load demo data** creates the CardioSense demo project and its Confluence space.
- **Link test case** creates an issue link.
- **assign_gap** creates and assigns a Jira task.
- **Publish evidence pack** creates a Confluence page.

The app reads Jira and Confluence as itself, so it checks the user's own permissions first: TraceGuard data from a Jira project is shown only to users with Browse projects in that project, an evidence pack is published only to a space the user can view, and linking issues or creating and assigning tasks needs the matching Jira permissions. The Bitbucket app never writes to Bitbucket. It only returns a pass or fail result for the merge check.

## Data storage

Data the apps persist is kept in Atlassian-hosted Forge storage, separate for each installation:

- **Jira app:**
  - settings (project key, safety-critical path globs, Confluence space key)
  - the Bitbucket connection secret, in encrypted secret storage
  - merged pull requests that passed the check (repository, number, title, issue keys, file paths, merge time)
  - the Jira key of each task created by assign_gap
- **Bitbucket app:** the web trigger URL and the connection secret, in encrypted secret storage

Neither app stores names, email addresses or account IDs. The developer has no access to your data. The apps do not sell or share your data, and do not use it for advertising or model training.

## Personal data

The apps display user names that Atlassian returns, for example the assignee of an issue as the owner of a gap. They do not store them or copy them outside Atlassian.

## Removing data

Uninstalling an app removes its Forge storage, following Atlassian's Forge data retention rules. Rotating the secret in TraceGuard setup immediately disconnects the Bitbucket app.

## Contact

Questions: bayutrisnapati@gmail.com
