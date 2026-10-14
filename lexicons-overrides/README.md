Any file placed in this directory will override the corresponding lexicon during resolution (depending on the "resolvers" config in `lexicons.json`).

Use this to provide custom implementations or modifications for specific lexicons instead of attempting to resolve them from the canonical source (AT Protocol lexicon resolution).

Please keep this directory tidy. Do remove any override file that is no longer needed (then run `pnpm run lex:update`).
