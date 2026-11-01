# TraceGuard: Devpost submission draft

Draft of the Codegeist 2026 submission text. Sections other than installation and testing are still to be written.

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
