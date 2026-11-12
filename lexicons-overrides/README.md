# Lexicons Overrides Directory

Any lexicon document placed in this directory will override the corresponding lexicon during resolution (depending on the "resolvers" config in `lexicons.json`):

```json
{
  "version": 2,
  "resolvers": [
    // Canonical lexicons from this repository, always included first
    {
      "type": "directory",
      "path": "../../lexicons",
      "include": ["com.atproto.*", "tools.ozone.*"]
    },

    // Overrides from this directory, always specified after the canonical lexicons
    {
      "type": "directory",
      "path": "../../lexicons-overrides"
    }

    // Other resolvers come here
  ]
}
```

Because this resolver is listed after the canonical one (which resolves `com.atproto.*` / `tools.ozone.*` first), overrides apply to lexicons that would otherwise be resolved from the network or the `bsky` GitHub repository — not to the canonical namespaces. Valid use cases include:

- Providing prototypes or experimental versions of lexicons before they are finalized.
- Overriding a network- or GitHub-resolved lexicon for testing or development purposes.
- Providing a copy of a lexicon document that can no longer be resolved from its upstream source.
- Relaxing a published third-party lexicon that existing network records violate, so read paths accept them (see [Compatibility overrides](#compatibility-overrides)).

> [!NOTE]
>
> The file path of the override should match the lexicon it is intended to override. For example, to override `com.atproto.example`, the file should be named `com/atproto/example.json` and must contain a valid JSON lexicon document with an `id` field matching the lexicon ID (e.g., `"id": "com.atproto.example"`).

Create JSON Lexicon schemas in this directory to provide custom implementations or modifications for specific lexicons instead of attempting to resolve them from the canonical source (AT Protocol lexicon resolution).

> [!NOTE]
>
> Please keep this directory tidy. Do remove any override file that is no longer needed (then run `pnpm run lex:update`).

## Compatibility overrides

A compatibility override is a copy of a published third-party lexicon with the smallest relaxation that lets read paths accept records already on the network. Keep every other constraint identical to the upstream document.

Packages that validate writes (the PDS) must keep validating against the publisher's schema, so they must exclude every compatibility override from their overrides resolver (see the `exclude` list in [packages/pds/lexicons.json](../packages/pds/lexicons.json)). Read-only consumers (the AppView and Ozone) resolve them like any other override.

- `social.grain.photo`
  - Upstream: `at://did:plc:e7rftrdyz5e2rw4y6ocszew2/com.atproto.lexicon.schema/social.grain.photo` (CID `bafyreiec24azdo2caoijpefea3x6qfewjvkfu3zcjj3u3lwf3nx3q7nunu`).
  - Relaxation: `alt` is no longer required.
  - Evidence: published Grain photo records omit `alt` (observed 2026-10-17), so the AppView dropped them from gallery views.
  - Remove when: Grain backfills `alt` on existing records or publishes the relaxation.
