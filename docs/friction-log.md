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

## System notifications versus RN runtime on October 21 2026

- **Task attempted:** Notify a viewer of a camera event while another TV app plays a movie, then return to SmartDetector.
- **Steps taken:** Inspect SDK 0.24 release notes and notification/ADM APIs; generate the official helloWorld-rn72 template independently of the working RN 0.83 console; install dependencies and typecheck the shared screens and notification adapter.
- **Expected result:** A supported system-notification path on the current recommended runtime.
- **Actual result:** RN 0.83 release notes list expo-notifications as unavailable. RN 0.72 provides a separate implementation; the virtual device cannot validate notifications. A notification display API is distinct from ADM background transport. High notification importance also requires a separate privilege.
- **Severity:** High for the requested cross-app demonstration; the foreground camera/event console still works.
- **Workaround used:** Use RN 0.72 as the single standard runtime under the existing SmartDetector Console identity. Implement a queued ADM sender, scoped registration, independent background receiver and native actionable toast. The Expo adapter requires a subtitle and does not forward thumbnail/launch-target fields, so the native SDK NotificationManager contract is used instead. The ARMv7 package compiled; access-control smoke checks passed. Configured cloud delivery and playback overlay/return behavior remain unverified; no cross-app success is claimed.
- **Actionable suggestion:** Publish a supported RN 0.83 equivalent and an end-to-end Vega example covering ADM, notification privileges, opt-out, authenticated navigation and physical-TV playback. State renderer/privilege restrictions next to the API installation instructions.
- **Sources:** [Release notes](https://developer.amazon.com/docs/vega/0.24/vega-release-notes), [notifications](https://developer.amazon.com/docs/vega-api/0.24/expo-notifications), [ADM](https://developer.amazon.com/docs/vega-api/0.24/README.amazon-devices_kepler-amazon-device-messaging).

## WSL setup and credential storage on October 21 2026

## Package version and build number on October 21 2026

- **Task attempted:** Update the existing SmartDetector Console on a physical Vega TV without uninstalling it.
- **Steps taken:** Build version 0.1.16 and attempt installation over version 0.1.12, build 2; compare installed and candidate package metadata using the package manager.
- **Expected result:** A newer semantic version is accepted, or the error identifies which version field must increase.
- **Actual result:** A candidate with build number 1 was rejected as Package version decrease even after its manifest and package version matched 0.1.16.
- **Severity:** Medium; blocked local update, with no data loss.
- **Workaround used:** Package build number 3, keeping version 0.1.16. The normal update and launch succeeded under com.smartdetector.console; no forced downgrade or uninstall was used. Release CI already uses its increasing workflow run number.
- **Actionable suggestion:** Include installed and candidate semantic/build versions in the refusal and clarify build-number ordering in the installation guide.

## WSL setup and credential storage details

- **Task attempted:** Build, simulate and install the native console from Ubuntu under WSL.
- **Steps taken:** Install missing runtime libraries, enable KVM access, launch the virtual device, then authenticate the Vega CLI for the physical TV.
- **Expected result:** The simulator launches and device authentication is saved securely.
- **Actual result:** Missing host libraries initially blocked startup. Device authentication then failed while unlocking the default Secret Service collection, although browser authentication completed.
- **Severity:** Medium; blocked the local setup until host dependencies and keyring configuration were corrected.
- **Workaround used:** Install the required Ubuntu libraries and configure an unlocked default keyring. A simulator window and subsequent physical-device installation worked in this environment. This is an observation, not a claim of official WSL support. No passwords or tokens belong in the log.
- **Actionable suggestion:** Add a preflight check for native libraries, KVM and Secret Service default-collection availability before starting browser login. Distinguish host validation from unsupported-platform status.

## Ring Playground live view versus event delivery on October 21 2026

- **Task attempted:** Exercise the production event-analysis pipeline without access to another developer's household cameras.
- **Steps taken:** Connect a temporary Playground token, discover its device, and invoke Package/Motion live-view scenarios.
- **Expected result:** A motion scenario also delivers the motion webhook consumed by the app.
- **Actual result:** The Playground demonstrated a WHEP sample stream; this did not establish delivery of a motion webhook into SmartDetector.
- **Severity:** Medium; stream testing is possible, but event-driven integration coverage is incomplete.
- **Workaround used:** Clearly distinguish real-frame Playground analysis from Ring webhook testing. Validate production webhook behavior separately using an authorized real camera; never label a local analysis as a received Ring motion.
- **Actionable suggestion:** Provide signed development webhook fixtures and a documented scenario linking event delivery, media readiness and stable device identifiers.

## Entry format reference

For each new observation, include the task attempted, exact reproducible steps without credentials, expected and actual result, severity, workaround used, and an actionable suggestion. Link a sanitized issue or test output when useful. Do not include customer footage, account identifiers, tokens, secrets or personal information.

## Native Vega development friction

- Task: add remote voice-entered event search to the native Vega console. Steps: inspect Vega 0.24 audio, keyboard and voice-navigation documentation; implement system-keyboard focus and a separate browser SpeechRecognition adapter; test editable transcript entry at desktop/phone sizes. Expected: remote speech becomes a search query. Actual: a supported direct remote-transcript API was not verified; Vega keyboard setup is documented but dictation on the target hardware remains untested. Severity: medium; typed search works. Workaround: TV keyboard/voice action with conditional dictation instructions, browser microphone fallback, explicit transcript review and Search, stop/background cleanup and no retained audio. Suggestion: publish a Vega-specific remote speech-to-text example and device capability matrix distinguishing Alexa UI navigation, keyboard dictation and raw microphone recording.

- Task: prepare a native SmartDetector Console release for Vega hardware. Steps: inspect the device requirements and official SDK template workflow; check the local toolchain. Expected: build and test an ARMv7 package. Actual: Vega SDK/CLI is not installed, so native compilation and device testing cannot run here. Severity: high for hardware release. Workaround: implement and unit-test the API client separately; generate the official SDK project when tooling is available; gate packaging on an approved SDK runner. Suggestion: provide a reproducible licensed CI toolchain image and clearer consumer-versus-developer installation guidance. No native build success or timing measurement is claimed.

- Task: install the SDK for a repeatable Docker release build. Steps: follow Amazon's 0.24 CI example using its SDK version `0.24.9311`. Expected: the documented pinned download installs. Actual: CLI 1.4.4 reports `Version not found: main@0.24.9311`. Severity: medium. Workaround: query `vega sdk list-remote`; pin the listed current `0.24.12112` instead. Suggestion: keep CI examples aligned with retained downloadable releases and document SDK retention. Docker compilation is supported separately from virtual-device testing.

- Resolution, updated October 21: SDK 0.24.12112 builds ARMv7, aarch64 and x86_64 packages in Docker. The ARMv7 Release console was installed on a physical Vega Fire TV and paired with the production service. This establishes installation and pairing, not Appstore certification or background notification support. The earlier missing-toolchain entry describes the initial state.

- Task: remove native template dependency vulnerabilities. Steps: generate the SDK helloWorld project; run npm audit; pin patched transitive packages, regenerate the lockfile and rebuild. Expected: a clean, compatible dependency tree. Actual: the initial tree had 75 findings; targeted patches reduce the production audit from 42 to 34, with remaining findings propagated from braces and sprintf-js advisories without published patched releases on October 10. Severity: high pending security review; exploitability in the packaged application is not established. Workaround: isolate trusted-source builds, preserve the supported runtime, export audit evidence and visibly warn rather than claim security approval. Suggestion: Amazon should publish a security-maintained template and distinguish build-only dependencies from device runtime dependencies.
