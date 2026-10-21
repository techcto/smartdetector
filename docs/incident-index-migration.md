# Ordered event reads

Feeds query sparse, key-only DynamoDB indexes by location or camera and descending
event time. One shared reader follows index pages and loads only selected canonical
incidents, preserving retention and deletion rules. No full-history scans or image
duplication are required. Reads are bounded; search reports truncation.

New deployments create both indexes directly. The permanent templates contain
only the final schema, without migration parameters or conditional indexes.

For existing tables, use temporary templates derived from the deployed template
to add IncidentsByTime and IncidentsByDevice in separate reviewed CloudFormation
change sets, preserving the running release. Wait for each index to become ACTIVE.
Backfill existing incidents using the metadata-only migration command before the
application update; rerun after old tasks drain to catch concurrent old-version
writes. The migration never reprocesses footage, changes TTL, recreates deleted
records, or consumes/replays queue messages.

See devops/migrate-incident-index.ts for the idempotent, plan-by-default backfill.
The final application deployment uses the normal permanent template and the new
release. No migration switch remains in the stack.
