# @atproto/lex

Type-safe Lexicon tooling for creating great API clients. See the [Changelog](./CHANGELOG.md) for version history.

```bash
npm install -g @atproto/lex
lex --help
```

- Install and manage Lexicon schemas
- Generate TypeScript client and data validators
- Handle common tasks like OAuth

> [!IMPORTANT]
>
> This package is currently in **preview**. The API and features are subject to change before the stable release.

**What is this?**

Working directly with XRPC endpoints requires manually tracking schema definitions, validation data structures, and managing authentication. `@atproto/lex` automates this by:

1. Fetching lexicons from the network and generating TypeScript types
2. Providing runtime validation to ensure data matches schemas
3. Offering a type-safe client that knows which parameters each endpoint expects
4. Support modern patterns like tree-shaking and composition

```typescript
const profile = await client.call(app.bsky.actor.getProfile, {
  actor: 'atproto.com',
})

await client.create(app.bsky.feed.post, {
  text: 'Hello, world!',
  createdAt: new Date().toISOString(),
})

const posts = await client.list(app.bsky.feed.post, {
  limit: 10,
  repo: 'atproto.com',
})

app.bsky.actor.profile.$validate({
  $type: 'app.bsky.actor.profile',
  displayName: 'Ha'.repeat(32) + '!',
}) // { success: false, error: Error: grapheme too big (maximum 64) at $.displayName (got 65) }
```

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Quick Start](#quick-start)
- [Lexicon Schemas](#lexicon-schemas)
- [TypeScript Schemas](#typescript-schemas)
  - [Generated Schema Structure](#generated-schema-structure)
  - [Type definitions](#type-definitions)
  - [Validation Helpers](#validation-helpers)
- [Client API](#client-api)
  - [Creating a Client](#creating-a-client)
  - [Core Methods](#core-methods)
  - [Error Handling](#error-handling)
  - [Authentication Methods](#authentication-methods)
  - [Labeler Configuration](#labeler-configuration)
  - [Low-Level XRPC](#low-level-xrpc)
- [Advanced Usage](#advanced-usage)
  - [Workflow Integration](#workflow-integration)
  - [Tree-Shaking](#tree-shaking)
  - [Custom Headers](#custom-headers)
  - [Request Options](#request-options)
  - [Actions](#actions)
  - [Building Library-Style APIs with Actions](#building-library-style-apis-with-actions)
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
> The `lex` command might conflict with other binaries intalled on your system.
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
import { Client } from '@atproto/lex'
import * as app from './lexicons/app.js'

// Create a client instance
const client = new Client('https://public.api.bsky.app')

// Start making requests using generated schemas
const response = await client.call(app.bsky.actor.getProfile, {
  actor: 'pfrazee.com',
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
- `--ignore-errors` - How to handle errors when processing input files
- `--pure-annotations` - Add `/*#__PURE__*/` annotations for tree-shaking tools. Set this to true if you are using generated lexicons in a library
- `--exclude <patterns...>` - List of strings or regex patterns to exclude lexicon documents by their IDs
- `--include <patterns...>` - List of strings or regex patterns to include lexicon documents by their IDs
- `--lib <package>` - Package name of the library to import the lex schema utility "l" from (default: `@atproto/lex`)
- `--allowLegacyBlobs` - Allow generating schemas that accept legacy blob references (disabled by default; enable this if you encounter issues while processing records created a long time ago)
- `--importExt <ext>` - File extension to use for import statements in generated files (default: `.js`). Use `--importExt ""` to generate extension-less imports
- `--fileExt <ext>` - File extension to use for generated files (default: `.ts`)

### Generated Schema Structure

Each Lexicon generates a TypeScript module with:

- **Type definitions** - TypeScript types extracted from the schema
- **Schema instances** - Runtime validation objects with methods
- **Exported utilities** - Convenience functions for common operations

### Type definitions

You can extract TypeScript types from the generated schemas for use in you application:

```typescript
import * as app from './lexicons/app.js'

// Extract the type for a post record
type Post = app.bsky.feed.post.Main

// Use the extracted types
const post: Post = {
  $type: 'app.bsky.feed.post',
  text: 'Hello, AT Protocol!',
  createdAt: new Date().toISOString(),
}
```

### Validation Helpers

Each schema provides multiple validation methods:

#### `$nsid` - Namespace Identifier

Returns the NSID of the schema:

```typescript
import * as app from './lexicons/app.js'

console.log(app.bsky.feed.defs.$nsid) // 'app.bsky.feed.defs'
```

#### `$type` - Type Identifier

Returns the `$type` string of the schema (for record and object schemas):

```typescript
import * as app from './lexicons/app.js'

console.log(app.bsky.feed.post.$type) // 'app.bsky.feed.post'
console.log(app.bsky.actor.defs.profileViewBasic.$type) // 'app.bsky.actor.defs#profileViewBasic'
```

#### `$check(data)` - Type Guard

Returns `true` if data matches the schema, `false` otherwise. Acts as a TypeScript type guard:

```typescript
import * as app from './lexicons/app.js'

const data = {
  $type: 'app.bsky.feed.post',
  text: 'Hello!',
  createdAt: new Date().toISOString(),
}

if (app.bsky.feed.post.$check(data)) {
  // TypeScript knows data is a Post here
  console.log(data.text)
}
```

#### `$parse(data)` - Parse and Validate

Validates and returns typed data, throwing an error if validation fails:

```typescript
import * as app from './lexicons/app.js'

try {
  const post = app.bsky.feed.post.$main.$parse({
    $type: 'app.bsky.feed.post',
    text: 'Hello!',
    createdAt: new Date().toISOString(),
  })
  // post is now typed and validated
  console.log(post.text)
} catch (error) {
  console.error('Validation failed:', error)
}
```

#### `$validate(data)` - Get Validation Result

Returns a detailed validation result object without throwing:

```typescript
import * as app from './lexicons/app.js'

const result = app.bsky.feed.post.$validate({
  $type: 'app.bsky.feed.post',
  text: 'Hello!',
  createdAt: new Date().toISOString(),
})

if (result.success) {
  console.log('Valid post:', result.value)
} else {
  console.error('Validation failed:', result.error)
}
```

#### `$build(data)` - Build with Defaults

Creates a valid object by applying defaults for optional fields:

```typescript
import * as app from './lexicons/app.js'

// Build a like record with defaults (and without needing to specify $type)
const like = app.bsky.feed.like.$build({
  subject: {
    uri: 'at://did:plc:abc/app.bsky.feed.post/123',
    cid: 'bafyrei...',
  },
  createdAt: new Date().toISOString(),
})
```

#### `$isTypeOf(data)` - Type Discriminator

Discriminates (already validated) data by `$type`, without re-validating. This is especially useful when working with union types:

```typescript
import { l } from '@atproto/lex'
import * as app from './lexicons/app.js'

declare const data:
  | app.bsky.feed.post.Main
  | app.bsky.feed.like.Main
  | l.TypedObject

// Discriminate by $type without re-validating
if (app.bsky.feed.post.$isTypeOf(data)) {
  // data is a post
}
```

## Client API

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

#### Creating a Client from Another Client

You can create a new `Client` instance from an existing client. The new client will share the same underlying configuration (authentication, headers, labelers, service proxy), with the ability to override specific settings.

> [!NOTE]
>
> When you create a client from another client, the child client inherits the base client's configuration. On every request, the child client merges its own configuration with the base client's current configuration, with the child's settings taking precedence. Changes to the base client's configuration (like `baseClient.setLabelers()`) will be reflected in child client requests, but changes to child clients do not affect the base client.

```typescript
import { Client } from '@atproto/lex'

// Base client with authentication
const baseClient = new Client(session)

baseClient.setLabelers(['did:plc:labelerA', 'did:plc:labelerB'])
baseClient.headers.set('x-app-version', '1.0.0')

// Create a new client with additional configuration that will get merged with
// baseClient's settings on every request.
const configuredClient = new Client(baseClient, {
  labelers: ['did:plc:labelerC'],
  headers: { 'x-trace-id': 'abc123' },
})
```

This pattern is particularly useful when you need to:

- Configure labelers after authentication
- Add application-specific headers
- Create multiple clients with different configurations from the same session

**Example: Configuring labelers after sign-in**

```typescript
import { Client } from '@atproto/lex'
import * as app from './lexicons/app.js'

async function createBaseClient(session: OAuthSession) {
  // Create base client
  const client = new Client(session, {
    service: 'did:web:api.bsky.app#bsky_appview',
  })

  // Fetch user preferences
  const { preferences } = await client.call(app.bsky.actor.getPreferences)

  // Extract labeler preferences
  const labelerPref = preferences.findLast((p) =>
    app.bsky.actor.defs.labelersPref.check(p),
  )
  const labelers = labelerPref?.labelers.map((l) => l.did) ?? []

  // Configure the client with the user's preferred labelers
  client.setLabelers(labelers)

  return client
}

// Usage
const baseClient = await createBaseClient(session)

// Create a new client with a different service, but reusing the labelers
// from the base client.
const otherClient = new Client(baseClient, {
  service: 'did:web:com.example.other#other_service',
})

// Whenever you update labelers on the base client, the other client will automatically
// receive the same updates, since they share the same labeler set.
```

#### Client with Service Proxy (authenticated only)

```typescript
import { Client } from '@atproto/lex'

// Route requests through a specific service
const client = new Client(session, {
  service: 'did:web:api.bsky.app#bsky_appview',
})
```

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
    headers: { 'custom-header': 'value' },
  },
)
```

#### `client.create()`

Create a new record.

```typescript
import * as app from './lexicons/app.js'

const result = await client.create(app.bsky.feed.post, {
  text: 'Hello, world!',
  createdAt: new Date().toISOString(),
})

console.log(result.uri) // at://did:plc:...
console.log(result.cid)
```

Options:

- `rkey` - Custom record key (auto-generated if not provided)
- `validate` - Validate record against schema before creating
- `swapCommit` - CID for optimistic concurrency control

#### `client.get()`

Retrieve a record.

```typescript
import * as app from './lexicons/app.js'

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

// Pagination
if (result.cursor) {
  const nextPage = await client.list(app.bsky.feed.post, {
    cursor: result.cursor,
    limit: 50,
  })
}
```

### Error Handling

By default, all client methods throw errors when requests fail. For more ergonomic error handling, the client provides "Safe" variants that return errors instead of throwing them.

#### Safe Methods

Each client method has a corresponding "Safe" variant that catches errors and returns them as part of the result type:

- `xrpcSafe()` - Safe version of `xrpc()`
- `createRecordsSafe()` - Safe version of `createRecord()`
- `deleteRecordsSafe()` - Safe version of `deleteRecord()`
- `getRecordsSafe()` - Safe version of `getRecord()`
- `putRecordsSafe()` - Safe version of `putRecord()`

#### ResponseFailure Type

Safe methods return a union type that includes the success case and all possible failure cases:

```typescript
import { Client, ResponseFailure } from '@atproto/lex'
import * as app from './lexicons/app.js'

const client = new Client(session)

// Using a safe method
const result = await client.xrpcSafe(com.atproto.identity.resolveHandle, {
  params: { limit: 50 },
})

if (result.success) {
  // Success - result is an XrpcResponse
  console.log(result.body)
} else {
  // Failure - result is a ResponseFailure, the type depends on the method's error definitions

  result // ResponseFailure<"HandleNotFound">

  // Handle error based on type
  if (result.name === 'UnexpectedError') {
    // Network error, invalid response, etc.
    result.error // "unknown" type
  } else if (result.name === 'Unknown') {
    // Server returned a valid XRPC error response with an unknown error type
    result.error // XrpcResponseError<string>
  } else {
    // Declared error from the method's errors list
    result.error // XrpcResponseError<"HandleNotFound">
  }
}
```

The `ResponseFailure<M>` type is a union with three possible error types:

1. **Declared errors** - Errors explicitly listed in the method's Lexicon schema will be represented as an `XrpcResponseError<N>` instance:

   ```typescript
   // XrpcResponseError<N>
   type KnownXrpcResponseFailure<N extends string> = {
     success: false
     name: N
     error: XrpcResponseError<N>

     // Additional response details
     status: number
     headers: Headers
     encoding: undefined | string
     body: XrpcErrorBody<N>
   }
   ```

2. **Unknown errors** - Server errors not declared in the method's schema:

   ```typescript
   // XrpcResponseFailure<'Unknown', XrpcResponseError>
   type UnknownXrpcResponseFailure = {
     success: false
     name: 'Unknown'
     error: XrpcResponseError<string>
   }
   ```

3. **Unexpected errors** - Network errors, invalid responses, or other client-side errors:
   ```typescript
   // XrpcResponseFailure<'UnexpectedError', unknown>
   type UnexpectedXrpcResponseFailure = {
     success: false
     name: 'UnexpectedError'
     error: unknown // Could be anything (network error, parsing error, etc.)
   }
   ```

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

The generated TypeScript is optimized for tree-shaking. Import only what you need:

```typescript
// Import specific methods
import { post } from './lexicons/app/bsky/feed/post.js'
import { getProfile } from './lexicons/app/bsky/actor/getProfile.js'

// Or use namespace imports (still tree-shakeable)
import * as app from './lexicons/app.js'
```

For library authors, use `--pure-annotations` when building:

```bash
lex build --pure-annotations
```

This will make the generated code more easily tree-shakeable from places that import your library.

### Custom Headers

Add custom headers to all requests:

```typescript
const client = new Client(session, {
  headers: {
    'x-custom-header': 'value',
  },
})
```

### Request Options

All client methods accept options for controlling request behavior. The available options depend on the type of operation.

#### Base Call Options

All methods support these base options:

```typescript
type CallOptions = {
  signal?: AbortSignal // Abort the request
  headers?: HeadersInit // Additional request headers
  service?: Service // Override service proxy for this request
  labelers?: Iterable<Did> // Additional labelers for this request
  validateRequest?: boolean // Set to "true" to enable request schema validation
  validateResponse?: boolean // Set to "false" to skip response schema validation
}
```

#### Query and Procedure Calls

When using `.call()` with Query or Procedure schemas:

```typescript
import * as app from './lexicons/app.js'

// Query with parameters
const timeline = await client.call(
  app.bsky.feed.getTimeline,
  { limit: 50 },
  {
    signal: abortController.signal,
    headers: { 'x-custom': 'value' },
  },
)

// Procedure with body
const result = await client.call(
  app.bsky.actor.putPreferences,
  { preferences: [...] },
  {
    signal: abortController.signal,
  },
)
```

For low-level access with full response data, use `.xrpc()`:

```typescript
const response = await client.xrpc(app.bsky.feed.getTimeline, {
  params: { limit: 50 },
  signal: abortController.signal,
  headers: { 'x-custom': 'value' },
  skipVerification: false, // Whether to skip response schema validation
})

console.log(response.status) // 200
console.log(response.headers) // Headers object
console.log(response.body) // Parsed response body
```

#### Record Operations (CRUD)

Record operations support additional options beyond base `CallOptions`:

**Creating Records**

```typescript
import * as app from './lexicons/app.js'

await client.create(
  app.bsky.feed.post,
  {
    text: 'Hello!',
    createdAt: new Date().toISOString(),
  },
  {
    // Base options
    signal: abortController.signal,
    headers: { 'x-custom': 'value' },

    // Create-specific options
    rkey: 'custom-key', // Custom record key (optional, auto-generated if omitted)
    validate: true, // Validate before creating
    swapCommit: 'bafyrei...', // CID for optimistic concurrency
  },
)
```

**Reading Records**

```typescript
await client.get(app.bsky.actor.profile, {
  // Base options
  signal: abortController.signal,

  // Get-specific options
  rkey: 'self', // Record key (required for non-literal keys)
})
```

**Updating Records**

```typescript
await client.put(
  app.bsky.actor.profile,
  {
    displayName: 'New Name',
    description: 'Updated bio',
  },
  {
    // Base options
    signal: abortController.signal,

    // Put-specific options
    rkey: 'self', // Record key
    validate: true, // Validate before updating
    swapCommit: 'bafyrei...', // Expected repo commit CID
    swapRecord: 'bafyrei...', // Expected record CID (for CAS)
  },
)
```

**Deleting Records**

```typescript
await client.delete(app.bsky.feed.post, {
  // Base options
  signal: abortController.signal,

  // Delete-specific options
  rkey: '3jxf7z2k3q2', // Record key
  swapCommit: 'bafyrei...', // Expected repo commit CID
  swapRecord: 'bafyrei...', // Expected record CID
})
```

**Listing Records**

```typescript
await client.list(app.bsky.feed.post, {
  // Base options
  signal: abortController.signal,

  // List-specific options
  limit: 50, // Maximum records to return
  cursor: 'abc123', // Pagination cursor
  reverse: true, // Reverse chronological order
})
```

### Actions

Actions are composable functions that combine multiple XRPC calls into higher-level operations. They can be invoked using `client.call()` just like Lexicon methods, making them a powerful tool for building library-style APIs on top of the low-level client.

#### What are Actions?

An `Action` is a function with this signature:

```typescript
type Action<Input, Output> = (
  client: Client,
  input: Input,
  options: CallOptions,
) => Output | Promise<Output>
```

Actions receive:

- `client` - The Client instance (to make XRPC calls)
- `input` - The input data for the action
- `options` - Call options (signal, headers)

#### Using Actions

Actions are called using `client.call()`, the same method used for XRPC queries and procedures:

```typescript
import { Action, Client } from '@atproto/lex'
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
      createdAt: new Date().toISOString(),
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

### Building Library-Style APIs with Actions

Actions enable you to create high-level, convenience APIs similar to [@atproto/api](https://www.npmjs.com/package/@atproto/api)'s `Agent` class. Here are patterns for common operations:

#### Creating Posts

```typescript
import { Action } from '@atproto/lex'
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
      createdAt: record.createdAt || new Date().toISOString(),
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
import { Action } from '@atproto/lex'
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
      createdAt: new Date().toISOString(),
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
import { Action } from '@atproto/lex'
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

      const current = app.bsky.actor.profile.main.validate(res.body.record)

      // Merge updates with current profile (if valid)
      const updated = app.bsky.actor.profile.main.build({
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
        error instanceof XrpcRequestFailure &&
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

## License

MIT or Apache2
