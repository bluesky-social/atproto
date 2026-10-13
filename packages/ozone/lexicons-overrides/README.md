Any file placed in this directory will override the corresponding lexicon during
resolution (see "resolvers" in lexicons.json).

Use this to provide custom implementations or modifications for specific
lexicons without altering the canonical source.

Do remove any override file that is no longer needed (then run `pnpm run lex:update`).
