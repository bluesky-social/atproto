# ESM Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all packages to pure ESM output with Node16 module resolution, upgrade key deps to ESM versions, and convert services to TypeScript entrypoints using Node's type stripping.

**Architecture:** Switch tsconfig base from CommonJS to Node16 module, add `.js` extensions to all relative imports, set `"type": "module"` in every package.json, upgrade multiformats/uint8arrays/p-queue/jose to ESM versions, rewrite service entrypoints as TypeScript.

**Tech Stack:** TypeScript 6, Node 22+, pnpm 8, ESM (`"type": "module"`), Node16 module resolution

---

### Task 1: Upgrade multiformats 9→13

**Files:**

- Modify: `packages/api/package.json`, `packages/aws/package.json`, `packages/common/package.json`, `packages/dev-env/package.json`, `packages/lexicon/package.json`, `packages/ozone/package.json`, `packages/xrpc-server/package.json`, `packages/lex/lex-data/package.json`, `packages/oauth/jwk/package.json`, `packages/oauth/oauth-client/package.json`
- Modify: all source files importing from `multiformats/*`

This can be done before the ESM switch since multiformats 13 is pure ESM and Node 22 can `import` ESM from CJS callers via the compatibility layer.

- [ ] **Step 1: Update multiformats version in all package.json files**

Change `"multiformats": "^9.9.0"` → `"multiformats": "^13.0.0"` in all packages that declare it.

- [ ] **Step 2: Run `pnpm install` and resolve any peer conflicts**

```bash
pnpm install
```

- [ ] **Step 3: Fix import paths**

multiformats 13 maintains `multiformats/cid`, `multiformats/hashes/sha2`, `multiformats/hashes/digest` subpath exports. Verify existing imports still resolve. Key patterns in use:

- `import { CID } from 'multiformats/cid'` — still valid in v13
- `import * as Block from 'multiformats/block'` — still valid
- `import { sha256 } from 'multiformats/hashes/sha2'` — still valid
- `import * as cborg from 'multiformats/codecs/...'` — check if path changed

Fix any import path changes required by the v13 API.

- [ ] **Step 4: Fix any type/API changes**

Key API differences in v13:

- `CID` class is now generic: `CID<Code, Alg, Version>`. Most usage is via `CID.parse()` / `CID.asCID()` which should remain compatible.
- `MultihashDigest` type may have moved — check usages.
- The `bytes` module export path changed — verify.

- [ ] **Step 5: Build and verify**

```bash
pnpm build
pnpm run verify:types
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Upgrade multiformats from ^9 to ^13"
```

---

### Task 2: Upgrade uint8arrays 3→5

**Files:**

- Modify: `packages/bsky/package.json`, `packages/aws/package.json`, `packages/common/package.json`, `packages/crypto/package.json`, `packages/dev-env/package.json`, `packages/lex/lex-data/package.json`, `packages/ozone/package.json`, `packages/pds/package.json`
- Modify: all source files importing from `uint8arrays` or `uint8arrays/*`

- [ ] **Step 1: Update uint8arrays version in all package.json files**

Change `"uint8arrays": "3.0.0"` → `"uint8arrays": "^5.0.0"` in all packages.

- [ ] **Step 2: Run `pnpm install`**

```bash
pnpm install
```

- [ ] **Step 3: Fix import paths**

uint8arrays 5 subpath exports:

- `import * as uint8arrays from 'uint8arrays'` — still valid (barrel export)
- `import { fromString } from 'uint8arrays/from-string'` — still valid
- `import { toString } from 'uint8arrays/to-string'` — still valid
- `import { SupportedEncodings } from 'uint8arrays/to-string'` — verify type export exists

Fix any breakage.

- [ ] **Step 4: Remove the `as Uint8Array<ArrayBuffer>` cast in bsky/data-plane/server/routes/records.ts**

If uint8arrays 5 declares `fromString` as returning `Uint8Array<ArrayBuffer>`, the cast is no longer needed.

- [ ] **Step 5: Build and verify**

```bash
pnpm build
pnpm run verify:types
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Upgrade uint8arrays from 3 to ^5"
```

---

### Task 3: Upgrade p-queue 6→9

**Files:**

- Modify: `packages/bsky/package.json`, `packages/ozone/package.json`, `packages/pds/package.json`, `packages/sync/package.json`
- Modify: source files importing `p-queue` (9 files)

- [ ] **Step 1: Update p-queue version**

