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

### Notes

- Facet indices are **UTF-8 byte offsets**, not character offsets — non-ASCII text
  (emoji, accents) will misalign if you hand-roll facets instead of using `RichText`.
- Mentions initially carry the handle in `did`; passing `agent` to `detectFacets`
  resolves it to a real DID. `detectFacetsWithoutResolution()` skips this and
  produces invalid mention facets.
- A tag feature stores `catlife`, not `#catlife` (the `#` stays in `text`, inside
  the byte range).
