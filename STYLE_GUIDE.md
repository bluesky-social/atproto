# Style guide

Code conventions for this repository. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the process around issues and pull requests.

Prettier (`pnpm run style`) and ESLint (`pnpm run lint`) enforce what can be enforced mechanically. The rules below are the conventions followed by this repo and are not enforced by tooling.

## Modules and imports

- ESM only — every package ships `"type": "module"`.
- **Always import explicitly**; never rely on globals (e.g. no global `React`). The only exception is jest's ambient test globals.
- Prefer named imports over namespace or barrel imports: `import { useEffect } from 'react'`, not `import * as React from 'react'`.
- **Relative imports carry an explicit `.js` extension**, even from a `.ts` source: `import { httpLogger } from './logger.js'`. ESLint's `import/extensions` rule is deliberately off, so nothing catches a missing extension for you.
- **Prefer named exports over `export default`.** Only use a default export when something outside your control requires it (a `vite.config.ts`, a framework's route convention, …).

## Naming

- **Files are kebab-case**: `lex-error.ts`, `write-operation-builder.ts`, `input-new-password.tsx`.
- **Exception — XRPC route handlers.** Under `src/api/**` in the service packages, the file name mirrors the lexicon method name and is therefore camelCase: [packages/bsky/src/api/app/bsky/feed/getAuthorFeed.ts](./packages/bsky/src/api/app/bsky/feed/getAuthorFeed.ts).
- **Exception — React components.** A file exporting a single component may be named after it, in PascalCase (`ProfileCard.tsx`).

## TypeScript

- **Type explicitly where types originate, rely on inference everywhere else.** Annotate public API surfaces: exported functions, class members, and module-level constants whose type isn't obvious.
- Never re-annotate what the call site already provides. `expressApp.use((...args) => …)` and `onChange={(event) => …}` need no parameter or return type annotations — TypeScript infers them from the expected callback type.
- **Prefer `export function` over an arrow function assigned to a const.** Function declarations support overload signatures, which arrow consts cannot express.

## Comments

- **Write for an experienced developer.** A comment earns its place by explaining something the code can't: a non-obvious invariant, a subtle edge case, a workaround for an upstream bug, or _why_ a counter-intuitive approach was chosen.
- **Keep them short.** One or two lines is usually enough. Don't write a tutorial where a sentence suffices.
- **Delete comments that restate the code.** `// increment the counter` above `counter++` is noise. Remove such comments when you touch the surrounding code.
- **Mark explanatory comments with `@NOTE` and deferred work with `@TODO`.** These two annotations are the only ones used in this repo — no `FIXME`, no `HACK`, and no bare `TODO:`.

  ```ts
  // @NOTE keep in sync with same interface in bsky/src/image/invalidator.ts
  // @TODO drop dependency on uint8arrays package once Uint8Array.fromBase64 lands
  ```

- **Document public APIs with JSDoc**: a short description and, where it helps, an `@example` block. Don't restate parameter and return types — TypeScript already carries those. Reserve `@param` / `@returns` for saying something the signature doesn't.

## Dependencies

- Don't add new dependencies without strong justification.
- Reference internal packages with the workspace protocol (`workspace:^`); never pin them to a published version.
- `@atproto/api` is being replaced by `@atproto/lex`. Never add `@atproto/api` as a new dependency; use the `@atproto/lex` family instead. It remains in use in [packages/ozone](./packages/ozone/) and in some test suites (`pds`, `bsky`, `dev-env`) — keep using it there until those are migrated.
- **No new circular dependencies**, explicit or implicit. The only tolerated cycle is `pds` ↔ `bsky` in tests. This applies to comments too: a dependency package must never reference an implementation detail of a package that depends on it.

## Errors

- Custom error classes are suffixed `Error` and declare `name` as a class field matching the class name, so the name is set once at the declaration rather than in every constructor:

  ```ts
  export class XrpcResponseError extends XrpcError {
    name = 'XrpcResponseError'
  }
  ```

  Older packages predate this and omit the field — follow the convention in new code rather than propagating the old shape.

## Lexicons

- **Never write NSID string literals** in a package that uses `@atproto/lex`. Import the generated schema and use the constant it exposes:

  | Lexicon definition               | Use                                     |
  | -------------------------------- | --------------------------------------- |
  | record / typed object            | `app.bsky.feed.post.$type`              |
  | query / procedure / subscription | `app.bsky.feed.getPosts.$lxm`           |
  | token                            | `app.bsky.feed.defs.requestLess.$token` |

  Each constant is emitted once per schema, so every reference shares one string instance instead of duplicating the literal at each call site — and the schema stays the single source of truth.

## Logging

- Never instantiate a logger inline. Each package declares its loggers as exported constants in its own `src/logger.ts`, built with `subsystemLogger('<package>:<subsystem>')`, and imports them where needed.

## Resource disposal

- A class owning a resource (server, subscription, DB handle) implements `async [Symbol.asyncDispose]()`, typically delegating to its existing `destroy()` / `close()`. Consumers then use `await using` instead of `try` / `finally`.

## Scope of a change

- Don't refactor unrelated code. Keep the diff to what the change actually requires.
- **When removing code, don't leave references to it.** Comments, docs, and names must describe the current state only — no "previously…", "used to…", or mentions of a deleted symbol.