Change `"p-queue": "^6.6.2"` → `"p-queue": "^8.0.0"` in all packages. (Use ^8 rather than ^9 if v9 has breaking changes beyond ESM — check changelog.)

- [ ] **Step 2: Run `pnpm install`**

- [ ] **Step 3: Verify import pattern**

All current usage is `import PQueue from 'p-queue'` with default import. Verify this still works in v8/v9 (it should — the package has always exported a default class).

- [ ] **Step 4: Build and verify**

```bash
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Upgrade p-queue from ^6 to ^8"
```

---

### Task 4: Upgrade jose 4→5 in xrpc-server

**Files:**

- Modify: `packages/xrpc-server/package.json`
- Modify: `packages/xrpc-server/src/auth.ts` (likely — verify jose import usage)

- [ ] **Step 1: Update jose version**

Change `"jose": "^4.15.4"` → `"jose": "^5.0.1"` in `packages/xrpc-server/package.json`.

- [ ] **Step 2: Run `pnpm install`**

- [ ] **Step 3: Fix any API changes**

jose v4→v5 key differences:

- `jwtVerify` options slightly restructured
- `importJWK` / `exportJWK` unchanged
- Check `packages/xrpc-server/src/auth.ts` for specific usage

- [ ] **Step 4: Build and verify**

```bash
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Upgrade jose from ^4 to ^5 in xrpc-server"
```

---

### Task 5: Switch tsconfig to Node16 module + ES2022 target

**Files:**

- Modify: `tsconfig/base.json`
- Modify: `tsconfig/nodenext.json` (verify, likely no change needed)

- [ ] **Step 1: Update tsconfig/base.json**

```json
{
  "compilerOptions": {
    "module": "Node16",
    "moduleResolution": "node16",
    "target": "ES2022"
  }
}
```

Remove:

- `"module": "CommonJS"`
- `"moduleResolution": "node"`
- `"ignoreDeprecations": "6.0"`

- [ ] **Step 2: Verify tsconfig/nodenext.json is compatible**

It already uses `"module": "Node16"`, `"moduleResolution": "Node16"`. Remove its `"module"` and `"moduleResolution"` overrides since they now match base. Keep `"target": "ES2023"` override if present.

- [ ] **Step 3: Attempt build (will fail — imports need .js extensions)**

```bash
pnpm build 2>&1 | head -50
```

Verify the errors are all about missing `.js` extensions and not about anything else. This confirms the tsconfig change is correct and the next task (adding extensions) is what's needed.

- [ ] **Step 4: Commit (tsconfig only — build broken is expected at this point)**

```bash
git add tsconfig/
git commit -m "Switch tsconfig to Node16 module resolution + ES2022 target"
```

---

### Task 6: Add .js extensions to all relative imports

**Files:**

- Modify: ~4200 relative imports across all `packages/*/src/**/*.ts` and `packages/*/*/src/**/*.ts` files

This is a bulk mechanical transform. Use a script or codemod.

- [ ] **Step 1: Write and run the extension-adding script**

```bash
# Using a node script to add .js extensions to all relative imports
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs"
import { execSync } from "node:child_process"

const files = execSync(
  "find packages -name \"*.ts\" -not -path \"*/node_modules/*\" -not -path \"*/dist/*\"",
  { encoding: "utf8" }
).trim().split("\n")

let totalFixed = 0
for (const file of files) {
  const content = readFileSync(file, "utf8")
  // Match: from "./..." or from "../..." without .js/.json/.css extension
  const fixed = content.replace(
    /(from\s+['\"])(\.\.?\/[^'\"]+?)(?<!\.js|\.json|\.css|\.mjs)(['\"])/g,
    "$1$2.js$3"
  )
  if (fixed !== content) {
    writeFileSync(file, fixed)
    totalFixed++
  }
}
console.log("Fixed", totalFixed, "files")
'
```

**Important edge cases:**

- Directory imports (`from './utils'` meaning `./utils/index.ts`) → must become `from './utils/index.js'`
- Re-exports: `export { x } from './foo'` → `export { x } from './foo.js'`
- Dynamic imports: `import('./foo')` → `import('./foo.js')`

The regex handles `from` but also check for `export ... from` and `import(...)` patterns.

- [ ] **Step 2: Handle directory/index imports**

Find and fix imports that resolve to `index.ts`:

```bash
# Find imports pointing to directories (where dir/index.ts exists)
grep -rn "from '\.\." packages/*/src/ packages/*/*/src/ --include="*.ts" | grep -v node_modules | grep "\.js'" | while read line; do
  # verify the .js target exists as .ts or is a dir with index.ts
done
```

