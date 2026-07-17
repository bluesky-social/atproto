# OP thread numbering v2 (`getPostThreadV2`)

## TL;DR

Store OP-authored reply edges in a new Scylla table keyed by thread root. On
`GetThread`, Tango reads that small root partition once, derives the canonical
OP chain, and returns the full count plus `{uri, index}` metadata for chain
posts already present in the normal thread response. The appview uses this
metadata as the authority for `opThread`, `opThreadPostIndex`, and
`opThreadPostCount`.

Files expected to change:

- Tango `atlantis/bsky/server/models/setup.go`: define the
  `op_thread_replies` table.
- Tango `atlantis/bsky/server/models/threads.go`: dual-write/delete OP reply
  edges and add the single-partition chain query.
- Tango `atlantis/bsky/server/posts.go`: provide the information needed by the
  dual-write/delete path, if it cannot remain encapsulated in the model.
- Tango `atlantis/bsky/bsky.proto`: add `OpThreadInfo`, `OpThreadPost`, and the
  optional `op_thread` response field; regenerate Tango protobuf code.
- Tango `atlantis/bsky/server/threads.go`: fetch the OP chain in parallel,
  intersect it with returned thread URIs, and populate the response metadata.
- Tango `atlantis/bsky/server/threads_test.go` and model/backfill tests: cover
  truncation, forks, arbitrary anchors, ordering, deletion, and races.
- Tango: add a resumable, token-range backfill command for existing
  `thread_posts` rows.
- Appview `packages/bsky/proto/bsky.proto`: mirror the RPC additions and
  regenerate `packages/bsky/src/proto`.
- Appview
  `packages/bsky/src/api/app/bsky/unspecced/getPostThreadV2.ts`: carry OP
  metadata through the skeleton.
- Appview `packages/bsky/src/views/index.ts`: use Tango metadata as the
  authoritative OP-chain membership and stamp the two numbering fields.
- Appview `packages/bsky/src/data-plane/server/routes/threads.ts`: implement
  equivalent metadata in the dev/test dataplane.
- Appview tests around `getPostThreadV2`/thread views: cover the same canonical
  membership cases.

The lexicon fields already exist in
`lexicons/app/bsky/unspecced/defs.json`; no contract change is needed there.

## Goal

For `app.bsky.unspecced.getPostThreadV2`, number posts in the canonical OP
thread so clients can display badges such as `3/10`.

The result must be:

- canonical and independent of the requested anchor;
- correct when the OP replies to one post more than once;
- complete even when the normal thread response is depth- or branch-truncated;
- inexpensive for threads with a very large number of non-OP replies; and
- authoritative for both OP-thread membership and numbering.

## Canonical OP thread

The OP is the author of the thread root: `uriToDid(rootUri)`.

The canonical OP thread is a single linear chain:

1. Start at the root.
2. Among the current post's children authored by the OP, choose the child with
   the smallest URI. For one author, URI ordering is rkey/TID ordering, so this
   selects the oldest reply.
3. Repeat until there is no OP-authored child.

For example:

```text
root(op) ─┬─ 0(op) ── 0.0(op)       canonical: root → 0 → 0.0
          └─ 2(op) ── 2.0(bob)      2 is an OP fork
```

Opening the thread at `2` must not cause `2` to be marked or numbered as part
of the OP thread. This is why the computation must start at the root rather
than at the requested anchor.

## Storage design

Add a denormalized table containing only OP-authored reply edges:

```sql
CREATE TABLE IF NOT EXISTS op_thread_replies (
    root_uri TEXT,
    parent_uri TEXT,
    uri TEXT,
    present BOOLEAN,
    PRIMARY KEY ((root_uri), parent_uri, uri)
);
```

The root itself is implicit and is not stored in this table. `present` is a
non-key marker used to preserve write timestamps during backfill; reads should
only encounter live rows.

When a reply is created, write a row when:

```text
uriToDid(uri) == uriToDid(root_uri)
```

When such a reply is deleted, delete the corresponding row. Both operations
are idempotent. This is normal Scylla denormalization: `thread_posts` remains
the general reply graph, while `op_thread_replies` serves the root-relative OP
chain access pattern.

The partition is unbounded, but contains only replies authored by the root
author. Its size therefore depends on the OP's own activity rather than the
number of replies on a viral thread. This is materially safer than bulk-reading
the entire `thread_posts` root partition.

## Tango read path

Alongside the existing ancestor and descendant queries, issue one query rooted
at the actual thread root:

```sql
SELECT parent_uri, uri
FROM op_thread_replies
WHERE root_uri = ?;
```

Build a `parent_uri -> []uri` adjacency map in memory. Starting with the root,
choose the smallest child URI at every level and produce the canonical URI
list. The root is index 1 and the list length is the full count.

This query is independent of `above`, `below`, branching factor, and anchor.
It should run in parallel with `GetThreadAncestors` and
`GetThreadDescendants`. Scylla may page a large partition internally, but the
read does not perform one dependent network round trip per chain level.

The attempt-4 logic currently retained in Tango, which extends the
anchor-rooted descendants BFS beyond `maxdepth`, should be removed. It is not
needed once canonical chain metadata has its own root-relative query.

## RPC contract

Extend the response without changing the meaning of `uris`:

```proto
message GetThreadResponse {
  repeated string uris = 1;
  OpThreadInfo op_thread = 2;
}

message OpThreadInfo {
  int32 post_count = 1;
  repeated OpThreadPost posts = 2;
}

message OpThreadPost {
  string uri = 1;
  int32 index = 2;
}
```

