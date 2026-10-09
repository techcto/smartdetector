# SmartDetector MCP local verification

Verified on October 9, 2026. The adapter calls the existing SmartDetector API; it does not access application storage directly. These results cover local implementation, not AWS deployment or Marketplace approval.

| Check | Result |
| --- | --- |
| Application tests | 11 passing, including key scopes, organization isolation, expiry, revocation and same-origin key management |
| Independent MCP package tests | 6 passing, including SDK initialization, tools, prompt, concurrent calls, validation, credential protection and SigV4 signing |
| ARM64 container | Built successfully and all 6 package tests passed on Node 26 inside the ARM64 image |
| Real local API integration | All 5 tools exercised against the running API, with an explicitly synthetic sensor incident; revoked credentials rejected immediately |
| Browser UI | Logged-in API-key management, create drawer, one-time key display and revocation passed with no page errors |
| Application build | Typecheck and Next.js production build passed; web, API and worker Docker images built successfully |
| CloudFormation | Main application and AgentCore templates passed cfn-lint; conditional empty network defaults have a documented lint exception and a CloudFormation validation rule |
| Marketplace payload | Separate AgentCore container delivery payload generated with DRY_RUN; no submission was made |
| Production dependency audit | Zero reported vulnerabilities in the application production dependency tree and the independent MCP package |

The application linter reported six existing warnings and no errors. The full application dependency audit still reports five high-severity development dependency advisories; this work does not claim those are fixed.

## Reproduce locally

With SmartDetector running on port 8082:

```bash
npm run test:web
npm --prefix submodules/smartdetector-agentcore ci
npm run test:agentcore
node devops/testing/mcp-smoke.mjs
```

The smoke test creates and revokes its own temporary integration key. Set `SMARTDETECTOR_TEST_USER` and `SMARTDETECTOR_TEST_PASSWORD` for non-default local credentials. Optional `SMARTDETECTOR_TEST_SEED=1` creates an explicitly synthetic sensor event retained in the local dashboard for review. It refuses remote hosts.

## AWS verification

Publish the pinned package and ARM64 image, then review and execute the runtime CloudFormation change set. Run the package's `npm run smoke:aws` with the runtime ARN and an authorized AWS profile. Record the deployed image digest, sanitized tool response and verification date before claiming a working AWS integration. A separate AgentCore Marketplace product ID is required for that release workflow; the main ECS product ID must not be reused.

See the [package quickstart](../submodules/smartdetector-agentcore/README.md) and [developer friction log](friction-log.md).
