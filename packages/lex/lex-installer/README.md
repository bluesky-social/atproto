# @atproto/lex-installer

- [Changelog](./CHANGELOG.md)
- [`@atproto/lex` documentation](https://github.com/bluesky-social/atproto/blob/main/packages/lex/lex/README.md)

Package manager for [Lexicon](https://atproto.com/specs/lexicon) documents. This is the engine behind the `lex install` command: it resolves Lexicons by [NSID](https://atproto.com/specs/nsid), writes them to a local directory, and tracks their versions (CIDs) in a `lexicons.json` manifest.

```typescript
import { install } from '@atproto/lex-installer'

await install({
  lexicons: './lexicons',
  manifest: './lexicons.json',
  add: ['app.bsky.feed.post'],
  save: true,
})
```

Most projects should use the `lex install` CLI from [`@atproto/lex`](https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex) rather than calling this package directly.

## Resolution sources

Each Lexicon is resolved from, in order of priority:

1. **An explicit `at://` URI** passed as an addition — fetched (and verified) from that repo.
2. **An explicit local file** passed as an addition — any value that is a `file://` URI or
   contains a slash (`./app.bsky.feed.post.json`, `file://../shared/my.json`) is read from disk
   (relative to the cwd); its NSID is taken from the document's `id`.
3. **The manifest's `resolvers`** — an ordered list of local override strategies consulted for
   every dependency NSID before the network. Currently only `directory` is supported:

   ```jsonc
   {
     "version": 1,
     "lexicons": ["com.example.foo"],
     "resolvers": [
       {
         "type": "directory",
         "path": "../../lexicons", // relative to this lexicons.json
         "include": ["com.example.*"], // optional NSID globs (default: all)
         "exclude": [], // optional NSID globs this resolver never answers for
       },
     ],
     "resolutions": {
       "com.example.foo": {
         "uri": "file://../../lexicons/com/example/foo.json",
         "cid": "...",
       },
     },
   }
   ```

   Resolvers are priority-ordered (first match wins) and are **not** reordered by manifest
   normalization. A `directory` resolver maps an NSID to `<path>/<a>/<b>/<c>.json`.

4. **The network** — the always-last fallback: NSID → DNS `_lexicon.<authority>` → DID → signed
   `com.atproto.lexicon.schema` record.

> [!NOTE]
> A future `{ "type": "repo", ... }` resolver (resolving from specific DIDs rather than DNS
> discovery) is planned but not yet implemented.

### Symlinks

Lexicons resolved from a **local file** (sources 2 and 3 above) are **symlinked** into the output
`lexicons/` directory rather than copied, so edits to the source file are reflected without
reinstalling. The symlink is written relative to its destination for portability. As an exception,
if the resolved destination path equals the source path, the file is left untouched. Their manifest
lock `uri` is a `file://` path relative to the manifest, keeping it portable across checkouts.
Network-resolved Lexicons are written as plain JSON files and locked with their `at://` URI.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
