# ESM Migration Design

Convert all packages to pure ESM output. Services become TypeScript entrypoints using Node 22's type stripping. Upgrade multiformats and uint8arrays to their modern ESM versions.

## Context

The repo currently emits CommonJS from `tsc` via `"module": "CommonJS"` in the base tsconfig. Most packages have no `"type"` field (defaulting to CJS) or explicitly declare `"type": "commonjs"`. The codebase already uses `import`/`export` syntax in source — only the compiled output is CJS. Node 22 is the minimum runtime (established on the parent branch), and all consumers are expected to be on modern Node.

## Design

### 1. tsconfig changes

**`tsconfig/base.json`:**
- `"module": "Node16"` (replaces `"CommonJS"`)
- `"moduleResolution": "node16"` (replaces `"node"`)
- Remove `"ignoreDeprecations": "6.0"` (no longer needed once moduleResolution is node16)
- `"target": "ES2022"` (bumped from ES2020 — enables top-level await, native class fields, and private field syntax without downleveling. Supported since Node 16.)

**`tsconfig/nodenext.json`:**
- Already uses `"module": "Node16"`, `"moduleResolution": "Node16"`. No change needed.

**`tsconfig/isomorphic.json`, `tsconfig/node.json`:**
- Inherit base. No changes needed beyond what base provides.

**`tsconfig/bundler.json`:**
- Already uses `"module": "ESNext"`, `"moduleResolution": "Bundler"`. No change needed (used only by vite-built UI packages).

### 2. package.json updates (all ~60 published packages)

Each package gets:
```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```

- Remove legacy `"main"` and `"types"` top-level fields (superseded by `"exports"`).
- Packages that expose multiple entrypoints (e.g. `@atproto/lex` exporting subpaths) get additional entries in `"exports"`.

### 3. Source imports: add `.js` extensions

Every relative import in `.ts` source:
```ts
// Before
import { x } from './foo'
import { y } from '../utils/bar'

// After
import { x } from './foo.js'
import { y } from '../utils/bar.js'
```

This is required by Node16 module resolution. TypeScript resolves `./foo.js` to `./foo.ts` during compilation and emits `./foo.js` in the output — matching Node's runtime behavior.

**Scope:** all `packages/*/src/**/*.ts` and `packages/*/*/src/**/*.ts` files. Mechanical bulk transform (can be done with a codemod or eslint `--fix` via the existing `import/extensions` rule).

### 4. Upgrade dependencies for ESM

| Package | From | To | Notes |
|---------|------|------|-------|
| `multiformats` | `^9.9.0` | `^13.0.0` | Pure ESM, proper subpath exports. Used in ~10 packages. |
| `uint8arrays` | `3.0.0` | `^5.0.0` | Pure ESM, proper TypeScript types. Used in ~8 packages. |
| `p-queue` | `^6.6.2` | `^9.0.0` | Pure ESM with exports. Used in pds, bsky, ozone, sync. v6 is CJS without exports field. |
| `jose` (xrpc-server only) | `^4.15.4` | `^5.0.1` | Align with rest of repo (pds/bsky/oauth already on ^5). v4 is CJS-only. |

**multiformats 9→13:** The CID API changed between versions. `CID.parse()`, `CID.asCID()` usage may need updates. Hash functions moved from `multiformats/hashes/sha2` to a different import path.

**uint8arrays 3→5:** After upgrading, the `as Uint8Array<ArrayBuffer>` cast in `bsky/data-plane/server/routes/records.ts` (the last remaining third-party cast from the TS 6 work) should resolve since `uint8arrays@5` declares proper generic types.

**p-queue 6→9:** API is largely compatible. Constructor options unchanged. Main difference is it's now pure ESM (no `require()` possible).

**jose 4→5 (xrpc-server):** Minor API differences around JWT verification options. The rest of the repo already uses v5.

### 5. Fix CJS-isms in source

| File | Pattern | Fix |
|------|---------|-----|
| `packages/oauth/oauth-provider/src/router/assets/assets-manifest.ts` | `require(manifestPath)` | `createRequire(import.meta.url)(manifestPath)` |
| `packages/dev-env/src/seed/client.ts` | `__dirname` | `path.dirname(fileURLToPath(import.meta.url))` |
| `packages/lex/lex-builder/src/ts-lang.ts` | References `__dirname`/`__filename` in codegen output | These are string literals in generated code, not actual usage — verify and leave if so |
| `packages/ozone/src/tag-service/language-tagger.ts` | `await import('lande')` | Static `import lande from 'lande'` — was a CJS workaround since lande is ESM-only |

### 6. Services → TypeScript + ESM

Each service directory (`services/pds`, `services/bsky`, `services/bsync`, `services/ozone`):

**package.json:**
```json
{
  "type": "module",
  "packageManager": "pnpm@8.15.9"
}
```

**Entrypoint files:** rewrite `.js` → `.ts` using `import` syntax. These are thin (~20 lines): import the library, read env config, start server.

**Tracer files:** rewrite `tracer.js` → `tracer.ts` using `import`.

**Dockerfile CMD:**
```dockerfile
CMD ["node", "--heapsnapshot-signal=SIGUSR2", "--enable-source-maps", "--import=./tracer.ts", "index.ts"]
```

Removes `--require=./tracer.js`. Node 22's type stripping handles `.ts` directly.

**Note:** Service `.ts` files are NOT compiled. They run directly via Node's type stripping. The compiled library packages they import are pre-built ESM `.js` files.

### 7. Jest ESM compatibility

For packages still on Jest (pds, bsky, ozone, and others using the root `jest` devDep):

- Add `NODE_OPTIONS=--experimental-vm-modules` to test scripts (or set in the `with-test-redis-and-db.sh` wrapper).
- Keep `@swc/jest` transform for TypeScript. It already emits ESM when configured.
- `jest.config` may need `extensionsToTreatAsEsm: ['.ts']` and transform adjustments.

The Jest→Vitest migration is explicitly deferred.

### 8. Lockfile + changeset

- Regenerate `pnpm-lock.yaml` after multiformats/uint8arrays upgrade.
- Changeset: minor bump for all published libraries (this is a breaking change for any consumer that `require()`s these packages directly — Node 22's `require(esm)` compat layer handles most cases transparently, but it's still a semver-minor signal).

## Ordering

The work should proceed in this order (each step builds on the prior):

1. Upgrade multiformats + uint8arrays (can be done independently, unblocks clean imports)
2. tsconfig switch to Node16 module
3. Add `.js` extensions to all imports
4. Add `"type": "module"` + `"exports"` to all package.json files
5. Fix CJS-isms (`require`, `__dirname`)
6. Services → TypeScript + ESM
7. Jest ESM compat
8. Verify: build, lint, verify:types all pass
9. Changeset + lockfile

Steps 2-5 are tightly coupled and likely need to land together (the build won't pass in intermediate states). Steps 1, 6, and 7 are more independent.

## Risks

- **multiformats 9→13 API changes:** The CID API changed between versions. `CID.parse()`, `CID.asCID()` usage may need updates. The hash functions moved from `multiformats/hashes/sha2` to a different import path.
- **Jest + ESM:** Known to be fragile. May need `--experimental-vm-modules` plus specific transform config. If it proves too painful, we can keep test files as `.cts` or add a jest ESM preset.
- **Third-party deps without ESM exports:** Any dep that only ships CJS will still work (Node 22's `import` can load CJS), but its types might not resolve correctly under `moduleResolution: "node16"` if it lacks an `"exports"` field. We'll discover these during the build step.
