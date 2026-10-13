Any file placed in this directory will override the corresponding lexicon during resolution of the `bsky`, `api` and `ozone` packages (see "resolvers" in their respective `lexicons.json`).

Use this to provide custom implementations or modifications for specific lexicons instead of attempting to resolve them from the canonical source (AT Protocol lexicon resolution).

Do remove any override file that is no longer needed (then run `pnpm run lex:update`).
