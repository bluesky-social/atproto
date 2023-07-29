#!/usr/bin/env sh

# Example usage:
# ./with-test-db.sh psql postgresql://pg:password@localhost:5433/postgres -c 'select 1;'

dir=$(dirname $0)
source ${dir}/_common.sh

SERVICES="db_test" main "$@"
