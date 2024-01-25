# dev-infra

Helpers for working with postgres and redis locally. Previously known as `pg`.

## Usage

### `with-test-db.sh`

This script allows you to run any command with a fresh, ephemeral/single-use postgres database available. When the script starts a Dockerized postgres container starts-up, and when the script completes that container is removed.

The environment variable `DB_POSTGRES_URL` will be set with a connection string that can be used to connect to the database. The [`PG*` environment variables](https://www.postgresql.org/docs/current/libpq-envars.html) that are recognized by libpq (i.e. used by the `psql` client) are also set.

**Example**

```
$ ./with-test-db.sh psql -c 'select 1;'
[+] Running 1/1
 ⠿ Container pg-db_test-1  Healthy                                                           1.8s

 ?column?
----------
        1
(1 row)


[+] Running 1/1
 ⠿ Container pg-db_test-1  Stopped                                                           0.1s
Going to remove pg-db_test-1
[+] Running 1/0
 ⠿ Container pg-db_test-1  Removed
```

### `with-redis-and-test-db.sh`

This script is similar to `with-test-db.sh`, but in addition to an ephemeral/single-use postgres database it also provides a single-use redis instance. When the script starts, Dockerized postgres and redis containers start-up, and when the script completes the containers are removed.

The environment variables `DB_POSTGRES_URL` and `REDIS_HOST` will be set with a connection strings that can be used to connect to postgres and redis respectively.

### `docker-compose.yaml`

The Docker compose file can be used to run containerized versions of postgres either for single use (as is used by `with-test-db.sh`), or for longer-term use. These are setup as separate services named `db_test` and `db` respectively. In both cases the database is available on the host machine's `localhost` and credentials are:

- Username: pg
- Password: password

However, each service uses a different port, documented below, to avoid conflicts.

#### `db_test` service for single use

The single-use `db_test` service does not have any persistent storage. When the container is removed, data in the database disappears with it.

This service runs on port `5433`.

```
$ docker compose up db_test   # start container
$ docker compose stop db_test # stop container
$ docker compose rm db_test   # remove container
```

#### `db` service for persistent use

The `db` service has persistent storage on the host machine managed by Docker under a volume named `pg_atp_db`. When the container is removed, data in the database will remain on the host machine. In order to start fresh, you would need to remove the volume.

This service runs on port `5432`.

```
$ docker compose up db -d    # start container
$ docker compose stop db     # stop container
$ docker compose rm db       # remove container
$ docker volume rm pg_atp_db # remove volume
```

#### `redis_test` service for single use

The single-use `redis_test` service does not have any persistent storage. When the container is removed, the data in redis disappears with it.

This service runs on port `6380`.

#### `redis` service for persistent use

The `redis` service has persistent storage on the host machine managed by Docker under a volume named `atp_redis`. When the container is removed, the data in redis will remain on the host machine. In order to start fresh, you would need to remove the volume.

This service runs on port `6379`.