`post_count` is the length of the complete canonical chain, including the
root. `posts` contains only canonical-chain posts whose URIs are also present
in the response's normal `uris` list. This bounds the metadata response while
still giving the appview everything it can render or classify.

Example for a ten-post chain when only its first two posts are in the normal
response:

```json
{
  "uris": ["at://.../root", "at://.../reply1", "at://.../fork"],
  "opThread": {
    "postCount": 10,
    "posts": [
      { "uri": "at://.../root", "index": 1 },
      { "uri": "at://.../reply1", "index": 2 }
    ]
  }
}
```

The fork is in `uris` but absent from `op_thread.posts`, so it is
authoritatively not part of the OP thread.

An absent `op_thread` message means that canonical metadata was not supplied,
which supports a staged rollout. A present message is authoritative even if
`posts` is empty. A healthy thread response will normally contain at least one
entry because the root or anchor is commonly present, but consumers must not
use emptiness as a fallback signal.

## Appview behavior

Carry `op_thread` from the dataplane response into the `getPostThreadV2`
skeleton. Convert `posts` to a URI-keyed map before building the view.

When `op_thread` is present:

- a post has `opThread: true` exactly when its URI is in the map;
- its `opThreadPostIndex` is the entry's `index`;
- its `opThreadPostCount` is `op_thread.post_count`; and
- a post absent from the map has `opThread: false`, even if the old
  author/contiguous-parent heuristic would have marked it true.

This metadata must be applied while constructing thread items, before sorting,
trimming, and flattening. Deriving the count from the flattened response is
incorrect because that response may be truncated.

During a staged deployment, the appview may retain its existing heuristic only
when `op_thread` is absent. Once all Tango instances and backfills are live,
remove that fallback so there is a single definition of membership.

The local TypeScript dataplane must return the same shape. It may compute the
canonical chain with a SQLite query over all OP-authored rows for the root;
production performance constraints do not require reproducing the Scylla
schema locally, but behavior must match.

## Backfill

Deploy the table and live dual writes before starting the backfill. Scan
`thread_posts` by Scylla token range, following the existing Tango token-range
scanner patterns:

```sql
SELECT root_uri, parent_uri, uri, writetime(parent_uri)
FROM thread_posts
WHERE token(root_uri) > ? AND token(root_uri) <= ?
BYPASS CACHE;
```

For each row, skip roots and non-OP replies. Eligible rows satisfy:

```text
parent_uri != "" && uriToDid(uri) == uriToDid(root_uri)
```

Insert eligible rows using the original source write timestamp:

```sql
INSERT INTO op_thread_replies
    (root_uri, parent_uri, uri, present)
VALUES (?, ?, ?, true)
USING TIMESTAMP ?;
```

Copying the timestamp prevents a delete race. If a live delete occurs after
the scanner reads a source row but before its destination insert, the newer
destination tombstone wins over the older backfill write and the deleted edge
is not resurrected.

The backfill should have:

- configurable token ranges, worker count, and rate limits;
- bounded write concurrency and prepared/idempotent statements;
- persistent completed-range checkpoints so it can resume;
- counters for scanned, eligible, written, skipped, retried, and failed rows;
- cancellation and graceful shutdown; and
- a low-rate reconciliation pass after the primary scan.

Run it independently in every production PoP. Before enabling reads, compare
random root partitions against `thread_posts`, deriving the chain from both
sources and asserting identical URI lists.

## Consistency and failure behavior

Creation currently writes multiple denormalized representations without a
cross-table transaction. The new write should follow the same retry and
idempotency conventions. A transient failure must be observable and retried;
the reconciliation job repairs missed writes.

Do not silently return anchor-relative metadata when the new root query fails.
The handler should either fail the request consistently with its other thread
queries or omit `op_thread` during an explicitly supported migration phase.
It must never return a present but knowingly partial `op_thread` message,
because the appview treats presence as authoritative.

## Required tests

At minimum, cover:

1. A linear OP chain returns indices `1..N` and count `N`.
2. Numbering remains complete when `below` truncates normal descendants.
3. Of two OP children, the smallest URI continues the canonical chain.
4. An OP-authored fork is absent from metadata.
5. Anchoring on that fork yields the same canonical membership as anchoring on
   the root.
6. An anchor authored by somebody else does not change canonical results.
7. Non-OP replies, including very large sibling sets, do not enter the new
   table or chain.
8. Deleted OP replies disappear; define and verify the resulting chain after a
   deletion (the walk stops if the deleted node was the selected child).
9. Out-of-order insertion still selects the smallest URI.
10. Backfill retries are idempotent and an older timestamp cannot resurrect a
    row deleted during the scan.
11. The appview marks membership from RPC metadata rather than its old
    contiguous-author heuristic.
12. Appview sorting/trimming does not alter indices or the full count.

## Rollout

1. Create the table in every PoP.
2. Deploy live create/delete dual writes with metrics; leave reads disabled.
3. Run and validate the backfill, followed by reconciliation.
4. Deploy the additive protobuf fields to Tango and appview.
5. Enable Tango's root-relative query and return `op_thread` metadata.
6. Enable appview consumption and monitor missing/invalid metadata.
7. Remove the retained descendants-BFS extension and, after the migration
   window, remove the appview membership fallback.

