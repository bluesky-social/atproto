#!/usr/bin/env sh

# Example usage:
# ./with-test-db.sh psql postgresql://pg:password@localhost:5433/postgres -c 'select 1;'

dir=$(dirname $0)
compose_file="$dir/docker-compose.yaml"

# whether this particular script started the container or if it was running beforehand
started_container=false

trap on_sigint INT
on_sigint() {
  echo # newline
  if $started_container; then
    docker compose -f $compose_file rm -f --stop --volumes redis_test db_test
  fi
  exit $?
}

# check if the container is already running
pg_container_id=$(docker compose -f $compose_file ps --format json --status running | jq -r '.[]? | select(.Service == "db_test") | .ID')
redis_container_id=$(docker compose -f $compose_file ps --format json --status running | jq -r '.[]? | select(.Service == "redis_test") | .ID')
echo $pg_container_id
echo $redis_container_id
if [ -z $pg_container_id ] || [ -z $redis_container_id ]; then
  docker compose -f $compose_file up --wait --force-recreate redis_test db_test
  started_container=true
  echo # newline
else
  echo "redis_test and db_test already running"
fi

# Based on creds in compose.yaml
export PGPORT=5433
export PGHOST=localhost
export PGUSER=pg
export PGPASSWORD=password
export PGDATABASE=postgres
export DB_POSTGRES_URL="postgresql://pg:password@127.0.0.1:5433/postgres"
export REDIS_HOST="127.0.0.1:6380"
"$@"
code=$?

echo # newline
if $started_container; then
  docker compose -f $compose_file rm -f --stop --volumes redis_test db_test
fi

exit $code