Manually fix any that point to a directory rather than a file.

- [ ] **Step 3: Build and verify**

```bash
pnpm build
```

The build should now pass (or be very close — any remaining errors are from package.json `"type"` not yet being set, which is the next task).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add .js extensions to all relative imports"
```

---

### Task 7: Set "type": "module" and "exports" in all package.json files

**Files:**

- Modify: all ~60 published `package.json` files + root `package.json`

- [ ] **Step 1: Write and run the package.json update script**

For each package:

1. Set `"type": "module"`
2. Add/update `"exports"` field:
   ```json
   "exports": {
     ".": {
       "types": "./dist/index.d.ts",
       "default": "./dist/index.js"
     }
   }
   ```
3. Remove legacy `"main"` and `"types"` top-level fields

For packages with multiple entrypoints (check existing `"exports"` fields), preserve and update them.

- [ ] **Step 2: Handle packages that already have "type": "commonjs"**

These 38 packages explicitly set commonjs — change to `"module"`.

- [ ] **Step 3: Update root package.json**

Add `"type": "module"` to the root workspace `package.json`.

- [ ] **Step 4: Build and verify**

```bash
pnpm build
pnpm run verify:types
pnpm run lint
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Set type: module and exports in all package.json files"
```

---

### Task 8: Fix CJS-isms in source

**Files:**

- Modify: `packages/oauth/oauth-provider/src/router/assets/assets-manifest.ts`
- Modify: `packages/dev-env/src/seed/client.ts`
- Modify: `packages/lex/lex-builder/src/ts-lang.ts` (verify if actually needed)
- Modify: `packages/ozone/src/tag-service/language-tagger.ts`

- [ ] **Step 1: Fix require() in oauth-provider**

```ts
// Before
const manifest = require(manifestPath) as Manifest

// After
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const manifest = require(manifestPath) as Manifest
```

- [ ] **Step 2: Fix \_\_dirname in dev-env**

```ts
// Before
import path from 'node:path'
// ... __dirname usage

// After
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
```

- [ ] **Step 3: Fix lande dynamic import in ozone**

```ts
// Before
// 'lande' is an esm module, so we need to import it dynamically
const { default: lande } = await import('lande')

// After (at top of file)
import lande from 'lande'
```

- [ ] **Step 4: Verify lex-builder **dirname/**filename references**

Check if these are string literals in codegen output templates (not actual runtime usage). If so, no change needed.

- [ ] **Step 5: Build and verify**

```bash
pnpm build
pnpm run verify:types
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Replace CJS patterns with ESM equivalents"
```

---

### Task 9: Convert services to TypeScript + ESM

**Files:**

- Rewrite: `services/pds/index.js` → `services/pds/index.ts`
- Rewrite: `services/pds/tracer.js` → `services/pds/tracer.ts`
- Rewrite: `services/pds/run-script.js` → `services/pds/run-script.ts`
- Rewrite: `services/bsky/api.js` → `services/bsky/api.ts`
- Rewrite: `services/bsync/index.js` → `services/bsync/index.ts`
- Rewrite: `services/ozone/api.js` → `services/ozone/api.ts`
- Rewrite: `services/ozone/daemon.js` → `services/ozone/daemon.ts`
- Modify: `services/*/package.json` — add `"type": "module"`
- Modify: `services/*/Dockerfile` — update CMD to use `.ts` and `--import`

- [ ] **Step 1: Update service package.json files**

Add `"type": "module"` to each service's `package.json`.

- [ ] **Step 2: Rewrite services/pds/index.js → index.ts**

Convert `require()` calls to `import` statements. The structure stays the same — import library, read env, create server, start.

```ts
import { PDS, envToCfg, envToSecrets, httpLogger, readEnv } from '@atproto/pds'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(
  readFileSync(
    new URL('../packages/pds/package.json', import.meta.url),
    'utf8',
  ),
)

const main = async () => {
  const env = readEnv()
  env.version ??= pkg.version
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const pds = await PDS.create(cfg, secrets)
  await pds.start()
  httpLogger.info('pds is running')
  process.on('SIGTERM', async () => {
    httpLogger.info('pds is stopping')
    await pds.destroy()
    httpLogger.info('pds is stopped')
  })
}

main()
```

- [ ] **Step 3: Rewrite services/pds/tracer.js → tracer.ts**

Convert to ESM imports. Note: `dd-trace` may require special handling — it often needs to be the first import and uses CJS patterns internally. Test that `--import=./tracer.ts` loads dd-trace before other modules.

```ts
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { BetterSqlite3Instrumentation } from 'opentelemetry-plugin-better-sqlite3'
import ddTrace from 'dd-trace'
import path from 'node:path'

