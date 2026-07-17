# OP thread numbering (`getPostThreadV2`)

Status: **blocked / parked.** The lexicon fields are defined; the
implementation is not. This document records what we want, everything we
tried, and the unresolved correctness problem that stopped us.

## Goal

For `app.bsky.unspecced.getPostThreadV2`, number the posts in the "OP thread" —
the contiguous chain of self-replies by the original poster starting at the
thread root — so the client can render a badge like `3/10` on each post.

Two fields were added to `app.bsky.unspecced.defs#threadItemPost`
(these lexicon changes are **kept**; everything else was reverted):

- `opThreadPostIndex` (integer, optional): 1-indexed position of this post
  within the OP thread.
- `opThreadPostCount` (integer, optional): total number of posts in the OP
  thread this post belongs to.

Both are present only on posts where `opThread` is true.

## Definitions

"OP" = the author of the thread **root** post (`uriToDid(rootUri)`).

The **OP thread** is a single linear chain, defined from the root:

- Start at root.
- At each step, follow the OP-authored reply with the smallest URI
  (oldest TID rkey — the oldest reply).
- Stop when the current post has no OP-authored reply.

The oldest-child tiebreak is what makes it a single deterministic chain rather
than a branching set. This matters when OP replies to their own post more than
once.

### Worked example

```
root(op) ─┬─ 0(op) ─── 0.0(op) ─── 0.0.0(op)      the OP thread: root→0→0.0→0.0.0
          ├─ 1(alice) ─ 1.0(alice)                 not OP
          └─ 2(op) ──── 2.0(bob) ── 2.0.0(op)      2 is an OP fork, NOT on the thread
```

Root has **two** OP children, `0` and `2`. `0` is older, so the canonical OP
thread is `root → 0 → 0.0 → 0.0.0` (count 4, indices 1–4). Post `2` is a
*fork*: it is by OP and replies to root, but it is not the oldest OP reply, so
it is **not** on the OP thread. `2.0.0` is by OP but its parent `2.0` is by bob,
so the chain is already broken above it.

This distinction — `0` is on the thread, `2` is not — is the crux of the whole
problem, because telling them apart requires seeing that root has *both* `0`
and `2` as children and comparing them.

## Requirements that shaped the design

1. **Full count under truncation.** The count must reflect the whole OP thread
   even when the response is truncated by the reply-depth limit (`below`) or
   branching factor. "If the response stops at 5 replies deep, I still want to
   see `5/10`." → the numbers cannot be derived only from what is rendered.

2. **Membership is authoritative in the appview.** Whether a post is part of
   the OP thread (`opThread`) is already computed in the appview
   (`packages/bsky/src/views/index.ts`). Numbering must agree with it.

## Where the data lives

- **Lexicon / contract:** `lexicons/app/bsky/unspecced/defs.json`
  (`threadItemPost`).
- **Appview handler:** `packages/bsky/src/api/app/bsky/unspecced/getPostThreadV2.ts`.
- **Appview view / tree building + `opThread` flag:**
  `packages/bsky/src/views/index.ts` (`threadV2`, `threadV2Parent`,
  `threadV2Replies`) and `packages/bsky/src/views/threads-v2.ts`
  (sort/trim/flatten).
- **Dataplane (dev/test stub):**
  `packages/bsky/src/data-plane/server/routes/threads.ts` +
  `packages/bsky/src/data-plane/server/util.ts` (kysely over sqlite).
- **Dataplane (production):** the Go service in the `tango` repo —
  `atlantis/bsky/server/threads.go` (`GetThread` handler) and
  `atlantis/bsky/server/models/threads.go`
  (`GetThreadAncestors`, `GetThreadDescendants`, `getThreadChildren`).
  Storage is Cassandra/Scylla: `thread_posts` keyed by `((root_uri), uri)`
  with `parent_uri`, plus a materialized view `thread_posts_by_parent` keyed
  by `((root_uri, parent_uri), uri)`. **No author column** — the author is the
  URI authority (`at://<did>/...`), so "is OP" is a string check on the URI.

The production `GetThread` RPC returns only `repeated string uris`. The appview
hydrates those URIs and builds the tree. Crucially, the RPC seeds its walk at
the **anchor** post (`req.Msg.PostUri`), not the root: ancestors walk *up* from
the anchor, descendants walk *down* from the anchor.

## Approaches tried

### Attempt 1 — count in the appview over the flattened response

Compute index/count in `threads-v2.ts` after the tree is flattened, over the
posts already marked `opThread`.

**Rejected:** violates requirement 1. The flattened tree has already been
truncated by `below` / `branchingFactor`, so the count reflects the response
window, not the true thread. A deep thread shows `5/5` instead of `5/10`.

### Attempt 2 — dedicated from-root OP-chain query in Go (`GetOpThreadChain`)

Add a third parallel query in the Go `GetThread` handler that walks the OP
chain from **root**, independent of the anchor and of `below`. Return the
numbering over the wire as a new proto field (`op_thread_posts`, with
`{uri, index, count}` per post).

Two sub-variants for the per-level query against `thread_posts_by_parent`:

- **2a — equality query + in-memory filter.** `WHERE root_uri = ? AND
  parent_uri = ?`, then filter children to OP-authored and pick the oldest in
  Go. Benchmarked clean at ~625–690µs/op even with 500 non-OP sibling replies.
