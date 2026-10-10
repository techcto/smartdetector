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

## Household identity versus object detection on October 10 2026

- **Task attempted:** Add household labels, optional tracking and personal alert preferences using AutoVision person detections.
- **Steps taken:** Reviewed object labels, person boxes, retention and location-specific linking; separated face measurements from named references.
- **Expected result:** Reuse detections without putting an identity database in the vision service.
- **Actual result:** Whole-person boxes cannot identify family. A Family label is not enrollment; muting an entire mixed event risks hiding an unknown visitor or hazard.
- **Severity:** High for an unsafe suppression design; no deployed missed alert is claimed.
- **Workaround used:** Explicit enrollment consent, encrypted location-scoped references, revision-guarded activity links and fail-open alert rules. Suppression stays disabled pending model/threshold validation.
- **Actionable suggestion:** Provide a consent-aware reference integration separating detection, matching, activity retention and notification policy, including mixed-person/hazard tests.

## Remote microphone versus keyboard dictation on October 10 2026

- **Task attempted:** Add voice-entered event search to the Fire TV web console.
- **Steps taken:** Implemented typed search, keyboard focus and optional browser SpeechRecognition; documented hardware validation separately.
- **Expected result:** A portable input path for remote speech.
- **Actual result:** The global Alexa button is not a web speech-input API. Keyboard dictation/browser recognition depend on runtime support; Cube hardware has not been validated.
- **Severity:** Medium — typed search remains available; direct remote microphone capture is not claimed.
- **Workaround used:** Keyboard dictation when supported, opt-in browser mic where available, typed fallback, and transcript review before submission.
- **Actionable suggestion:** Publish a Fire TV web capability matrix/sample for keyboard dictation, remote mic limitations, permissions and fallbacks by runtime/device.

## Entry format

For each new observation, include the task attempted, exact reproducible steps without credentials, expected and actual result, severity, workaround used, and an actionable suggestion. Link a sanitized issue or test output when useful. Do not include customer footage, account identifiers, tokens, secrets or personal information.