const tracer = ddTrace.init({ logInjection: true }).use('express', {
  hooks: { request: maintainXrpcResource },
})

// ... rest of tracer setup
```

**Important:** dd-trace instrumentation MUST load before any instrumented module. Verify `--import=./tracer.ts` achieves this ordering.

- [ ] **Step 4: Rewrite remaining service entrypoints**

Apply the same pattern to `services/bsky/api.js`, `services/bsync/index.js`, `services/ozone/api.js`, `services/ozone/daemon.js`.

- [ ] **Step 5: Update Dockerfiles**

For each service Dockerfile, update CMD:

```dockerfile
# Before
CMD ["node", "--heapsnapshot-signal=SIGUSR2", "--enable-source-maps", "--require=./tracer.js", "index.js"]

# After
CMD ["node", "--heapsnapshot-signal=SIGUSR2", "--enable-source-maps", "--import=./tracer.ts", "index.ts"]
```

- [ ] **Step 6: Delete old .js files**

Remove the now-unused `.js` entrypoint files.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Convert service entrypoints to TypeScript + ESM"
```

---

### Task 10: Jest ESM compatibility

**Files:**

- Modify: `packages/pds/package.json` (test script)
- Modify: `packages/bsky/package.json` (test script)
- Modify: `packages/ozone/package.json` (test script)
- Possibly modify: jest config files, `packages/dev-infra/with-test-redis-and-db.sh`

- [ ] **Step 1: Add --experimental-vm-modules to Jest test environment**

Either in the test scripts or in the wrapper shell script:

```bash
export NODE_OPTIONS="--experimental-vm-modules ${NODE_OPTIONS:-}"
```

- [ ] **Step 2: Update jest transform config if needed**

With `"type": "module"`, Jest needs to know to treat `.ts` files as ESM. The `@swc/jest` transform should handle this, but may need `extensionsToTreatAsEsm: ['.ts']` in jest config.

- [ ] **Step 3: Verify tests run**

```bash
cd packages/pds && pnpm test:sqlite -- --maxWorkers=2 2>&1 | tail -20
```

If tests fail with ESM-related errors, troubleshoot:

- Missing `--experimental-vm-modules`
- Transform not emitting ESM
- Dynamic imports in test setup

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Configure Jest for ESM module loading"
```

---

### Task 11: Final verification + changeset

**Files:**

- Create: `.changeset/esm-migration.md`
- Modify: `pnpm-lock.yaml` (from all dep upgrades)

- [ ] **Step 1: Full build**

```bash
pnpm build
```

- [ ] **Step 2: Full type check**

```bash
pnpm run verify:types
```

- [ ] **Step 3: Full lint**

```bash
pnpm run lint
```

- [ ] **Step 4: Write changeset**

Minor bump for all published libraries (breaking for direct CJS `require()` consumers, though Node 22's compat layer handles most cases):

```markdown
---
'@atproto/api': minor
'@atproto/common': minor
... (all published packages)
---

Convert to pure ESM. Packages now ship `"type": "module"` and use ES module syntax in compiled output.

Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code. However, direct CJS consumers on older Node versions will need to use dynamic `import()`.

Also upgrades multiformats (9→13), uint8arrays (3→5), p-queue (6→8), and jose in xrpc-server (4→5).
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add changeset for ESM migration"
```

---

## Ordering Notes

- **Tasks 1-4 (dep upgrades)** can be done independently and in any order. Each should produce a passing build on its own. If any upgrade proves too complex, it can be deferred (per user preference).
- **Tasks 5-7 (tsconfig + extensions + type:module)** are tightly coupled. Task 5 will break the build; Task 6 partially fixes it; Task 7 finishes. They can be one large commit or kept separate for clarity — squash at the end if desired.
- **Task 8 (CJS-isms)** can happen any time after Task 7.
- **Task 9 (services)** depends on Tasks 5-7 being complete.
- **Task 10 (Jest)** depends on Tasks 5-7 being complete.
- **Task 11 (verification)** is the final gate.

## Fallback Strategy

If dep upgrades (Tasks 1-4) prove too disruptive, they can be deferred and the ESM migration (Tasks 5-9) can proceed without them. CJS deps work fine when imported from ESM on Node 22. The dep upgrades are "nice to have for clean module resolution" but not strictly required.
