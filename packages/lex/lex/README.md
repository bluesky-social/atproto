Type-safe Lexicon tooling for AT Protocol data.

- Fetch and manage Lexicon schemas, generate TypeScript validators
- Compile-time and runtime type safety for AT Protocol data structures
- Fully typed XRPC client with authentication support
- Tree-shaking and composition friendly

```typescript
// Build and validate data with generated utilities

const newPost = app.bsky.feed.post.$build({
  text: 'Hello, world!',
  createdAt: new Date().toISOString(),
})

app.bsky.actor.profile.$validate({
  $type: 'app.bsky.actor.profile',
  displayName: 'Ha'.repeat(32) + '!',
}) // Error: grapheme too big (maximum 64, got 65) at $.displayName
```

```typescript
// Trivially make type-safe XRPC requests towards a service

const profile = await xrpc('https://api.bsky.app', app.bsky.actor.getProfile, {
  params: { actor: 'pfrazee.com' },
})
```

```typescript
// Manipulate records with the Client API in the context of an authenticated session

const client = new Client(oauthSession)

await client.create(app.bsky.feed.post, {
  text: 'Hello, world!',
  createdAt: new Date().toISOString(),
})

const posts = await client.list(app.bsky.feed.post, { limit: 10 })
```

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Quick Start](#quick-start)
- [Lexicon Schemas](#lexicon-schemas)
- [TypeScript Schemas](#typescript-schemas)
  - [Generated Schema Structure](#generated-schema-structure)
  - [Type definitions](#type-definitions)
  - [Building data](#building-data)
  - [Validation Helpers](#validation-helpers)
    - [Record / typed-object helpers](#record--typed-object-helpers)
      - [`$type` - Type Identifier](#type---type-identifier)
      - [`$build(data)` - Build with Defaults](#builddata---build-with-defaults)
      - [`$isTypeOf(data)` - Type Discriminator](#istypeofdata---type-discriminator)
    - [Universal validation helpers](#universal-validation-helpers)
      - [`$matches(data)` - Type Guard](#matchesdata---type-guard)
      - [`$assert(data)` - Type-Narrowing Assertion](#assertdata---type-narrowing-assertion)
      - [`$parse(data)` - Parse and Validate](#parsedata---parse-and-validate)
      - [`$validate(data)` - Validate a value against the schema](#validatedata---validate-a-value-against-the-schema)
      - [`$safeParse(data, options?)` - Parse a value against a schema and get the resulting value](#safeparsedata-options---parse-a-value-against-a-schema-and-get-the-resulting-value)
- [Data Model](#data-model)
  - [Types](#types)
  - [JSON Encoding](#json-encoding)
  - [CBOR Encoding](#cbor-encoding)
- [Making simple XRPC Requests](#making-simple-xrpc-requests)
- [Client API](#client-api)
  - [Creating a Client](#creating-a-client)
    - [Unauthenticated Client](#unauthenticated-client)
    - [Authenticated Client with OAuth](#authenticated-client-with-oauth)
    - [Authenticated Client with Password](#authenticated-client-with-password)
    - [Client with Service Proxy (authenticated only)](#client-with-service-proxy-authenticated-only)
    - [Validation and Strictness Options](#validation-and-strictness-options)
  - [Core Methods](#core-methods)
    - [`client.call()`](#clientcall)
    - [`client.create()`](#clientcreate)
    - [`client.get()`](#clientget)
    - [`client.put()`](#clientput)
    - [`client.delete()`](#clientdelete)
    - [`client.list()`](#clientlist)
    - [`client.applyWrites()`](#clientapplywrites)
  - [Error Handling](#error-handling)
    - [Safe Methods](#safe-methods)
    - [XrpcFailure Type](#xrpcfailure-type)
  - [Authentication Methods](#authentication-methods)
    - [`client.did`](#clientdid)
    - [`client.assertAuthenticated()`](#clientassertauthenticated)
    - [`client.assertDid`](#clientassertdid)
  - [Labeler Configuration](#labeler-configuration)
  - [Low-Level XRPC](#low-level-xrpc)
- [Utilities](#utilities)
  - [Datetime Strings](#datetime-strings)
- [Advanced Usage](#advanced-usage)
  - [Workflow Integration](#workflow-integration)
    - [Development Workflow](#development-workflow)
  - [Tree-Shaking](#tree-shaking)
    - [Namespace notation](#namespace-notation)
    - [Explicit `.main` reference](#explicit-main-reference)
    - [Direct named import from the schema file](#direct-named-import-from-the-schema-file)
    - [Default import (recommended)](#default-import-recommended)
    - [Drawbacks of the default export](#drawbacks-of-the-default-export)
    - [Summary](#summary)
  - [Blob references](#blob-references)
    - [TypedBlobRef: The Current Standard](#typedblobref-the-current-standard)
    - [LegacyBlobRef: Historical Format](#legacyblobref-historical-format)
    - [Working with Both Formats](#working-with-both-formats)
  - [Actions](#actions)
    - [What are Actions?](#what-are-actions)
    - [Using Actions](#using-actions)
    - [Composing Multiple Operations](#composing-multiple-operations)
    - [Higher-Order Actions](#higher-order-actions)
  - [Using a Single Client for Multiple Services](#using-a-single-client-for-multiple-services)
  - [Building Library-Style APIs with Actions](#building-library-style-apis-with-actions)
    - [Creating Posts](#creating-posts)
    - [Following Users](#following-users)
    - [Updating Profile with Retry Logic](#updating-profile-with-retry-logic)
    - [Packaging Actions as a Library](#packaging-actions-as-a-library)
    - [Best Practices for Actions](#best-practices-for-actions)
  - [Standard Schema Compatibility](#standard-schema-compatibility)
  - [Validating Generic Schemas with `$check`](#validating-generic-schemas-with-check)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Quick Start

**1. Install Lexicons**

Install the Lexicon schemas you need for your application:

```bash
lex install app.bsky.feed.post app.bsky.feed.like
```

This creates:

- `lexicons.json` - manifest tracking installed Lexicons and their versions (CIDs)
- `lexicons/` - directory containing the Lexicon JSON files

> [!NOTE]
>
> The `lex` command might conflict with other binaries installed on your system.
> If that happens, you can also run the CLI using `ts-lex`, `pnpm exec lex` or
> `npx @atproto/lex`.

**2. Verify and commit installed Lexicons**

Make sure to commit the `lexicons.json` manifest and the `lexicons/` directory containing the JSON files to version control.

```bash
git add lexicons.json lexicons/
git commit -m "Install Lexicons"
```

**3. Build TypeScript schemas**

Generate TypeScript schemas from the installed Lexicons:

```bash
lex build
```

This generates TypeScript files in `./src/lexicons` (by default) with type-safe validation, type guards, and builder utilities.

> [!TIP]
>
> If you wish to customize the output location or any other build options, pass the appropriate flags to the `lex build` command. See the [TypeScript Schemas](#typescript-schemas) section for available options.

> [!NOTE]
>
> The generated TypeScript files don't need to be committed to version control. Instead, they can be generated during your project's build step. See [Workflow Integration](#workflow-integration) for details.
>
> To avoid committing generated files, add the output directory to your `.gitignore`:
>
> ```bash
> echo "./src/lexicons" >> .gitignore
> ```

**4. Use in your code**

```typescript
import { xrpc } from '@atproto/lex'
import { app } from './lexicons/index.js'

const profile = await xrpc('https://api.bsky.app', app.bsky.actor.getProfile, {
  params: { actor: 'pfrazee.com' },
})
```

## Lexicon Schemas

The `lex install` command fetches Lexicon schemas from the Atmosphere network and manages them locally (in the `lexicons/` directory by default). It also updates the `lexicons.json` manifest file to track installed Lexicons and their versions.

```bash
# Install Lexicons and update lexicons.json (default behavior)
lex install app.bsky.feed.post

# Install all Lexicons from lexicons.json manifest
lex install

# Install specific Lexicons without updating manifest
lex install --no-save app.bsky.feed.post app.bsky.actor.profile

# Update (re-fetch) all installed Lexicons to latest versions
lex install --update

# Fetch any missing Lexicons and verify against manifest
lex install --ci
```

Options:

- `--manifest <path>` - Path to lexicons.json manifest file (default: `./lexicons.json`)
- `--no-save` - Don't update lexicons.json with installed lexicons (save is enabled by default)
- `--update` - Update all installed lexicons to their latest versions by re-resolving and re-installing them
- `--ci` - Error if the installed lexicons do not match the CIDs in the lexicons.json manifest
- `--lexicons <dir>` - Directory containing lexicon JSON files (default: `./lexicons`)

## TypeScript Schemas

After installing Lexicon JSON files, use the `lex build` command to generate TypeScript schemas. These generated schemas provide type-safe validation, type guards, and builder utilities for working with AT Protocol data structures.

```bash
lex build --lexicons ./lexicons --out ./src/lexicons
```

Options:

- `--lexicons <dir>` - Directory containing lexicon JSON files (default: `./lexicons`)
- `--out <dir>` - Output directory for generated TypeScript (default: `./src/lexicons`)
- `--clear` - Clear output directory before generating
- `--override` - Override existing files (has no effect with --clear)
- `--no-pretty` - Don't run prettier on generated files (prettier is enabled by default)
- `--ignore-errors` - Skip files that fail to parse or compile instead of aborting the build
- `--ignore-invalid-lexicons` - Skip lexicon files that fail validation instead of exiting with an error
- `--exclude <patterns...>` - List of strings or regex patterns to exclude lexicon documents by their IDs
- `--include <patterns...>` - List of strings or regex patterns to include lexicon documents by their IDs
- `--lib <package>` - Package name of the library to import the lex schema utility "l" from (default: `@atproto/lex`)
- `--import-ext <ext>` - File extension to use for import statements in generated files (default: `.js`). Use `--import-ext ""` to generate extension-less imports
- `--file-ext <ext>` - File extension to use for generated files (default: `.ts`)
- `--index-file` - Generate an "index" file that re-exports all root-level namespaces (disabled by default)
- `--defs-export` - When some definitions conflict with child namespaces, export lexicon definitions under a separate `$defs` namespace (e.g. `com.example.foo.$defs`)
- `--no-default-export` - Disable generation of a `default` export of the `main` schema in each schema's namespace file (default exports are enabled by default; see [Tree-Shaking](#tree-shaking))

### Generated Schema Structure

Each Lexicon generates a TypeScript module with:

- **Type definitions** - TypeScript types extracted from the schema
- **Schema instances** - Runtime validation objects with methods
- **Exported utilities** - Convenience functions for common operations

### Type definitions

You can extract TypeScript types from the generated schemas for use in you application:

```typescript
import * as app from './lexicons/app.js'

function renderPost(p: app.bsky.feed.post.Main) {
  console.log(p.$type) // 'app.bsky.feed.post'
  console.log(p.text)
}
```

### Building data

It is recommended to use the generated builders to create data that conforms to the schema. TypeScript ensures that all required fields are present at compile time.

```typescript
import { l } from '@atproto/lex'
import * as app from './lexicons/app.js'

// variable type will be inferred as "app.bsky.feed.post.Main"
const post = app.bsky.feed.post.$build({
  // No need to specify $type when using $build
  text: 'Hello, world!',
  createdAt: l.currentDatetimeString(),
})

// For runtime validation, use $parse()/$validate() instead
const postWithDefaults = app.bsky.feed.post.$parse(post)
app.bsky.feed.post.$validate(post)
```

### Validation Helpers

Generated namespaces expose a handful of `$`-prefixed helpers bound to the namespace's `main` schema. They come in two groups:

- [**Universal validation helpers**](#universal-validation-helpers) are available on every schema's `main`: `$matches`, `$assert`, `$check`, `$parse`, `$safeParse`, `$validate`, `$safeValidate` (and `$cast` / `$ifMatches`). These work for records, typed objects, queries, procedures, and subscriptions.
- [**Record / typed-object helpers**](#record--typed-object-helpers) are only emitted for record and typed-object schemas: `$type`, `$build`, `$isTypeOf`.

In addition, every generated namespace file exports a top-level `$nsid` constant containing the NSID of the lexicon document:

```typescript
import * as app from './lexicons/app.js'

console.log(app.bsky.feed.defs.$nsid) // 'app.bsky.feed.defs'
```

The Schema instance itself (for example `app.bsky.feed.post.main`) also exposes the underlying methods both with and without the `$` prefix (e.g. `main.parse()` and `main.$parse()`).

#### Record / typed-object helpers

##### `$type` - Type Identifier

Returns the `$type` string of the schema (only available on record and typed-object schemas):

```typescript
import * as app from './lexicons/app.js'

console.log(app.bsky.feed.post.$type) // 'app.bsky.feed.post'
console.log(app.bsky.actor.defs.profileViewBasic.$type) // 'app.bsky.actor.defs#profileViewBasic'
```

Prefer `$type` over hard-coding the equivalent string literal in your code. The constant is emitted exactly once per schema in the generated namespace file, so every reference reuses the same string instance. Inlining `'app.bsky.feed.post'` everywhere instead leaks the same string into every call site, increases bundle size, and creates a typo-prone source of drift between your code and the schema.

##### `$build(data)` - Build with Defaults

Builds data by adding the `$type` property and properly types the result. This also allows to declare a variable with the correct type without having to explicitly specify it.

```typescript
import { l } from '@atproto/lex'
import * as app from './lexicons/app.js'

// The type of the "like" variable will be "app.bsky.feed.like.Main" (no need to explicitly specify the type)
const like = app.bsky.feed.like.$build({
  subject: {
    uri: 'at://did:plc:abc/app.bsky.feed.post/123',
    cid: 'bafyrei...',
  },
  createdAt: l.currentDatetimeString(),
})
```

> [!NOTE]
>
> `$build()` does not perform validation, and expects properly typed input data - use `$parse()` if you need validation.

##### `$isTypeOf(data)` - Type Discriminator

Discriminates (pre-validated) data based on its `$type` property, without re-validating. This is especially useful when working with union types:

```typescript
import { l } from '@atproto/lex'
import * as app from './lexicons/app.js'

declare const data:
  | app.bsky.feed.post.Main
  | app.bsky.feed.like.Main
  | l.Unknown$TypedObject

// Discriminate by $type without re-validating
if (app.bsky.feed.post.$isTypeOf(data)) {
  // data is a post
}
```

#### Universal validation helpers

##### `$matches(data)` - Type Guard

Returns `true` if data matches the schema, `false` otherwise. Acts as a TypeScript type guard:

```typescript
import { l } from '@atproto/lex'
import * as app from './lexicons/app.js'

const data: unknown = {
  $type: 'app.bsky.feed.post',
  text: 'Hello!',
  createdAt: l.currentDatetimeString(),
}

if (app.bsky.feed.post.$matches(data)) {
  // TypeScript knows data is a Post here
  console.log(data.text)
}
```

> [!NOTE]
>
> Performs validation so [`$isTypeOf`](#istypeofdata---type-discriminator) is preferred for pre-validated & properly typed data.

##### `$assert(data)` - Type-Narrowing Assertion

Throws if `data` does not match the schema. When the schema is statically known (e.g. `app.bsky.feed.post`), TypeScript narrows the type of `data` after the call:

```typescript
import { l } from '@atproto/lex'
import * as app from './lexicons/app.js'

const data: unknown = {
  $type: 'app.bsky.feed.post',
  text: 'Hello!',
  createdAt: l.currentDatetimeString(),
}

app.bsky.feed.post.$assert(data)

// TypeScript now knows data is app.bsky.feed.post.Main
console.log(data.text)
```

For library code that operates on a schema parameter whose type cannot be fully expressed, see [Validating Generic Schemas with `$check`](#validating-generic-schemas-with-check).

##### `$parse(data)` - Parse and Validate

Validates and returns typed data, throwing an error if validation fails:

```typescript
import { l } from '@atproto/lex'
import * as app from './lexicons/app.js'

try {
  const post = app.bsky.feed.post.$parse({
    $type: 'app.bsky.feed.post',
    text: 'Hello!',
    createdAt: l.currentDatetimeString(),
  })

  // post is now typed and validated
  console.log(post.text)
} catch (error) {
  console.error('Validation failed:', error)
}
```

> [!NOTE]
>
> The `$parse` method will apply defaults defined in the schema for optional fields, as well as data coercion (e.g., CID strings to Cid types). This means that the returned value might be different from the input data if defaults were applied. Use `$validate()` for value validation.

##### `$validate(data)` - Validate a value against the schema

Validates an existing value against a schema, returning the value itself if, and only if, it already matches the schema (ie. without applying defaults or coercion).

```typescript
import { l } from '@atproto/lex'
import * as app from './lexicons/app.js'

const value = {
  $type: 'app.bsky.feed.post',
  text: 'Hello!',
  createdAt: l.currentDatetimeString(),
}

// Throws if no valid
const result = app.bsky.feed.post.$validate(value)

value === result // true
```

##### `$safeParse(data, options?)` - Parse a value against a schema and get the resulting value

Returns a detailed validation result object without throwing:

```typescript
import { l } from '@atproto/lex'
import * as app from './lexicons/app.js'

const result = app.bsky.feed.post.$safeParse({
  $type: 'app.bsky.feed.post',
  text: 'Hello!',
  createdAt: l.currentDatetimeString(),
})

if (result.success) {
  console.log('Valid post:', result.value)
} else {
  console.error('Validation failed:', result.error)
}
```

All schema methods that perform validation (`$parse`, `$safeParse`, `$validate`, `$safeValidate`) accept an optional `{ strict }` option. When `strict` is `false`, validation becomes more lenient: datetime string format checks are relaxed (e.g. datetimes without timezones are accepted; other string formats remain strict), blob MIME type and size constraints are not enforced, non-raw CIDs are allowed in blob references, and legacy blob reference format (objects with `cid` and `mimeType` properties) is accepted. This is primarily used internally by the XRPC client when `strictResponseProcessing` is disabled, but can also be used directly:

```typescript
// Strict mode (default) - rejects datetime without timezone
app.bsky.feed.post.$safeParse(data) // { strict: true } is the default

// Non-strict mode - accepts more lenient data
app.bsky.feed.post.$safeParse(data, { strict: false })
```

## Data Model

The AT Protocol uses a [data model](https://atproto.com/specs/data-model) that extends JSON with two additional data structures: **CIDs** (content-addressed links) and **bytes** (for raw data). This data model can be encoded either as JSON for XRPC (HTTP API) or as [CBOR](https://dasl.ing/drisl.html) for storage and authentication (see [`@atproto/lex-cbor`](../lex-cbor)).

### Types

The package exports TypeScript types and type guards for working with the data model:

```typescript
import type {
  LexValue,
  LexMap,
  LexScalar,
  TypedLexMap,
  Cid,
} from '@atproto/lex'
import { isLexValue, isLexMap, isTypedLexMap, isCid } from '@atproto/lex'

// LexScalar: number | string | boolean | null | Cid | Uint8Array
// LexValue:  LexScalar | LexValue[] | { [key: string]?: LexValue }
// LexMap:    { [key: string]?: LexValue }
// TypedLexMap: LexMap & { $type: string }
// Cid: Content Identifier (link by hash)

if (isTypedLexMap(data)) {
  console.log(data.$type) // some string
}
```

### JSON Encoding

In JSON, CIDs are represented as `{"$link": "bafyrei..."}` and bytes as `{"$bytes": "base64..."}`. This package provides utilities to parse and stringify data model values to/from JSON:

```typescript
import { Cid, lexParse, lexStringify, jsonToLex, lexToJson } from '@atproto/lex'

// Parse JSON string → data model (decodes $link and $bytes)
const parsed = lexParse<{
  ref: Cid
  data: Uint8Array
}>(`{
  "ref": { "$link": "bafyrei..." },
  "data": { "$bytes": "SGVsbG8sIHdvcmxkIQ==" }
}`)

assert(isCid(parsed.ref))
assert(parsed.data instanceof Uint8Array)

const someCid = lexParse<Cid>('{"$link": "bafyrei..."}')
const someBytes = lexParse<Uint8Array>('{"$bytes": "SGVsbG8sIHdvcmxkIQ=="}')

// Data model → JSON string (encodes CIDs and bytes)
const json = lexStringify({ ref: someCid, data: someBytes })

// Convert between parsed JSON objects and data model values
const lex = jsonToLex({
  ref: { $link: 'bafyrei...' }, // Converted to Cid
  data: { $bytes: 'SGVsbG8sIHdvcmxkIQ==' }, // Converted to Uint8Array
})

const obj = lexToJson({
  ref: someCid, // Converted to { $link: string }
  data: someBytes, // Converted to { $bytes: string }
})
```

### CBOR Encoding

Use `@atproto/lex-cbor` to encode/decode the data model to/from CBOR ([DRISL](https://dasl.ing/drisl.html)) format for storage and authentication:

```typescript
import { encode, decode } from '@atproto/lex-cbor'
import type { LexValue } from '@atproto/lex'

// Encode data model to CBOR bytes
const cborBytes = encode(someLexValue)

// Decode CBOR bytes to data model
const lexValue: LexValue = decode(cborBytes)
```

## Making simple XRPC Requests

[XRPC](https://atproto.com/specs/xrpc) (short for "Lexicon RPC") is the set of HTTP conventions used by AT Protocol for client-server and server-server communication. Endpoints follow the pattern `/xrpc/<nsid>`, where the NSID maps to a Lexicon schema that defines the request and response types. XRPC has three method types: **queries** (HTTP GET) for read operations, **procedures** (HTTP POST) for mutations and **subscriptions** (WebSockets) for real-time updates.

The `xrpc()` and `xrpcSafe()` functions can be used to make simple XRPC requests. They are typically used in places that don't require an authenticated session, or when more granular control over the request/response is needed. For most use cases, the `Client` API provides a more ergonomic way to work with XRPC in the context of an authenticated session.

```typescript
import { xrpc, xrpcSafe } from '@atproto/lex'
import * as com from './lexicons/com.js'

const response = await xrpc(
  'https://bsky.network',
  com.atproto.identity.resolveHandle,
  {
    params: { handle: 'atproto.com' },
    headers: { 'user-agent': 'MyApp/1.0.0' },
  },
)

response.status // number
response.headers // Headers
response.body.did // `did:${string}:${string}`

// Or use the safe variant (returns errors instead of throwing)
const result = await xrpcSafe(
  'https://bsky.network',
  com.atproto.identity.resolveHandle,
  {
    params: { handle: 'atproto.com' },
    signal: AbortSignal.timeout(5000), // Abort after 5 seconds
  },
)

if (result.success) {
  console.log(result.body)
} else {
  console.error(result.error) // XRPC error code
  console.error(result.message) // Error message
}
```

Both `xrpc()` and `xrpcSafe()` accept `validateRequest`, `validateResponse`, and `strictResponseProcessing` options to control validation and strictness per-call. See [Validation and Strictness Options](#validation-and-strictness-options) for details.

## Client API

The `Client` class provides high-level helpers for common AT Protocol "repo" operations: `create()`, `get()`, `put()`, `delete()`, `list()`, `uploadBlob()`, and more. A `Client` instance is typically useful for making requests in the context of an authenticated user session, as it automatically handles headers and provides default values based on the authenticated user's DID.

A `Client` instance is also useful to encapsulate configuration for a specific service, by specifying the `service` option (for proxying) and `labelers` option (for content labeling). These act as _defaults_ for the client's requests and can be overridden — or disabled with `null` — on a per-request basis, allowing a single client to talk both to a proxied service (e.g. an AppView) and directly to the user's PDS.

### Creating a Client

#### Unauthenticated Client

Just provide the service URL:

```typescript
import { Client } from '@atproto/lex'

const client = new Client('https://public.api.bsky.app')
```

#### Authenticated Client with OAuth

```typescript
import { Client } from '@atproto/lex'
import { OAuthClient } from '@atproto/oauth-client-node'

// Setup OAuth client (see @atproto/oauth-client documentation)
const oauthClient = new OAuthClient({
  /* ... */
})
const session = await oauthClient.restore(userDid)

// Create authenticated client
const client = new Client(session)
```

For detailed OAuth setup, see the [@atproto/oauth-client](../../../oauth/oauth-client) documentation.

#### Authenticated Client with Password

For CLI tools, scripts, and bots, you can use password-based authentication with [`@atproto/lex-password-session`](../lex-password-session):

```typescript
import { Client } from '@atproto/lex'
import { PasswordSession } from '@atproto/lex-password-session'

const session = await PasswordSession.login({
  service: 'https://bsky.social',
  identifier: 'alice.bsky.social',
  password: 'xxxx-xxxx-xxxx-xxxx', // App password
  onUpdated: (data) => saveToStorage(data),
  onDeleted: (data) => clearStorage(data.did),
})

const client = new Client(session)
```

For detailed password session setup, see the [@atproto/lex-password-session](../lex-password-session) documentation.

#### Client with Service Proxy (authenticated only)

```typescript
import { Client } from '@atproto/lex'

// Route requests through a specific service
const client = new Client(session, {
  service: 'did:web:api.bsky.app#bsky_appview',
})
```

#### Validation and Strictness Options

The `Client` constructor accepts options to control request/response validation and how invalid Lex data is handled. These defaults apply to all XRPC calls made through the client, and can be overridden per-call via `client.call()`, `client.xrpc()` or `client.xrpcSafe()`.

```typescript
const client = new Client(session, {
  // Validate requests against the method's input schema (default: false)
  validateRequest: true,

  // Validate responses against the method's output schema (default: true)
  validateResponse: true,

  // Strictly process responses according to Lex encoding rules. When set to
  // false, accepts responses containing invalid Lex data such as floats or
  // malformed $bytes/$link objects (default: true)
  strictResponseProcessing: false,
})
```

- **`validateRequest`** — When `true`, outgoing request bodies are validated against the Lexicon input schema before sending. Useful in development to catch errors early. Default: `false`.
- **`validateResponse`** — When `true`, incoming response bodies are validated against the Lexicon output schema. Disabling this can improve performance when you trust the upstream service. Default: `true`.
- **`strictResponseProcessing`** — When `true` (default), the client will strictly process responses according to Lex encoding rules, rejecting responses containing invalid Lex data (e.g. floating-point numbers, malformed `$bytes` or `$link` objects). When `false`, the client accepts such responses in a lenient mode: invalid values are returned as-is rather than being rejected or converted, `datetime` string format checks become more lenient (e.g. datetimes without timezones are accepted) while other string formats remain strict, blob MIME type and size constraints are not enforced, and legacy blob reference format (objects with `cid` and `mimeType` properties) is accepted. Default: `true`.

### Core Methods

#### `client.call()`

Call procedures or queries defined in Lexicons.

```typescript
import * as app from './lexicons/app.js'

// Query (GET request)
const profile = await client.call(app.bsky.actor.getProfile, {
  actor: 'pfrazee.com',
})

// Procedure (POST request)
const result = await client.call(app.bsky.feed.sendInteractions, {
  interactions: [
    /* ... */
  ],
})

// With options
const timeline = await client.call(
  app.bsky.feed.getTimeline,
  {
    limit: 50,
  },
  {
    signal: abortSignal,
  },
)
```

#### `client.create()`

Create a new record un the authenticated user's repo.

```typescript
import { l } from '@atproto/lex'
import * as app from './lexicons/app.js'

const result = await client.create(app.bsky.feed.post, {
  text: 'Hello, world!',
  createdAt: l.currentDatetimeString(),
})

console.log(result.uri) // at://did:plc:...
console.log(result.cid)
```

Options:

- `rkey` - Custom record key (auto-generated if not provided)
- `validate` - Tri-state instruction to the PDS. `true` forces server-side schema validation, `false` explicitly disables it, and `undefined` (default) lets the PDS decide (it validates only collections whose schemas it knows)
- `validateRequest` - Validate the record locally against schema before submitting the request
- `swapCommit` - CID for optimistic concurrency control

#### `client.get()`

Retrieve a record.

```typescript
import * as app from './lexicons/app.js'

// No need to specify the "rkey" for records with literal keys (e.g. profile)
const profile = await client.get(app.bsky.actor.profile)

console.log(profile.displayName)
console.log(profile.description)
```

For records with non-literal keys:

```typescript
const post = await client.get(app.bsky.feed.post, {
  rkey: '3jxf7z2k3q2',
})
```

#### `client.put()`

Update an existing record.

```typescript
import * as app from './lexicons/app.js'

await client.put(app.bsky.actor.profile, {
  displayName: 'New Name',
  description: 'Updated bio',
})
```

Options:

- `rkey` - Record key (required for non-literal keys)
- `validate` - Tri-state instruction to the PDS. `true` forces server-side schema validation, `false` explicitly disables it, and `undefined` (default) lets the PDS decide (it validates only collections whose schemas it knows)
- `validateRequest` - Validate the record locally against schema before submitting the request
- `swapCommit` - Expected repo commit CID
- `swapRecord` - Expected record CID

#### `client.delete()`

Delete a record.

```typescript
import * as app from './lexicons/app.js'

await client.delete(app.bsky.feed.post, {
  rkey: '3jxf7z2k3q2',
})
```

#### `client.list()`

List records in a collection.

```typescript
import * as app from './lexicons/app.js'

const result = await client.list(app.bsky.feed.post, {
  limit: 50,
  reverse: true,
})

for (const record of result.records) {
  console.log(record.uri, record.value.text)
}

// Records that failed local schema validation are returned separately
for (const invalid of result.invalid) {
  console.warn('Invalid record:', invalid)
}

// Pagination
if (result.cursor) {
  const nextPage = await client.list(app.bsky.feed.post, {
    cursor: result.cursor,
    limit: 50,
  })
}
```

The result includes:

- `records` - Records that successfully validated against the schema
- `invalid` - Records returned by the server that failed local schema validation (raw `LexMap` values)
- `cursor` - Pagination cursor (if more results are available)

#### `client.applyWrites()`

Perform an atomic batch of create, update, and delete operations in a single request.

```typescript
import { l } from '@atproto/lex'
import * as app from './lexicons/app.js'

const response = await client.applyWrites((op) => [
  // Create a new post
  op.create(app.bsky.feed.post, {
    text: 'Hello, world!',
    createdAt: l.currentDatetimeString(),
  }),

  // Update profile
  op.update(app.bsky.actor.profile, {
    displayName: 'Alice',
    description: 'Updated bio',
  }),

  // Delete an existing post by rkey
  op.delete(app.bsky.feed.post, {
    rkey: '3jxf7z2k3q2',
  }),
])

// Check results
for (const result of response.body.results) {
  console.log(result.uri, result.cid)
}
```

Options:

- `repo` - Repository identifier (defaults to authenticated user's DID)
- `validate` - Tri-state instruction to the PDS. `true` forces server-side schema validation, `false` explicitly disables it, and `undefined` (default) lets the PDS decide (it validates only collections whose schemas it knows)
- `swapCommit` - CID for optimistic concurrency control

> [!NOTE]
>
> All operations in an `applyWrites()` call are atomic - they either all succeed or all fail together. This is useful for maintaining consistency when making multiple related changes.

### Error Handling

By default, all client methods throw errors when requests fail. For more ergonomic error handling, the client provides "Safe" variants that return errors instead of throwing them.

#### Safe Methods

The `xrpcSafe()` method catches errors and returns them as part of the result type instead of throwing:

#### XrpcFailure Type

The `xrpcSafe()` method returns a union type that includes the success case (`XrpcResponse`) and failure cases (`XrpcFailure`):

```typescript
import {
  Client,
  XrpcResponseError,
  XrpcInvalidResponseError,
  XrpcInternalError,
} from '@atproto/lex'
import * as com from './lexicons/com.js'

const client = new Client(session)

// Using a safe method
const result = await client.xrpcSafe(com.atproto.identity.resolveHandle, {
  params: { handle: 'alice.bsky.social' },
})

if (result.success) {
  // Handle success
  console.log(result.body)
} else {
  // Handle failure - result is an XrpcFailure.
  //
  // All XrpcFailure subclasses inherit from XrpcError and share these members:
  result.error // string error code (e.g. "HandleNotFound", "UpstreamFailure")
  result.message // string
  result.shouldRetry() // boolean - whether the error is transient

  if (result.matchesSchemaErrors()) {
    // Check if the error matches a declared error in the schema.
    // TypeScript narrows `result.error` to one of the method's declared error codes.
    result.error // "HandleNotFound"
  }

  // Branch on the specific error class to access additional members:
  if (result instanceof XrpcResponseError) {
    // The server responded with an error status code (4xx or 5xx).
    // This is used for all error responses, whether or not they have a valid XRPC error payload.
    result.response.status // number
    result.response.headers // Headers
    result.payload // undefined | { body: unknown; encoding: string }

    // Coerce to a valid XRPC error payload using toJSON():
    result.toJSON() // { error: string, message?: string }
  } else if (result instanceof XrpcInvalidResponseError) {
    // The response was truly invalid (3xx redirect, malformed JSON, schema mismatch, etc.).
    // This is a more specific error for responses that are not processable.
    result.response.status // number
    result.response.headers // Headers
    result.payload // undefined | { body: unknown; encoding: string }
  } else if (result instanceof XrpcInternalError) {
    // Something went wrong on the client side (network error, etc.)
  }
}
```

The `XrpcFailure<M>` type is a union of three error classes:

1. **`XrpcResponseError`** - The server responded with a 4xx/5xx error status code. This is used for all error responses from the upstream server.

2. **`XrpcInvalidResponseError`** - The upstream server returned a 2xx/3xx that does not comply with XRPC specifications for successful responses. A sub-class, `XrpcResponseValidationError`, is used for payload schema validation failures specifically.

3. **`XrpcInternalError`** - Client-side errors (network failures, timeouts, etc.)

### Authentication Methods

#### `client.did`

Get the authenticated user's DID.

```typescript
const did = client.did // Returns Did | undefined
```

#### `client.assertAuthenticated()`

Assert that the client is authenticated (throws if not).

```typescript
client.assertAuthenticated()
// After this call, TypeScript knows client.did is defined
const did = client.did // Type: Did (not undefined)
```

#### `client.assertDid`

Get the authenticated user's DID, asserting that the client is authenticated.

```typescript
const did = client.assertDid // Type: Did (throws if not authenticated)
```

This is equivalent to calling `client.assertAuthenticated()` followed by accessing `client.did`, but provides a more concise way to get the DID when you know authentication is required.

### Labeler Configuration

Configure content labelers for moderation.

```typescript
import { Client } from '@atproto/lex'

// Global app-level labelers
Client.configure({
  appLabelers: ['did:plc:labeler1', 'did:plc:labeler2'],
})

// Client-specific labelers
const client = new Client(session, {
  labelers: ['did:plc:labeler3'],
})

// Add labelers dynamically
client.addLabelers(['did:plc:labeler4'])

// Replace all labelers
client.setLabelers(['did:plc:labeler5'])

// Clear labelers
client.clearLabelers()
```

The client's `labelers` act as a default for its requests. A per-request `labelers` option replaces that default for that request, and `labelers: null` disables the `atproto-accept-labelers` header entirely:

```typescript
// Uses the client's labelers
await client.call(app.bsky.actor.getProfile, { actor })

// Uses only 'did:plc:other' for this request
await client.xrpc(app.bsky.actor.getProfile, {
  params: { actor },
  labelers: ['did:plc:other'],
})

// No atproto-accept-labelers header for this request (except appLabelers,
// which are applied unless explicitly disabled)
await client.xrpc(app.bsky.actor.getProfile, {
  params: { actor },
  labelers: null,
})
```

App-level labelers (`appLabelers`) are always added to the `atproto-accept-labelers` header with the `;redact` param. They default to the static `Client.appLabelers` (set via `Client.configure()`), and can be overridden through the client's or a request's `appLabelers` option (`appLabelers: null` disables them for that client or request).

The same defaulting logic applies to the `service` option (`atproto-proxy` header): a per-request `service` replaces the client's default, and `service: null` disables proxying for that request.

### Low-Level XRPC

For advanced use cases, use `client.xrpc()` to get the full response (headers, status, body):

```typescript
import * as app from './lexicons/app.js'

const response = await client.xrpc(app.bsky.feed.getTimeline, {
  params: { limit: 50 },
  signal: abortSignal,
  headers: { 'custom-header': 'value' },
})

console.log(response.status)
console.log(response.headers)
console.log(response.body)
```

Validation and strictness options (`validateRequest`, `validateResponse`, `strictResponseProcessing`) can also be passed per-call to override the client defaults:

```typescript
const response = await client.xrpc(app.bsky.feed.getTimeline, {
  params: { limit: 50 },
  strictResponseProcessing: false, // Accept non-strict Lex data for this call
  validateResponse: false, // Skip schema validation for this call
})
```

## Utilities

Various utilities for working with CIDs, datetime strings, string lengths, language tags, and low-level JSON encoding are exported from the package:

```typescript
import {
  // CID utilities
  parseCid, // Parse CID string (throws on invalid)
  ifCid, // Coerce to Cid or null
  isCid, // Type guard for Cid values

  // Datetime string utilities
  toDatetimeString, // Convert Date to DatetimeString (throws on invalid)
  asDatetimeString, // Cast string to DatetimeString (throws on invalid)
  isDatetimeString, // Type guard for DatetimeString
  ifDatetimeString, // Returns DatetimeString or undefined

  // Blob references
  BlobRef, // TypedBlobRef | LegacyBlobRef
  LegacyBlobRef, // { cid: string, mimeType: string }
  TypedBlobRef, // { $type: 'blob', ref: Cid, mimeType: string, size: number }
  isBlobRef, // Type guard for BlobRef (accepts both TypedBlobRef and LegacyBlobRef)
  isLegacyBlobRef, // Type guard for LegacyBlobRef objects
  isTypedBlobRef, // Type guard for TypedBlobRef objects
  getBlobCid, // Extract Cid from BlobRef or LegacyBlobRef
  getBlobCidString, // Extract CID string from BlobRef or LegacyBlobRef
  getBlobMime, // Extract MIME type from BlobRef or LegacyBlobRef
  getBlobSize, // Extract size from BlobRef (returns undefined for LegacyBlobRef)

  // Equality
  lexEquals, // Deep equality (handles CIDs and bytes)

  // String length for Lexicon validation
  graphemeLen, // Count user-perceived characters
  utf8Len, // Count UTF-8 bytes

  // Language tag validation (BCP-47)
  isLanguageString, // Validate language tags (e.g., 'en', 'pt-BR')

  // Low-level JSON encoding helpers
  parseLexLink, // { $link: string } → Cid | undefined
  encodeLexLink, // Cid → { $link: string }
  parseLexBytes, // { $bytes: string } → Uint8Array | undefined
  encodeLexBytes, // Uint8Array → { $bytes: string }
} from '@atproto/lex'

const cid = parseCid('bafyreiabc...')
graphemeLen('👨‍👩‍👧‍👦') // 1
utf8Len('👨‍👩‍👧‍👦') // 25
isLanguageString('en-US') // true
```

### Datetime Strings

Many AT Protocol records (such as posts, likes, and follows) include a `createdAt` field that expects a valid `DatetimeString`. While `new Date().toISOString()` produces a string that looks like a valid datetime, it is not guaranteed to always conform to the AT Protocol's [datetime format requirements](https://atproto.com/specs/lexicon#datetime) (for example, `Date` objects representing dates before year 0 or after year 9999 will produce non-conforming strings). To ensure correctness and type safety, use the `DatetimeString` utilities exported from `@atproto/lex`:

- **`toDatetimeString(date: Date)`** - Converts a `Date` object into a valid `DatetimeString`, throwing an `InvalidDatetimeError` if the date cannot be represented as a valid AT Protocol datetime.
- **`asDatetimeString(input: string)`** - Validates and casts an arbitrary string to `DatetimeString`, throwing an `InvalidDatetimeError` if the string does not conform.
- **`isDatetimeString(input)`** - Type guard that returns `true` if the input is a valid `DatetimeString`.
- **`ifDatetimeString(input)`** - Returns the input as a `DatetimeString` if valid, or `undefined` otherwise.
- **`currentDatetimeString()`** - Returns the current date and time as `DatetimeString`.

```typescript
import { l } from '@atproto/lex'

// Convert a Date object to a DatetimeString (or throws)
const someDate = new Date('2024-01-15T12:30:00Z')
const now = l.toDatetimeString(someDate)

// Get the current datetime as a DatetimeString
const now = l.currentDatetimeString()

// Validate and cast an existing string
const dt = l.asDatetimeString('2024-01-15T12:30:00.000Z')

// Type guard for conditional checks
if (l.isDatetimeString(someString)) {
  // someString is now typed as DatetimeString
}
```

## Advanced Usage

### Workflow Integration

#### Development Workflow

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "update-lexicons": "lex install --update --save",
    "postinstall": "lex install --ci",
    "prebuild": "lex build",
    "build": "# Your build command here"
  }
}
```

This ensures that:

1. Lexicons are verified against the manifest after every `npm install` or `pnpm install`.
2. TypeScript schemas are built before your project is built.
3. You can easily update lexicons with `npm run update-lexicons` or `pnpm update-lexicons`.

### Tree-Shaking

The generated TypeScript code is structured to be tree-shakeable, but the way you reference schemas has a meaningful impact on the final bundle size. There are several ways to refer to a generated schema, and each comes with different trade-offs.

#### Namespace notation

The most ergonomic style is to use a namespace import and reference schemas through dotted paths:

```typescript
import * as com from './lexicons/com.js'

await client.call(com.atproto.repo.getRecord, {
  /* ... */
})
```

This style is convenient and reads naturally as it mirrors the NSID of the schema. However, it produces the largest bundles. From the bundler's point of view, `com.atproto.repo.getRecord` is the whole schema namespace (which contains the `main` schema as well as helpers, and any other definitions). The bundler cannot know that `client.call()` only consumes the `main` schema, so it has to keep the rest of the namespace alive in the bundle.

#### Explicit `.main` reference

You can mitigate the bundle-size cost by explicitly naming the `main` definition:

```typescript
import * as com from './lexicons/com.js'

await client.call(com.atproto.repo.getRecord.main, {
  /* ... */
})
```

This lets the bundler drop the sibling definitions inside `getRecord` that aren't referenced. The drawback is that it leaks an implementation detail: the `main` segment of the path. In Lexicon, `main` is typically implicit:

- Records use a `$type` of `app.bsky.feed.post` (no `#main`)
- XRPC endpoints are exposed as `/xrpc/com.atproto.repo.getRecord` (no `main`)

So writing `.main` in application code feels verbose compared to how Lexicons are normally referred to.

#### Direct named import from the schema file

You can also import the `main` schema directly from the file that defines it:

```typescript
import { main as getRecord } from './lexicons/com/atproto/repo/getRecord.js'

await client.call(getRecord, {
  /* ... */
})
```

This produces equally small bundles as the explicit `.main` reference, but it still surfaces the `main` identifier: you have to know to import `main` and likely rename it.

#### Default import (recommended)

To make the small-bundle path also the ergonomic path, every namespace file generated by `lex build` re-exports the `main` schema as its `default` export:

```typescript
// generated file: ./lexicons/com/atproto/repo/getRecord.js
export * from './getRecord.defs.js'
export { main as default } from './getRecord.defs.js'
```

This means you can write:

```typescript
import getRecord from './lexicons/com/atproto/repo/getRecord.js'
import post from './lexicons/app/bsky/feed/post.js'

await client.call(getRecord, {
  /* ... */
})
await client.create(post, {
  /* ... */
})
```

This is the most bundle-friendly style: the bundler only pulls in the `main` schema, and the import name doesn't have to mention `main` at all. This helps keeping application code aligned with how Lexicons are usually identified.

#### Drawbacks of the default export

The `default` re-export is enabled by default but has two minor drawbacks:

1. It is one additional property on the namespace module, which can very slightly increase bundle size if you also use the namespace in some places.
2. Any Lexicon document whose path segment is literally `default` (for example a hypothetical `com.example.records.default`) would conflict with the generated `default` export.

If either of these matters for your use case, you can disable the generation of `default` exports with the `--no-defaultExport` flag:

```bash
lex build --no-defaultExport
```

#### Summary

| Style                                                  | Bundle size | Ergonomics                   |
| ------------------------------------------------------ | ----------- | ---------------------------- |
| `com.atproto.repo.getRecord` (namespace)               | Largest     | Best: matches the NSID       |
| `com.atproto.repo.getRecord.main`                      | Small       | Leaks the `main` identifier  |
| `import { main as getRecord } from '.../getRecord.js'` | Small       | Verbose, leaks `main`        |
| `import getRecord from '.../getRecord.js'`             | Small       | Concise, no `main` in source |

For libraries and applications where bundle size matters (typically anything shipped to a browser), prefer the default-import style. For scripts, tests, and server-side code where the bundle size of generated schemas is not a concern, the namespace style is perfectly fine.

### Blob references

In AT Protocol, binary data (blobs) are referenced using blob references, which include metadata like MIME type and size. These references allow PDSs to determine which binary data ("files") is referenced by records.

#### TypedBlobRef: The Current Standard

The current standard format for blob references is `TypedBlobRef`:

```typescript
import { TypedBlobRef } from '@atproto/lex'

const blobRef: TypedBlobRef = {
  $type: 'blob',
  ref: parseCid('bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'),
  mimeType: 'image/png',
  size: 12345,
}
```

**When creating new blobs**, always use the `TypedBlobRef` format. This is the format returned by `client.uploadBlob()` and expected by PDS endpoints.

#### LegacyBlobRef: Historical Format

Historically, blob references used a simpler format without the `$type` property:

```typescript
type LegacyBlobRef = {
  cid: string // CID as a string (not a Cid object)
  mimeType: string // No size property
}
```

**Legacy blob references still exist in the AT Protocol network** in older records created before the format migration. While new blobs should always be created as `TypedBlobRef`, your code must be prepared to handle both formats when reading existing data.

#### Working with Both Formats

The `BlobRef` type is a union that accepts both formats:

```typescript
import {
  BlobRef,
  isBlobRef,
  isTypedBlobRef,
  isLegacyBlobRef,
} from '@atproto/lex'

// When reading data, always use BlobRef to handle both formats
function processBlobRef(blob: BlobRef) {
  if (isTypedBlobRef(blob)) {
    console.log('Modern blob:', blob.ref, blob.mimeType, blob.size)
  } else if (isLegacyBlobRef(blob)) {
    console.log('Legacy blob:', blob.cid, blob.mimeType)
  }
}

// Or use the isBlobRef type guard which accepts both
if (isBlobRef(value)) {
  // value is BlobRef (either TypedBlobRef or LegacyBlobRef)
}
```

Helper functions work with both formats:

```typescript
import {
  getBlobCid,
  getBlobCidString,
  getBlobMime,
  getBlobSize,
} from '@atproto/lex'

// These utilities work with both TypedBlobRef and LegacyBlobRef
const cid = getBlobCid(blobRef) // Returns Cid object
const cidStr = getBlobCidString(blobRef) // Returns string (optimized)
const mime = getBlobMime(blobRef) // Returns mimeType
const size = getBlobSize(blobRef) // Returns number | undefined (legacy refs lack size)
```

> [!IMPORTANT]
>
> **Validation behavior with legacy blobs:**
>
> - In **strict mode** (`strict: true`, the default): Legacy blob references are rejected during validation. Use this mode when you control the data source and expect only modern blobs.
> - In **non-strict mode** (`strict: false`): Legacy blob references are accepted. This mode is used automatically when `strictResponseProcessing: false` is set on the Client, allowing your application to handle older records from the network gracefully.
>
> ```typescript
> // Strict mode (default) - rejects legacy blobs
> schema.$safeParse(data) // { strict: true }
>
> // Non-strict mode - accepts legacy blobs
> schema.$safeParse(data, { strict: false })
> ```

### Actions

Actions are composable functions that combine multiple XRPC calls into higher-level operations. They can be invoked using `client.call()` just like Lexicon methods, making them a powerful tool for building library-style APIs on top of the low-level client.

#### What are Actions?

An `Action` is a function with this signature:

```typescript
type Action<Input, Output> = (
  client: Client,
  input: Input,
  options: ActionOptions,
) => Output | Promise<Output>
```

Actions receive:

- `client` - The Client instance (to make XRPC calls)
- `input` - The input data for the action
- `options` - `ActionOptions` (currently just `{ signal?: AbortSignal }`)

#### Using Actions

Actions are called using `client.call()`, the same method used for XRPC queries and procedures:

```typescript
import { Action, Client, l } from '@atproto/lex'
import * as app from './lexicons/app.js'

// Define an action
export const likePost: Action<
  { uri: string; cid: string },
  { uri: string; cid: string }
> = async (client, { uri, cid }, options) => {
  client.assertAuthenticated()

  const result = await client.create(
    app.bsky.feed.like,
    {
      subject: { uri, cid },
      createdAt: l.currentDatetimeString(),
    },
    options,
  )

  return result
}

// Use the action
const client = new Client(session)
const like = await client.call(likePost, {
  uri: 'at://did:plc:abc/app.bsky.feed.post/123',
  cid: 'bafyreiabc...',
})
```

#### Composing Multiple Operations

Actions excel at combining multiple XRPC calls:

```typescript
import { Action, Client } from '@atproto/lex'
import * as app from './lexicons/app.js'

type Preference = app.bsky.actor.defs.Preferences[number]

// Action that reads, modifies, and writes preferences
const upsertPreference: Action<Preference, Preference[]> = async (
  client,
  newPref,
  options,
) => {
  // Read current preferences
  const { preferences } = await client.call(
    app.bsky.actor.getPreferences,
    options,
  )

  // Update the preference list
  const updated = [
    ...preferences.filter((p) => p.$type !== newPref.$type),
    newPref,
  ]

  // Save updated preferences
  await client.call(
    app.bsky.actor.putPreferences,
    { preferences: updated },
    options,
  )

  return updated
}

// Use it
await client.call(
  upsertPreference,
  app.bsky.actor.defs.adultContentPref.build({ enabled: true }),
)
```

#### Higher-Order Actions

Actions can call other actions, enabling powerful composition:

```typescript
import { Action } from '@atproto/lex'
import * as app from './lexicons/app.js'

type Preference = app.bsky.actor.defs.Preferences[number]

// Low-level action: update preferences with a function
const updatePreferences: Action<
  (prefs: Preference[]) => Preference[] | false,
  Preference[]
> = async (client, updateFn, options) => {
  const { preferences } = await client.call(
    app.bsky.actor.getPreferences,
    options,
  )

  const updated = updateFn(preferences)
  if (updated === false) return preferences

  await client.call(
    app.bsky.actor.putPreferences,
    { preferences: updated },
    options,
  )

  return updated
}

// Higher-level action: upsert a specific preference
const upsertPreference: Action<Preference, Preference[]> = async (
  client,
  pref,
  options,
) => {
  return updatePreferences(
    client,
    (prefs) => [...prefs.filter((p) => p.$type !== pref.$type), pref],
    options,
  )
}

// Even higher-level: enable adult content
const enableAdultContent: Action<void, Preference[]> = async (
  client,
  _,
  options,
) => {
  return upsertPreference(
    client,
    app.bsky.actor.defs.adultContentPref.build({ enabled: true }),
    options,
  )
}

// Use the high-level action
await client.call(enableAdultContent)
```

### Using a Single Client for Multiple Services

Because the client's `service` and `labelers` options are just _defaults_, a single `Client` instance can be used to talk to multiple services. This is the recommended pattern for SDK-style code: configure the client to talk to an AppView by default, and override `service` on a per-request basis when a request must reach another service — or the user's PDS directly (`service: null`).

```typescript
import { Client } from '@atproto/lex'
import * as app from './lexicons/app.js'
import * as com from './lexicons/com.js'

const client = new Client(session, {
  // All requests are proxied to the AppView by default
  service: 'did:web:api.bsky.app#bsky_appview',
})

// Proxied to the AppView (client default)
const { feed } = await client.call(app.bsky.feed.getTimeline)

// Sent directly to the user's PDS (no atproto-proxy header)
const { body } = await client.xrpc(com.atproto.repo.getRecord, {
  service: null,
  params: {
    repo: client.assertDid,
    collection: 'app.bsky.actor.profile',
    rkey: 'self',
  },
})

// Proxied to a different service, just for this request
await client.xrpc(app.bsky.actor.getProfile, {
  service: 'did:web:com.example.other#other_service',
  params: { actor: client.assertDid },
})
```

> [!NOTE]
>
> The record helpers (`create()`, `get()`, `put()`, `delete()`, `list()`, `createRecord()`, `getRecord()`, `putRecord()`, `deleteRecord()`, `listRecords()`, `applyWrites()`, `uploadBlob()`, `getBlob()`) always target the user's PDS: they default to `service: null` and `labelers: null`, ignoring the client's instance-wide defaults (unless explicitly overridden in their options).

If you need clients with different configurations sharing the same authentication, create them from the same session (or reuse an existing client's `agent`):

```typescript
const pdsClient = new Client(session)
const bskyClient = new Client(pdsClient.agent, {
  service: 'did:web:api.bsky.app#bsky_appview',
})
```

> [!NOTE]
>
> In previous version of this library, `Client` implemented the `Agent` interface, and its `fetchHandler` method could be used as the agent of another `Client`. This lead to confusing bugs ([#5110](https://github.com/bluesky-social/atproto/issues/5110)) where the inner agent (client) would set `atproto-proxy` and `atproto-accept-labelers` headers on requests where the outer client explicitly set `service: null` and `labelers: null`. This is no longer the case: a `Client` can no longer be used as the agent of another `Client`. To share authentication between differently-configured clients, build them from the same session.

### Building Library-Style APIs with Actions

Actions enable you to create high-level, convenience APIs similar to [@atproto/api](https://www.npmjs.com/package/@atproto/api)'s `Agent` class. Here are patterns for common operations:

#### Creating Posts

```typescript
import { Action, l } from '@atproto/lex'
import * as app from './lexicons/app.js'

type PostInput = Partial<app.bsky.feed.post.Main> &
  Omit<app.bsky.feed.post.Main, 'createdAt'>

export const post: Action<PostInput, { uri: string; cid: string }> = async (
  client,
  record,
  options,
) => {
  return client.create(
    app.bsky.feed.post,
    {
      ...record,
      createdAt: record.createdAt || l.currentDatetimeString(),
    },
    options,
  )
}

// Usage
await client.call(post, {
  text: 'Hello, AT Protocol!',
  langs: ['en'],
})
```

#### Following Users

```typescript
import { Action, l } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import * as app from './lexicons/app.js'

export const follow: Action<
  { did: string },
  { uri: string; cid: string }
> = async (client, { did }, options) => {
  return client.create(
    app.bsky.graph.follow,
    {
      subject: did,
      createdAt: l.currentDatetimeString(),
    },
    options,
  )
}

export const unfollow: Action<{ followUri: string }, void> = async (
  client,
  { followUri },
  options,
) => {
  const uri = new AtUri(followUri)
  await client.delete(app.bsky.graph.follow, {
    ...options,
    rkey: uri.rkey,
  })
}

// Usage
const { uri } = await client.call(follow, { did: 'did:plc:abc123' })
await client.call(unfollow, { followUri: uri })
```

#### Updating Profile with Retry Logic

```typescript
import { Action, XrpcResponseError } from '@atproto/lex'
import * as app from './lexicons/app.js'
import * as com from './lexicons/com.js'

type ProfileUpdate = Partial<Omit<app.bsky.actor.profile.Main, '$type'>>

export const updateProfile: Action<ProfileUpdate, void> = async (
  client,
  updates,
  options,
) => {
  const maxRetries = 5
  for (let attempt = 0; ; attempt++) {
    try {
      // Get current profile and its CID
      const res = await client.xrpc(com.atproto.repo.getRecord, {
        ...options,
        params: {
          repo: client.assertDid,
          collection: 'app.bsky.actor.profile',
          rkey: 'self',
        },
      })

      const current = app.bsky.actor.profile.$safeValidate(res.body.record)

      // Merge updates with current profile (if valid)
      const updated = app.bsky.actor.profile.$build({
        ...(current.success ? current.value : undefined),
        ...updates,
      })

      // Save with optimistic concurrency control
      await client.put(app.bsky.actor.profile, updated, {
        ...options,
        swapRecord: res?.body.cid ?? null,
      })

      return
    } catch (error) {
      // Retry on swap/concurrent modification errors
      if (
        error instanceof XrpcResponseError &&
        error.name === 'SwapError' &&
        attempt < maxRetries - 1
      ) {
        continue
      }

      throw error
    }
  }
}

// Usage
await client.call(updateProfile, {
  displayName: 'Alice',
  description: 'Software engineer',
})
```

#### Packaging Actions as a Library

Create a collection of actions for your application:

```typescript
// actions.ts
import { Action, Client } from '@atproto/lex'
import * as app from './lexicons/app.js'

export const post: Action</* ... */> = async (client, input, options) => {
  /* ... */
}
export const like: Action</* ... */> = async (client, input, options) => {
  /* ... */
}
export const follow: Action</* ... */> = async (client, input, options) => {
  /* ... */
}
export const updateProfile: Action</* ... */> = async (
  client,
  input,
  options,
) => {
  /* ... */
}
```

Usage:

```typescript
import * as actions from './actions.js'

await client.call(actions.post, { text: 'Hello!' })
```

#### Best Practices for Actions

1. **Type Safety**: Always provide explicit type parameters for `Action<Input, Output>`
2. **Authentication**: Use `client.assertAuthenticated()` when auth is required
3. **Abort Signals**: Check `options.signal?.throwIfAborted()` between long operations
4. **Composition**: Build complex actions from simpler ones
5. **Retries**: Implement retry logic for operations with optimistic concurrency control
6. **Tree-shaking**: Export actions individually to allow tree-shaking (instead of bundling them in a single class)

### Standard Schema Compatibility

All generated schemas implement the [Standard Schema](https://standardschema.dev/) interface (`StandardSchemaV1`), which means they can be used with any library or framework that supports Standard Schema, such as form validation libraries, API frameworks, and more.

Every `Schema` instance exposes a `~standard` property conforming to the spec:

```typescript
import * as app from './lexicons/app.js'

// Use with any Standard Schema-compatible library
const schema = app.bsky.feed.post

schema['~standard'].version // 1
schema['~standard'].vendor // '@atproto/lex-schema'

// Validate using the Standard Schema interface
const result = schema['~standard'].validate(someData)

if ('value' in result) {
  console.log(result.value) // Parsed and validated data
} else {
  console.error(result.issues)
}
```

When validated through the Standard Schema interface, schemas operate in "parse" mode, meaning transformations like defaults and coercions are applied to the output.

### Validating Generic Schemas with `$check`

`$check(data)` is the non-narrowing counterpart to [`$assert(data)`](#assertdata---type-narrowing-assertion): both throw when `data` does not match the schema, but `$check` does not refine the static type of its argument.

`$check` is rarely needed in application code — prefer `$assert`. It is intended for library-style code that takes a schema as a generic parameter, where TypeScript cannot satisfy the assertion-signature requirement and `$assert` produces the following error:

> 'schema' needs an explicit type annotation.
> Assertions require every name in the call target to be declared with an explicit type annotation. `ts(2775)`

In that situation, switch to `$check`:

```typescript
import type { Schema } from '@atproto/lex'

function ensureMatches<S extends Schema>(schema: S, data: unknown) {
  // schema.$assert(data) // ❌ ts(2775): needs an explicit type annotation
  schema.$check(data) // ✅ throws on invalid, no type narrowing
}
```

## License

MIT or Apache2
