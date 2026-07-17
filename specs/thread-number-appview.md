# OP thread numbering: AppView integration

## TL;DR

Copy Tango's additive `GetThreadResponse.op_thread` protobuf contract into the
AppView dataplane proto and regenerate the TypeScript client. Carry that
metadata through the private `getPostThreadV2` skeleton, then join it onto the
already-built V2 thread items by URI. Tango supplies the full canonical count
and each returned post's canonical index; AppView must not recompute either
from its truncated/rendered tree.

Files expected to change:

- `packages/bsky/proto/bsky.proto`: mirror Tango's `OpThreadInfo`,
  `OpThreadPost`, and `GetThreadResponse.op_thread` definitions.
- `packages/bsky/src/proto/bsky_pb.ts` and
  `packages/bsky/src/proto/bsky_connect.ts`: regenerate with
  `pnpm --filter @atproto/bsky codegen:buf`.
- `packages/bsky/src/api/app/bsky/unspecced/getPostThreadV2.ts`: retain
  `opThread` in the internal skeleton alongside `anchor` and `uris`.
- `packages/bsky/src/views/index.ts`: treat supplied metadata as authoritative
  canonical membership and add `opThreadPostIndex` / `opThreadPostCount` to
  matching `threadItemPost` values.
- `packages/bsky/src/data-plane/server/routes/threads.ts`: make the local
  SQLite dataplane return the same canonical metadata as Tango.
- `packages/bsky/tests/views/thread-v2.test.ts`: update fork membership
  expectations and cover numbering, truncation, arbitrary anchors, and
  unchanged response structure.

The public lexicon fields already exist in
`lexicons/app/bsky/unspecced/defs.json`. Regenerate lexicon-derived artifacts
if the normal build/test workflow reports them stale.

## Scope

This work integrates the Tango contract into
`app.bsky.unspecced.getPostThreadV2`. It does not change thread fetching,
hydration, sorting, trimming, moderation, threadgate behavior, or the public
top-level response schema.

The only public response changes are:

- canonical corrections to the existing `threadItemPost.opThread` value; and
- the two already-defined optional fields on canonical OP-thread posts:
  `opThreadPostIndex` and `opThreadPostCount`.

No Tango metadata object is exposed directly in the public XRPC response.

## Tango contract to mirror

Copy the following definitions from Tango into
`packages/bsky/proto/bsky.proto`, preserving field numbers:

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

Tango's semantics are:

- `post_count` is the size of the complete canonical OP chain, even when the
  normal thread fetch is truncated.
- `posts` contains canonical-chain posts that also appear in `uris`.
- `index` is 1-based within the complete canonical chain. It is not renumbered
  after intersecting with `uris`.
- `op_thread` is omitted when no multi-post canonical chain exists, no
  canonical post appears in `uris`, or Tango could not safely produce
  metadata.

Run the package's standard protobuf generation command after editing the
source proto:

```sh
CI=true pnpm --filter @atproto/bsky codegen:buf
```

Commit the generated TypeScript changes with the source proto.

## Skeleton and hydration

Extend the private skeleton type in `getPostThreadV2.ts`:

```ts
type Skeleton = {
  anchor: AtUriString
  uris: AtUriString[]
  opThread?: {
    postCount: number
    posts: Array<{ uri: AtUriString; index: number }>
  }
}
```

The exact type may be derived from the generated protobuf instead of repeated,
but the skeleton should contain only the fields the view consumes.

When the dataplane call succeeds, copy `res.opThread` into the skeleton and
cast/validate URI strings at the existing TypeScript boundary. When the
dataplane returns no metadata, leave `skeleton.opThread` absent. The existing
not-found skeleton remains `{anchor, uris: []}` with no metadata.

Hydration remains exactly as it is today:

```ts
skeleton.uris.map((uri) => ({ uri }))
```

Do not add `opThread.posts` to the hydration request. Tango already guarantees
that every metadata entry is also in `uris`; fetching the complete canonical
chain would defeat the response-depth and branching limits.

## View integration

Keep the existing tree construction, moderation, sorting, trimming, and
flattening flow. After `sortTrimFlattenThreadTree` produces the returned
`thread` array, annotate its post items from Tango metadata before returning
from `threadV2`.

Build a URI-keyed lookup once:

```ts
const opThreadPostsByUri = new Map(
  skeleton.opThread?.posts.map((post) => [post.uri, post]),
)
```

When `skeleton.opThread` is present, it is authoritative. For every returned
`threadItemPost`:

- If its URI is in the map:
  - set `opThread` to `true`;
  - set `opThreadPostIndex` to the entry's `index`; and
  - set `opThreadPostCount` to `skeleton.opThread.postCount`.
- If its URI is absent from the map:
  - set `opThread` to `false`; and
  - leave both optional numbering fields absent.

This authoritative negative case is essential. An OP-authored fork can be in
the normal response while being absent from the canonical chain.

When `skeleton.opThread` is absent, preserve today's `opThread` heuristic and
do not add numbering fields. This provides graceful degradation for a Tango
metadata error and preserves existing behavior during deployment/backfill.

