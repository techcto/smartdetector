# Hackathon submission evidence

Use verified results, not planned capabilities. Do not publish household footage, account identifiers, tokens, keys or reviewer credentials.

## Rules checklist

Source: [official rules](https://amazonappdev2026.devpost.com/rules), reviewed October 21, 2026.

- Submit by October 23, noon PDT / 3 pm EDT.
- Provide a working target-device demo and public English video under three minutes; keep reviewer access available through judging.
- Include repository access and product feedback: intended use, strengths, onboarding problems, improvements and whether you would build again.
- Submit reproducible friction logs for the possible bonus of up to 10%; credit is not guaranteed.
- For AWS Builder, explain the AWS integration and demonstrate it. Do not claim tools not used.
- For Open Source, identify an additional meaningful project/contribution, its URL, GitHub username, dates and purpose. Merely making this app public is not sufficient evidence.

## Evidence to capture

- Physical Vega TV: QR pairing, authorized location, camera browsing, remote navigation and actual event review. ARMv7 installation and production pairing have been observed; record a sanitized demonstration.
- Real Ring motion: record event time, SmartDetector incident and AutoVision result, then show the same incident on TV. Playground live view alone is not motion-webhook proof.
- AWS: explain the existing Ring queue/worker, AutoVision integration and indexed incident feed using the deployed architecture. Link the relevant CloudFormation and source, without account-specific outputs.
- Open Source candidate: [independent AgentCore adapter](https://github.com/techcto/smartdetector-agentcore). Verify contribution dates and eligibility before claiming it; [local verification](agentcore-verification.md) does not establish deployed AgentCore execution.
- Product feedback: attach the [friction log](friction-log.md). Prioritize a supported RN 0.83 notification API, a background-delivery sample and a Playground motion-webhook fixture.
- Movie-overlay claim remains blocked on configured ADM credentials and physical playback validation. The sender/receiver and actionable popup are implemented; a successful build is not delivery evidence. Do not substitute an in-app banner or an in-app movie. Use owned/licensed demo video.

## Suggested demo sequence

1. Pair the actual TV using a phone; select the intended location.
2. Show cameras and a real retained event with image frames and analysis.
3. Trigger an authorized Ring motion and follow the same incident through processing to the TV.
4. Only after verification: switch to another playback app, receive a system alert and return to SmartDetector. Otherwise omit this claim.
5. Briefly show privacy controls and explain the service architecture.

Before submission, replace pending claims with measured outcomes or remove them. Keep private reviewer access out of this document.
