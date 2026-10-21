# Ordered event reads

Feeds query sparse, key-only DynamoDB indexes by location or camera and descending
event time. One shared reader follows index pages and batch-loads only selected
canonical incidents. It restores ordering after BatchGet, retries unprocessed
keys, checks retention, and ignores deleted canonical rows. There are no table
scans or full-history image downloads in dashboard/TV polling.

Reads are bounded to 40 index pages and approximately 10 MB of canonical data.
Search reports truncation rather than treating a bounded window as exhaustive.
Indexes are eventually consistent: new events can take a short time to appear.
Device previews use that camera's own index, so other cameras cannot hide them.
Images and TTL stay on canonical records; index entries disappear when those
records are removed by purge, retention, device removal or account deletion.

## Existing deployments

Do not deploy indexed readers until both indexes are ACTIVE and existing records
are indexed. DynamoDB allows adding only one GSI per table update. Preserve the
current application release during these reviewed CloudFormation change sets:

1. Apply the matching deployment template with IncidentIndexStage=organization.
   Review addition of IncidentsByTime and its attribute definitions to the existing
   table, plus BatchGetItem permission on the task role. Never replace the table.
2. Wait for that index to be ACTIVE, then apply IncidentIndexStage=complete to add
   IncidentsByDevice. Wait for that index to be ACTIVE too.
3. For each location run the migration in plan mode, review counts, then repeat
   with --apply. Use local AWS_PROFILE credentials, not embedded credentials:

       node --import tsx devops/migrate-incident-index.ts --table TABLE --org LOCATION --region us-east-1

   Only two index attributes change. Payloads, TTL, quotas and AutoVision jobs
   remain unchanged. Concurrently deleted incidents are never recreated.
4. Publish and deploy the application through a reviewed CloudFormation change
   set. New writes now update index attributes atomically with the incident.
5. Rerun the migration with --apply after all old tasks drain, catching events
   written by the old version during rollout. Already indexed rows are skipped.
   Each completed page prints a resumeAfter sort key; --after SORT_KEY resumes
   there after an error. Repeating the full migration is also safe.
6. Allow index propagation, then verify the newest event and AutoVision job ID
   appear in the dashboard, camera preview and paired TV. Dead-letter replay is
   separate: this migration never consumes, deletes or replays queued messages.

New stacks default to IncidentIndexStage=complete and create both indexes with
the table. New DynamoDB Local tables include them too. Pre-existing local tables
need the same index upgrade before running the updated application.
