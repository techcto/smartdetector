import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});
if (result.error) throw result.error;
const audit = JSON.parse(result.stdout);
if (!audit.metadata?.vulnerabilities || audit.error)
  throw Error("Dependency audit unavailable; review registry response");
writeFileSync("security-audit.json", JSON.stringify(audit, null, 2) + "\n");
console.log(
  "Vega production dependency audit:",
  JSON.stringify(audit.metadata.vulnerabilities),
);
if (
  audit.metadata.vulnerabilities.high ||
  audit.metadata.vulnerabilities.critical
)
  console.warn(
    "::warning title=Vega SDK dependency review required::High-severity findings remain in the SDK dependency tree. This is a development package, not security approval for Appstore publication. Review security-audit.json; do not force-upgrade SDK dependencies.",
  );
