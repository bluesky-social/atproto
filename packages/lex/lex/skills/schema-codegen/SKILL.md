---
name: schema-codegen
description: >
  Generating TypeScript schemas from Lexicon JSON with lex build. Options:
  --out, --clear, --override, --pure-annotations, --importExt, --fileExt,
  --include, --exclude, --lib, --allowLegacyBlobs, --indexFile. Workflow
  integration with prebuild and postinstall scripts. Tree-shaking setup.
type: core
library: '@atproto/lex'
library_version: '0.0.20'
requires:
  - atproto-lex/lexicon-management
sources:
  - 'bluesky-social/atproto:packages/lex/lex/README.md'
  - 'bluesky-social/atproto:packages/lex/lex-builder/src/lex-builder.ts'
---

# schema-codegen

Generate TypeScript schemas from Lexicon JSON files using the `lex build` command. The generated code includes type-safe validators, type guards, and builder utilities for AT Protocol data structures.

## Setup

After installing Lexicon schemas with `lex install`, run the build command to generate TypeScript:

```bash
lex build
```

By default this reads from `./lexicons` and writes to `./src/lexicons`. Override with flags:

```bash
lex build --lexicons ./lexicons --out ./src/lexicons
```

Full option reference:

| Flag | Default | Description |
|------|---------|-------------|
| `--lexicons <dir>` | `./lexicons` | Directory containing Lexicon JSON files |
| `--out <dir>` | `./src/lexicons` | Output directory for generated TypeScript |
| `--clear` | `false` | Clear output directory before generating |
| `--override` | `false` | Override existing files (no effect with --clear) |
| `--no-pretty` | `false` | Skip prettier formatting on generated files |
| `--pure-annotations` | `false` | Add `/*#__PURE__*/` annotations for tree-shaking |
| `--include <patterns...>` | none | Include only matching lexicon IDs (strings or regex) |
| `--exclude <patterns...>` | none | Exclude matching lexicon IDs (strings or regex) |
| `--lib <package>` | `@atproto/lex` | Package to import the `l` schema utility from |
| `--allowLegacyBlobs` | `false` | Accept legacy blob references in generated schemas |
| `--importExt <ext>` | `.js` | Extension for import statements in generated files |
| `--fileExt <ext>` | `.ts` | Extension for generated files |
| `--indexFile` | `false` | Generate an index file re-exporting all root namespaces |
| `--ignore-errors` | none | How to handle errors in input files |

## Core Patterns

### Basic build

Generate TypeScript from all installed lexicons using defaults:

```bash
lex build
```

This produces one TypeScript module per lexicon in `./src/lexicons`, plus namespace re-export files for convenient imports.

### Library build with tree-shaking

When building a library that others will consume, add `--pure-annotations` so bundlers can eliminate unused code:

```bash
lex build --out ./src/lexicons --pure-annotations
```

This adds `/*#__PURE__*/` comments to generated function calls, allowing tools like Rollup, Webpack, and esbuild to tree-shake unused schemas.

Consumers of your library can then import only what they need:

```typescript
// Direct imports (tree-shakeable)
import { post } from './lexicons/app/bsky/feed/post.js'
import { getProfile } from './lexicons/app/bsky/actor/getProfile.js'

// Namespace imports (still tree-shakeable)
import * as app from './lexicons/app.js'
```

### Filtering with include/exclude

Build only a subset of installed lexicons:

```bash
# Include only feed-related lexicons
lex build --include app.bsky.feed

# Exclude chat lexicons from the build
lex build --exclude chat.bsky

# Combine include and exclude with regex patterns
lex build --include "app\.bsky\.(feed|actor)" --exclude "app\.bsky\.feed\.defs"
```

The `--include` and `--exclude` flags accept strings or regex patterns matched against lexicon document IDs.

### Workflow integration

Add these scripts to `package.json` to wire codegen into your build pipeline:

```json
{
  "scripts": {
    "update-lexicons": "lex install --update --save",
    "postinstall": "lex install --ci",
    "prebuild": "lex build",
    "build": "tsc"
  }
}
```

What each script does:

- **postinstall** -- Runs after `npm install` / `pnpm install`. Verifies lexicon files match the manifest (`lexicons.json`). The `--ci` flag ensures deterministic installs without modifying the manifest.
- **prebuild** -- Runs automatically before `build`. Regenerates TypeScript schemas so `tsc` always compiles against fresh generated code.
- **update-lexicons** -- Manual command to pull the latest lexicon versions from the network and update the manifest.

For library packages that need tree-shaking:

```json
{
  "scripts": {
    "postinstall": "lex install --ci",
    "prebuild": "lex build --pure-annotations",
    "build": "tsc"
  }
}
```

### Generating an index file

Use `--indexFile` to create a root `index.ts` that re-exports all top-level namespaces:

```bash
lex build --indexFile
```

This generates an `index.ts` in the output directory with namespace exports for each TLD (e.g., `app`, `chat`, `com`).

## Common Mistakes

### HIGH: Missing prebuild script for codegen

Generated TypeScript files should not be committed to version control. Without `prebuild`, the `build` step fails because the generated files do not exist yet.

Wrong:

```json
{
  "scripts": {
    "build": "tsc"
  }
}
```

Correct:

```json
{
  "scripts": {
    "postinstall": "lex install --ci",
    "prebuild": "lex build",
    "build": "tsc"
  }
}
```

The `prebuild` script runs automatically before `build`, ensuring generated schemas exist before TypeScript compilation.

### MEDIUM: Not using --pure-annotations for libraries

Without `--pure-annotations`, bundlers cannot tree-shake generated code when consumers import your library. This bloats downstream bundles with unused schemas.

Wrong:

```bash
lex build --out ./src/lexicons
```

Correct:

```bash
lex build --out ./src/lexicons --pure-annotations
```

### MEDIUM: Using --indexFile with .index TLD namespace

The `--indexFile` option generates an `index.ts` at the output root. If any lexicon namespace uses `index` as its top-level domain (TLD), this causes a naming conflict and throws an error:

```
The "indexFile" options cannot be used with namespaces using a ".index" tld.
```

There is no workaround other than not using `--indexFile` when your lexicon IDs start with `index.*`.

## Cross-references

- **schema-codegen -> data-validation**: `lex build` generates schema objects (validators, type guards, builders) that are used at runtime for data validation.

## See also

- [TypeScript Schemas (README)](../../README.md#typescript-schemas) -- full option reference and generated schema structure
- [Workflow Integration (README)](../../README.md#workflow-integration) -- development workflow setup
- [Tree-Shaking (README)](../../README.md#tree-shaking) -- tree-shaking details and import patterns
