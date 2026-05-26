# packages/lex/* — Lexicon toolkit subpackages

A family of lower-level lexicon utilities, broken out so consumers can pick only what they need. Most code in the repo goes through the top-level `@atproto/lexicon` and `@atproto/lex-cli` instead — these are building blocks.

## Subpackages

| Package | Purpose |
|---|---|
| `lex` | Umbrella entry — re-exports the core surface |
| `lex-builder` | Programmatic construction of lexicon docs |
| `lex-cbor` | CBOR encode/decode aware of lexicon types |
| `lex-client` | Typed XRPC client wrapper |
| `lex-data` | Data validation against lexicon refs |
| `lex-document` | LexiconDoc parser + normaliser |
| `lex-installer` | Install lexicons into a registry at runtime |
| `lex-json` | JSON ↔ Lexicon coercion |
| `lex-password-session` | Password-session helpers (used by upstream tooling) |
| `lex-resolver` | Resolve NSIDs to docs (similar to `lexicon-resolver` upstream) |
| `lex-schema` | JSONSchema for LexiconDoc itself |
| `lex-server` | Typed XRPC server wrapper |

## When to touch one of these

Almost never. If you're adding an endpoint, you don't need these. They power `@atproto/lex-cli` and `@atproto/lexicon` under the hood.

## See also

- `packages/lexicon/` and `packages/lex-cli/` — the consumer-facing API
- `.claude/docs/atproto/lexicons-and-codegen.md`
