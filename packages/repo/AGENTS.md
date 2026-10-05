# packages/repo

## MST traversals MUST call `markVisited`

Every code path that can visit more than one child of an MST node — full-tree
walks, diffs, block collection; recursive or iterative; in `src/mst/mst.ts`,
`walker.ts`, `diff.ts`, or new code anywhere — **MUST**:

1. create a fresh `CidSet` per traversal (never share one between traversals),
   and
2. call `node.markVisited(seen)` on every `MST` node it enters, before reading
   that node's entries (`getEntries`, `atIndex`, …).

This is a requirement, not an optimization: a traversal that skips it is a bug
even if every test passes. When adding a traversal, add a matching case to
`tests/mst-dag.test.ts`.

Exempt: lookups that follow a single path (one recursive call per level, e.g.
`cidsForPath`, `proofForKey`), which are bounded by tree depth, and walks over
in-memory nodes built by local mutations (outdated pointers, e.g. `serialize`),
since nodes loaded from storage never have one.

`MST.markVisited` throws `VisitedCidError` on a repeated node and skips nodes
with an outdated pointer (not yet serialized).
