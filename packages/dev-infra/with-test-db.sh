#!/usr/bin/env sh

# Example usage:
# ./with-test-db.sh psql postgresql://pg:password@localhost:5433/postgres -c 'select 1;'

dir=$(dirname $0)
node ${dir}/src/workspace-cli.js with-test-db "$@"
