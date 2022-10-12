#!/usr/bin/env sh
# @TODO handle sigint for cleanup

# Example usage:
# ./with-test-db.sh psql postgresql://pg:password@localhost:5433/postgres -c 'select 1;'

dir=$(dirname $0)
compose_file="$dir/docker-compose.yaml"

docker compose -f $compose_file up --wait db_test
echo # newline

# Based on creds in compose.yaml
export DB_POSTGRES_URL="postgresql://pg:password@localhost:5433/postgres"
"$@"
code=$?

echo # newline
docker compose -f $compose_file rm -f --stop db_test

exit $code
