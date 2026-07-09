# Posting with facets (clickable #tags, links, and @mentions)

Bluesky does **not** parse your post text. A post record stores `text` literally —
the clickable `#hashtags`, URLs, and `@mentions` come from a separate **`facets`**
array of byte-range annotations on the record.

That `facets` array is generated **client-side**. The facet detector
([`detectFacets`](../../packages/api/src/rich-text/detection.ts), wrapped by
[`RichText`](../../packages/api/src/rich-text/rich-text.ts)) lives in
`@atproto/api`; the PDS and AppView never generate facets for you and serve
whatever record they're given verbatim.

So a raw `createRecord` call that sends only `{ text, createdAt }` produces a post
whose tags and links render as **plain, unclickable text**. The official app looks
different only because it runs facet detection before writing the record — exactly
the step this example makes explicit.

## Run

```bash
npm install @atproto/api

# Use an App Password (Settings -> App Passwords), not your account password.
BSKY_HANDLE=you.bsky.social BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
  node index.mjs
```

Optional env overrides:

- `BSKY_SERVICE` — PDS/service URL (default `https://bsky.social`)
- `BSKY_TEXT` — custom post text (default includes a tag, a link, and a mention)

The script logs in, runs `RichText.detectFacets(agent)` (which also resolves
`@handle` → DID for mentions), prints the detected `facets`, then creates the post
**with** them and prints a `bsky.app` link to the result.

## The one line that matters

```js
const rt = new RichText({ text })
await rt.detectFacets(agent)          // build facets client-side (+ resolve mentions)
await agent.post({ text: rt.text, facets: rt.facets, createdAt: new Date().toISOString() })
//                                   ^^^^^^^^^^^^^^^ omit this and tags/links go plain
```

## Alternative: opt-in server-side detection (PDS change)

This fork also adds an **opt-in** PDS flag, `PDS_ENRICH_POST_FACETS`, that makes
the server auto-populate facets when an `app.bsky.feed.post` is created via
`com.atproto.repo.createRecord` **without** a `facets` field. This lets a client
that only sends `{ text, createdAt }` still get clickable tags/links/mentions.

- Implementation: [`packages/pds/src/api/com/atproto/repo/detect-facets.ts`](../../packages/pds/src/api/com/atproto/repo/detect-facets.ts),
  wired into [`createRecord.ts`](../../packages/pds/src/api/com/atproto/repo/createRecord.ts).
- Off by default. It **mutates user records on write** and diverges from
  atproto's design (facets are normally a client responsibility), so client-side
  detection remains the recommended approach.
- Scope: `createRecord` only (not `applyWrites` / `putRecord`). Mentions that
  don't resolve to a DID are dropped rather than written invalid.

### Notes

- Facet indices are **UTF-8 byte offsets**, not character offsets — non-ASCII text
  (emoji, accents) will misalign if you hand-roll facets instead of using `RichText`.
- Mentions initially carry the handle in `did`; passing `agent` to `detectFacets`
  resolves it to a real DID. `detectFacetsWithoutResolution()` skips this and
  produces invalid mention facets.
- A tag feature stores `catlife`, not `#catlife` (the `#` stays in `text`, inside
  the byte range).