- **2b — clustering-range slice** to push the OP-DID prefix into the query
  (`uri >= 'at://<did>/' AND uri < 'at://<did>0' ORDER BY uri ASC LIMIT 1`).
  **Broken:** reliably errored against Scylla's materialized view
  (`Tried to build a global schema for view thread_posts_by_parent with an
  uninitialized base info`). Reverse-ordered clustering slice on the MV trips
  an internal error. Disqualified.

**This approach was correct** (stable, anchor-independent, full count) and
2a passed all tests against real Scylla. It was **rejected for cost/complexity**:

- One serial Scylla query per chain level (a 10-post chain = 10 sequential
  round-trips; they can't be parallelized because each depends on the previous).
- It re-queries nodes that `GetThreadDescendants` already fetched.
- It adds a proto field and cross-repo coupling (count computed in Go, shipped
  to the appview).

### Attempt 3 — single bulk query in Go (`GetOpThreadChainV2`, not built)

Replace the per-level walk with one query: `SELECT uri, parent_uri FROM
thread_posts WHERE root_uri = ?` (whole thread, single partition read), build a
`parent → children` map in memory, walk the chain. One query, full count,
anchor-independent.

**Not built.** Superseded by attempt 4 before implementation. Recorded because
it is the cleanest "correct" option if we revisit: it reads the whole thread
partition (cost on viral threads) but is trivially root-relative and stable.

### Attempt 4 — extend the descendants BFS along the OP chain, count in the appview

The approach we actually built out in this repo (now reverted). Two parts:

**Go side (kept in `tango`, not reverted):** extend `GetThreadDescendants` so
that past `maxdepth` it keeps following *only* the OP self-reply chain
(oldest OP child at each step), so the full chain downward from the anchor lands
in the returned URI set even when other branches are truncated. Gated on the
anchor being on the chain (anchor DID == root DID). No proto field, no separate
query — the OP posts just ride along in `uris`.

**Appview side (reverted):** drop the proto field entirely and compute
index/count in memory in `threadV2`, from the reply graph the appview already
hydrated (ancestors + descendants). Walk from root following the oldest OP
child, assign 1-based index and total count, stamp onto `opThread` posts.

**Why it fails — the blocking problem.** The appview only has the **anchor's**
ancestors and descendants. Ancestors are the single parent chain from the
anchor up to root; descendants are the subtree below the anchor. Neither
includes the anchor's **siblings** or sibling subtrees. So when the thread is
anchored *off* the canonical OP chain, the appview cannot see the chain and
cannot even determine membership correctly:

```
root(op) ─┬─ 0(op) ─── 0.0(op) ─── 0.0.0(op)      canonical OP thread (oldest branch)
          └─ 2(op) ──── 2.0(bob) ── 2.0.0(op)
```

Anchor at `2`:

- ancestors of `2` = `[2, root]`
- descendants of `2` = `[2.0, 2.0.0]`
- **`0`, `0.0`, `0.0.0` are never fetched** — they are a sibling branch.

From this vantage point the appview sees only `root` and `2` as OP posts on a
contiguous line, and would conclude `root → 2` is a 2-post OP thread, numbering
`2` as `2/2`. But `2` is a **fork** — the canonical thread (from root, oldest
child) is `root → 0 → 0.0 → 0.0.0`, and `2` is not on it at all.

We cannot distinguish `0` from `2` without seeing that root has both as
children and that `0` is older. The anchor-scoped fetch structurally lacks that
information. The same problem exists in Go: seeded at anchor `2`, it also never
sees `0`, so it also can't know whether `2` is the oldest OP reply to root.

This is a **membership** error, not just a count discrepancy: the same post `2`
is "not on the OP thread" when the thread is opened at root, but "on it (2/2)"
when opened at `2`. Numbering becomes anchor-relative and can contradict the
canonical from-root definition.

## Where we're stuck

The fundamental tension:

- The **canonical OP thread is defined from root** and requires seeing each
  chain node's siblings (to apply the oldest-child rule).
- The efficient, low-coupling data we have (anchor-scoped ancestors +
  descendants, or the anchor-seeded Go BFS) **does not include siblings** off
  the anchor's own line.

So "count purely in the appview from ancestors + descendants" is
**structurally insufficient** for a stable, canonical count at arbitrary
anchors. It is correct only when the anchor is on the canonical chain (which
includes the common case: anchored at root).

### Open decision (unresolved)

1. **Correct-at-root, omit off-chain.** Keep the cheap anchor-based approach.
   It is fully correct when anchored on the canonical chain (root and the
   common case). When the anchor is off the chain, either number nothing
   ("a partial chain isn't a real OP thread") or accept anchor-relative
   numbers. Requires detecting the off-chain case.

2. **Restore a from-root walk in Go** (attempt 2 or 3). Canonical and stable at
   any anchor, at the cost of the separate from-root traversal/query we removed.

No decision was made; work is parked here.

## Current repo state

- **Kept:** the two lexicon fields in
  `lexicons/app/bsky/unspecced/defs.json` (`opThreadPostIndex`,
  `opThreadPostCount`) and the reworded `opThread` description.
- **Reverted:** all appview and dev-env dataplane code changes in this repo.
- **Left as-is:** the Go changes in the `tango` repo (attempt 4's descendants
  BFS extension, `TestGetThreadOpChainPastMaxDepth`,
  `TestGetThreadOpChainNonOpAnchor`), which build and pass against Scylla but
  are unused without the appview side.

### Note on the kept lexicon change

The lexicon fields are defined but **not populated** by any shipped code path.
Regenerating clients from these lexicons will surface the optional fields; they
will simply always be absent until an implementation is chosen. If that is
undesirable, revert the lexicon change too.
