---
name: update-chat-lexicons
description: >
  Sync `chat.bsky.*` Lexicon JSON from the private `bluesky-social/chat` repo
  into this monorepo, regenerate the code derived from it, and add a changeset.
  Use whenever asked to update, sync, pull, refresh, or copy chat lexicons, to
  pick up new or changed chat convo, group, moderation, or notification
  definitions, or to reconcile `lexicons/chat/` with the chat service —
  including when the request is just "update chat lexicons".
disable-model-invocation: false
---

# Update chat lexicons

`lexicons/chat/bsky/**` is a mirror. The source of truth is the separate
`bluesky-social/chat` repo, so an update is a copy _plus_ codegen _plus_ a
changeset — the copy on its own leaves the generated clients stale.

## 1. Refresh the source checkout

This assumes a sibling clone at `../chat`. Update it first: step 2 copies with
`--delete`, so syncing from a checkout that is behind will delete lexicons that
still exist upstream.

```bash
git -C ../chat pull --ff-only
```

If `../chat` doesn't exist, `bluesky-social/chat` is private and not
web-fetchable — clone it with `gh repo clone bluesky-social/chat ../chat`, or
ask the user where their checkout lives and substitute that path below. Don't
improvise a source from the destination; there would be nothing to sync.

## 2. Copy

```bash
rsync -a --delete ../chat/lexicons/chat/ ./lexicons/chat/
```

Only `lexicons/chat/` is mirrored. The chat repo also carries `app/`, `com/`,
and `tools/` lexicons that diverge from this repo's — never sync those.

Check `git status` immediately. Unexpected deletions almost always mean the
source checkout is behind, not that definitions were dropped upstream.

## 3. Regenerate

```bash
pnpm codegen
```

Run this from the repo root, and use `pnpm codegen` rather than `pnpm build`:
`packages/api` and `packages/ozone` regenerate only when a lexicon file is
_newer_ than their generated index, and `rsync -a` preserves the source's
mtimes — so a build can decide nothing changed and silently keep stale types.
`pnpm codegen` invokes the generators unconditionally, building the codegen
tooling itself first.

Both generated trees are gitignored, so the commit diff shows only JSON. The
real blast radius stays invisible until you build.

## 4. Changeset

Add a file under `.changeset/` with a three-word kebab-case name:

```markdown
---
'@atproto/api': patch
---

update chat lexicons
```

A patch on `@atproto/api` alone is the established convention here (see
`git log --oneline -- lexicons/chat`). `@atproto/ozone` also generates from
these lexicons but picks up an automatic dependency bump, so don't list it by
hand. Use `minor` instead if the sync removes or renames a definition — that
breaks the published types.

## 5. Verify

```bash
(cd packages/api && pnpm build && pnpm test)
(cd packages/ozone && pnpm build)
```

Ozone's build typechecks its route handlers against the regenerated server
types, which is where a removed or narrowed chat definition actually surfaces.

Then review the diff and commit. Before opening a PR, run the full checks from
the root: `pnpm build --force && pnpm verify`.
