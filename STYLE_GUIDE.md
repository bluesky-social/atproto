# Style guide

Code conventions for this repository. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the process around issues and pull requests.

Prettier (`pnpm run style`) and ESLint (`pnpm run lint`) enforce what can be enforced mechanically. The rules below are the conventions followed by this repo and are not enforced by tooling.

## Modules and imports

- ESM only — every package ships `"type": "module"`.
- **Always import explicitly**; never rely on globals (e.g. no global `React`). The only exception is jest's ambient test globals.
- Prefer named imports over namespace or barrel imports: `import { useEffect } from 'react'`, not `import * as React from 'react'`.

## TypeScript

- **Type explicitly where types originate, rely on inference everywhere else.** Annotate public API surfaces: exported functions, class members, and module-level constants whose type isn't obvious.
- Never re-annotate what the call site already provides. `expressApp.use((...args) => …)` and `onChange={(event) => …}` need no parameter or return type annotations — TypeScript infers them from the expected callback type.

## Comments

- **Write for an experienced developer.** A comment earns its place by explaining something the code can't: a non-obvious invariant, a subtle edge case, a workaround for an upstream bug, or _why_ a counter-intuitive approach was chosen.
- **Keep them short.** One or two lines is usually enough. Don't write a tutorial where a sentence suffices.
- **Delete comments that restate the code.** `// increment the counter` above `counter++` is noise. Remove such comments when you touch the surrounding code.

## Dependencies

- Don't add new dependencies without strong justification.
- Reference internal packages with the workspace protocol (`workspace:^`); never pin them to a published version.
- `@atproto/api` is being replaced by `@atproto/lex`. Never add `@atproto/api` as a new dependency; use the `@atproto/lex` family instead. It remains in use in [packages/ozone](./packages/ozone/) and in some test suites (`pds`, `bsky`, `dev-env`) — keep using it there until those are migrated.
- **No new circular dependencies**, explicit or implicit. The only tolerated cycle is `pds` ↔ `bsky` in tests. This applies to comments too: a dependency package must never reference an implementation detail of a package that depends on it.

## Scope of a change

- Don't refactor unrelated code. Keep the diff to what the change actually requires.
- **When removing code, don't leave references to it.** Comments, docs, and names must describe the current state only — no "previously…", "used to…", or mentions of a deleted symbol.
