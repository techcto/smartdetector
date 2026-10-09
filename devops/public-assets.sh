#!/usr/bin/env bash
set -euo pipefail
: "${ASSETS_BUCKET:?Set the deployment assets bucket}"
# Publishing must not change bucket ownership, public access settings or policy.
# Provision/import those resources through a reviewed CloudFormation change set.
url="https://${ASSETS_BUCKET}.s3.${AWS_REGION:-us-east-1}.amazonaws.com/cloudformation/smartdetector.yaml"
if ! curl --fail --silent --show-error --head "$url" >/dev/null; then
  echo 'CloudFormation assets are not publicly readable. Review the CloudFormation-managed bucket policy; no policy changes were attempted.' >&2
  exit 1
fi

