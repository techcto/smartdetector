# SmartDetector developer friction log

Record reproducible friction as it occurs. Entries describe observed development issues, not hypothetical failures or claims of contest eligibility. Dates use America/New_York.

## AWS SDK dependency installation on October 9 2026

- **Task attempted:** Install the dependencies for the independent SmartDetector AgentCore MCP package.
- **Steps taken:** Pinned the Secrets Manager client to `3.1136.0`, matching the application's AWS SDK version, then ran `npm install --ignore-scripts` against the public npm registry.
- **Expected result:** A reproducible package lock and successful dependency installation.
- **Actual result:** The dependency resolver requested `@aws-sdk/credential-provider-http@^3.972.75`, which was not available. After narrowing that dependency, a `signature-v4-multi-region` tarball also returned HTTP 404.
- **Severity:** Medium. Blocked installation, but did not affect deployed services or data.
- **Workaround used:** Pinned the shared AWS and Smithy dependency versions to the existing application lockfile's published versions. A subsequent installation succeeded and reported zero vulnerabilities.
- **Actionable suggestion:** Publish and verify all dependency tarballs before publishing packages that depend on them. Include an automated installation check against a clean registry cache in the SDK release process.

## Local package links across npm versions on October 9 2026

- **Task attempted:** Build the main SmartDetector API container after adding the MCP submodule as a local npm package.
- **Steps taken:** Updated the package lock using host npm 9, then built the Node 26 container using its npm 11 `npm ci` step.
- **Expected result:** The same local package dependency installs consistently on the host and in the container.
- **Actual result:** Container installation rejected the lockfile with `EUSAGE`, reporting missing local-package and Zod entries because the local-directory linking behavior differed.
- **Severity:** Medium. Blocked the application image build; deployed services and data were unaffected.
- **Workaround used:** Added `install-links=true` to the root `.npmrc`, copied it into all application dependency stages, and regenerated the lockfile using Node 26. The API container subsequently built successfully.
- **Actionable suggestion:** Keep Node and npm versions aligned between host, CI and containers. Declare the local-package linking strategy explicitly and validate a clean container install before tagging a release.

## Entry format

For each new observation, include the task attempted, exact reproducible steps without credentials, expected and actual result, severity, workaround used, and an actionable suggestion. Link a sanitized issue or test output when useful. Do not include customer footage, account identifiers, tokens, secrets or personal information.
