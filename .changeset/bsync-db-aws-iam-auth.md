---
'@atproto/bsync': patch
---

Add `BSYNC_DB_POSTGRES_AWS_IAM_AUTH`: when set, bsync authenticates to Postgres with a fresh AWS RDS IAM auth token for every new connection, over TLS verified against the bundled Amazon RDS global CA bundle. The token is signed for the region in `AWS_REGION`, or else the region in the `*.rds.amazonaws.com` hostname, with credentials from the AWS default provider chain. `BSYNC_DB_POSTGRES_URL` must then name the user and host, with no password and no parameters other than `sslmode=verify-full`.
