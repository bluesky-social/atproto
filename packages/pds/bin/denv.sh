#!/usr/bin/env sh

set -e

# corepack depends on the bind-mounted volume, so it needs to happen in run-time, not on build-time.
corepack prepare --activate
pnpm --dir packages/pds denv
