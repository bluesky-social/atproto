# @atproto/sync — Firehose subscriber + repo sync

The library every indexer uses to consume `com.atproto.sync.subscribeRepos` (the firehose). Reconnects, parses CAR frames, exposes commits/handles/identities/account events.

Used by:
- `services/dataplane/` — to index the AppView
- `services/bsync/` — for some cross-cutting state
- `packages/ozone/src/jetstream/` — moderator's view of activity

## Key types

- `Firehose` — the high-level consumer
- `MemoryRunner` / `DiskRunner` — durable cursor strategies
- Frame parsers for each event kind

## See also

- `.claude/docs/atproto/federation-and-firehose.md`
