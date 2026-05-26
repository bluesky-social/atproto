# @atproto/lexicon — Lexicon schema runtime

The runtime library that validates data against lexicon schemas. Used by both clients (request encoding) and servers (input/output validation). Pure TypeScript, no Node-only deps where avoidable.

## What's here

- Lexicon parsing (`LexiconDoc` definitions)
- Validators for each primitive (`string`, `bytes`, `cid-link`, `at-uri`, ...)
- Record/blob validators
- The `Lexicons` registry used at runtime

## When to touch this

- Adding a new format/primitive to the lexicon language (rare; upstream concern)
- Fixing a validation bug (always add a regression test in `tests/`)

## Don't touch this when

- You're adding a W Social endpoint — that's a lexicon JSON change + handler change, no runtime change needed
- You're tweaking codegen output — that's `lex-cli`

## See also

- `.claude/docs/atproto/lexicons-and-codegen.md`
