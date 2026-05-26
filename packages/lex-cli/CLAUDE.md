# @atproto/lex-cli — Lexicon codegen CLI

The CLI that turns JSON lexicons (in `lexicons/`) into TypeScript clients and server handlers. Run indirectly via `make codegen` from the repo root, or directly inside a package's `codegen` script.

## What it generates

For each lexicon NSID it emits:
- **Client types** — request/response interfaces consumed by `@atproto/api`
- **Server stubs** — handler signatures consumed by `@atproto/xrpc-server`

Generated files land in each consuming package's `src/lexicon/` (or `src/client/lexicons.ts`).

## When to run

Any time a `.json` file under `lexicons/` is added, removed, or edited:

```sh
make codegen
# or, scoped:
pnpm --filter @atproto/pds codegen
```

The root `precodegen` step builds `lex-cli` first, so a `make codegen` from a clean tree is safe.

## Don't edit generated files

Anything under `src/lexicon/` in a consuming package is regenerated. Treat them as build artifacts. If you need to influence the output, the change goes in the lexicon JSON or in `lex-cli`'s templates.

## See also

- `.claude/docs/atproto/lexicons-and-codegen.md` — full lexicon-authoring workflow
- `lexicons/CLAUDE.md` — what lives where in the lexicon tree
