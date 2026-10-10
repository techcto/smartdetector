# Build-only SDK environment; VVD/device testing runs outside Docker.
FROM node:22.22.0-bookworm-slim AS node
FROM ubuntu:22.04 AS cli
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ENV DEBIAN_FRONTEND=noninteractive
COPY --from=node /usr/local/ /usr/local/
RUN apt-get update && apt-get install -y --no-install-recommends curl tar jq ca-certificates git python3 make g++ unzip zip xz-utils lz4 file && apt-get clean
ENV NONINTERACTIVE=true SKIP_VVD_INSTALL=true
RUN curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh -o /tmp/get_vvm.sh && SKIP_SDK_INSTALL=true bash /tmp/get_vvm.sh
ENV PATH="/root/vega/bin:${PATH}"
FROM cli AS builder
ARG VEGA_SDK_VERSION=0.24.12112
ENV VEGA_SDK_VERSION=${VEGA_SDK_VERSION}
RUN vega sdk install "$VEGA_SDK_VERSION"
COPY telemetry.json /root/vega/telemetry/config.json
RUN vega --version && node --version && npm --version
WORKDIR /workspace
ENTRYPOINT ["/bin/bash", "-lc"]
