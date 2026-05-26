# @atproto/repo — User repo + Merkle Search Tree

Implements the atproto user repository: an authenticated append-only log of records keyed by collection + rkey, stored as a Merkle Search Tree (MST) over CBOR-encoded blocks. Every user's data on the PDS lives in one of these.

## What's here

- `MST` — the search tree structure
- Commit signing/verification (via `@atproto/crypto`)
- CAR file import/export (the wire format for repo sync)
- Storage abstractions (`RepoStorage` interface; PDS implements one over SQLite)

## When to touch

- Changing the commit format → coordinate with upstream, this affects federation
- Adding a new record-level helper → fine, add a test
- Performance work on the MST → the canonical place

## See also

- `packages/sync/` — the firehose subscriber that consumes these commits
- `.claude/docs/atproto/federation-and-firehose.md`