Only values of type `threadItemPost` are annotated. Blocked, not-found,
no-unauthenticated, and other item variants retain their exact current shapes.
Use the existing generated lexicon type guard or an equivalent typed helper;
do not assume every thread item has a mutable post value.

Annotating after flattening is safe because OP membership and numbering do not
participate in sorting, trimming, branching-factor selection, or
`hasOtherReplies`. It also minimizes changes to the recursive parent/reply
builders and guarantees that only actually returned items are touched.

## Local dataplane behavior

The TypeScript/SQLite dataplane used by development and AppView tests must
match Tango's semantics; otherwise the integration suite will continue to test
the old anchor-relative heuristic.

In `packages/bsky/src/data-plane/server/routes/threads.ts`:

1. Keep the existing ancestor/descendant queries and `uris` ordering exactly
   unchanged.
2. Determine the actual root URI from the anchor post (`replyRoot ?? postUri`).
3. Query all posts in that root thread authored by the root URI's DID. Select
   only `uri` and `replyParent` needed to build adjacency. The root is implicit.
4. Build `replyParent -> child URIs`.
5. Starting at the root, repeatedly choose the smallest OP child URI and stop
   when none exists. URI comparison is valid here because all candidates have
   the same DID/collection and TID rkeys sort oldest-first lexicographically.
6. Intersect the complete chain with the existing `uris` result set while
   retaining each post's index in the complete chain.
7. Return `opThread` only when the chain contains more than one post and the
   intersection is non-empty, matching Tango.

The local query must be root-relative, not anchor-relative. It must see OP
sibling branches so that an anchor on a newer OP fork cannot redefine the
canonical chain.

Illustrative result construction:

```ts
const resultUris = new Set(uris)
const posts = canonicalChain.flatMap((uri, offset) =>
  resultUris.has(uri) ? [{ uri, index: offset + 1 }] : [],
)

return {
  uris,
  opThread:
    canonicalChain.length > 1 && posts.length > 0
      ? { postCount: canonicalChain.length, posts }
      : undefined,
}
```

This object is an internal dataplane response; it is not returned directly by
the XRPC handler.

## Public response invariants

The implementation must preserve all of the following:

- The top-level response remains exactly `{thread, threadgate,
hasOtherReplies}`.
- Thread item ordering and array length do not change.
- Existing `uri`, `depth`, `post`, `moreParents`, `moreReplies`, moderation,
  threadgate, mute, and other-item fields do not change.
- Hydration inputs do not change.
- `threadgate` lookup and construction do not change.
- `hasOtherReplies` does not change.
- Optional numbering fields are serialized only on canonical
  `threadItemPost` values.
- Noncanonical posts never receive an index or count.
- The count comes from Tango/local canonical metadata, never from the number
  of rendered or hydrated posts.

The existing `opThread` boolean can intentionally change for OP-authored forks
that the old anchor-relative/branching heuristic misclassified. This is a
correctness fix, not a response-shape change.

## Test plan

Extend `packages/bsky/tests/views/thread-v2.test.ts` using the existing
`seedThreadV2.annotateOP` fixture.

Required cases:

1. **Linear canonical chain:** returned canonical posts have indices `1..N`
   and all carry the same count `N`.
2. **Oldest-child fork rule:** when root has multiple OP children, only the
   smallest/oldest child continues the canonical chain. Other OP children have
   `opThread: false` and no numbering fields.
3. **Arbitrary anchor:** opening at an OP fork yields the same canonical
   membership as opening at root. The fork does not become canonical merely
   because it is the anchor.
4. **Non-OP anchor:** canonical ancestors present in the response retain their
   original full-chain indices; the non-OP anchor has no numbering fields.
5. **Depth truncation:** a shallow `below` response still reports the complete
   `opThreadPostCount`, and visible posts keep their full-chain indices.
6. **Branch trimming:** trimming a canonical descendant from the rendered tree
   does not reduce or renumber the count.
7. **Metadata absent:** a single-post thread preserves existing `opThread`
   behavior but has neither optional numbering field.
8. **Item variants:** blocked/not-found/no-unauthenticated/other items do not
   acquire OP numbering properties.
9. **Response regression:** assert the same top-level keys, thread length,
   ordering, depths, and existing fields as before, allowing only the two new
   optional properties and intended canonical corrections to `opThread`.

Update the existing `annotate OP thread` table: the canonical expected set is
root plus the oldest OP-child chain. Remove newer OP forks such as `2` from
expected membership at every anchor where the old heuristic previously marked
them true.

Run at minimum:

```sh
pnpm --filter @atproto/bsky test -- tests/views/thread-v2.test.ts
pnpm --filter @atproto/bsky build
```

Also run protobuf/lexicon generation checks required by the package before
handoff.

## Rollout compatibility

The protobuf change is additive and compatible with Tango instances that do
not yet return `op_thread`. The absent-metadata fallback preserves current
AppView behavior during a mixed deployment.

Deploy in this order:

1. Tango schema, dual writes, cache, and backfill implementation.
2. AppView protobuf/client support and absent-field fallback.
3. Tango instances returning canonical metadata, with historical backfill run
   per PoP.
4. AppView behavior verification using arbitrary anchors and truncated
   responses.
