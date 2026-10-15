---
"@atproto/lex-password-session": patch
"@atproto/lexicon-resolver": patch
"@atproto/lex-client": patch
"@atproto/ozone": patch
"@atproto/bsky": patch
"@atproto/api": patch
---

Source Lexicons through each package's own `lexicons.json` manifest instead of compiling the repo-root `lexicons` directory directly. Canonical `com.atproto.*` / `tools.ozone.*` schemas are symlinked from the root, `app.bsky.*` / `chat.bsky.*` are fetched from the `bluesky-social/bsky` Github repo, other external namespaces resolve from the network, and locally diverging documents are kept under a tracked `lexicons-overrides` directory. The root `lexicons` directory now only holds the canonical `com.atproto` and `tools.ozone` namespaces. No change to generated output or published API.
