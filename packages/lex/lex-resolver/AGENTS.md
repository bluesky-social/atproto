# AGENTS.md

## Lexicon codegen: exception to the per-package `lexicons.json` convention

This package does **not** follow the repo-wide lexicon-management convention (a
per-package `lexicons.json` manifest resolved with `lex install`; see
[CONTRIBUTING → "Working with lexicons"](../../../CONTRIBUTING.md#working-with-lexicons)
and the `lex-setup` skill). It has no `lexicons.json` and compiles the canonical
schemas straight from the repo-root [lexicons/](../../../lexicons/):

```
"codegen:lex": "lex-builder build --lexicons ../../../lexicons --out ./src/lexicons --clear --lib @atproto/lex-schema --include com.atproto.sync.getRecord --include com.atproto.lexicon.schema"
```

**Why:** the installer (`@atproto/lex-installer`) depends on `@atproto/lex-resolver`,
so this package cannot depend on the installer to manage a manifest without
creating a dependency cycle. It only needs canonical (`com.atproto.*`) schemas,
which live in the root `lexicons` directory anyway, so compiling them directly is
sufficient.

**Do not** add a `lexicons.json`, `@atproto/lex`, or `@atproto/lex-installer`
here, and do not "migrate" this `codegen:lex` to the `lex install` form — keep the
`lex-builder build --lexicons ../../../lexicons --include …` shape. Only
`/src/lexicons` is gitignored (generated); there is no resolved `./lexicons`
directory to manage.
