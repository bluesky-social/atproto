# @atproto/dev-infra — Test infra (Redis + Postgres)

Docker-compose backed Redis + Postgres for running tests. Not a runtime dependency; only used during `make test`.

## Files

- `docker-compose.yaml` — `db_test` (Postgres 5433) + `redis_test` (6380)
- `with-test-db.sh` — starts Postgres, runs the wrapped command, tears down
- `with-test-redis-and-db.sh` — starts both, runs, tears down
- `_common.sh` — shared startup/teardown logic

## Usage

```sh
./packages/dev-infra/with-test-redis-and-db.sh pnpm test
./packages/dev-infra/with-test-db.sh psql postgresql://pg:password@localhost:5433/postgres -c 'select 1;'
```

`make test` already wraps everything with this. You only run the scripts directly when iterating on a single package's tests.
