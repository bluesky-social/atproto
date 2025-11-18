# @atproto/lex

Type-safe Lexicon tooling for AT Protocol. This package provides CLI tools for managing Lexicon schemas and a client for making authenticated XRPC requests.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Examples](#examples)
- [Installation](#installation)
- [Quick Start](#quick-start)
  - [1. Install Lexicons](#1-install-lexicons)
  - [2. Generate TypeScript Definitions](#2-generate-typescript-definitions)
  - [3. Use in Your Application](#3-use-in-your-application)
- [CLI Commands](#cli-commands)
  - [`lex install`](#lex-install)
  - [`lex build`](#lex-build)
- [Client API](#client-api)
  - [Creating a Client](#creating-a-client)
    - [Unauthenticated Client](#unauthenticated-client)
    - [Authenticated Client with OAuth](#authenticated-client-with-oauth)
    - [Creating a Client from Another Client](#creating-a-client-from-another-client)
    - [Client with Service Proxy (authenticated only)](#client-with-service-proxy-authenticated-only)
  - [Core Methods](#core-methods)
    - [`client.call()`](#clientcall)
    - [`client.create()`](#clientcreate)
    - [`client.get()`](#clientget)
    - [`client.put()`](#clientput)
    - [`client.delete()`](#clientdelete)
    - [`client.list()`](#clientlist)
  - [Authentication Methods](#authentication-methods)
    - [`client.did`](#clientdid)
    - [`client.assertAuthenticated()`](#clientassertauthenticated)
  - [Labeler Configuration](#labeler-configuration)
  - [Low-Level XRPC](#low-level-xrpc)
- [Workflow Integration](#workflow-integration)
  - [Development Workflow](#development-workflow)
- [Advanced Usage](#advanced-usage)
  - [Tree-Shaking](#tree-shaking)
  - [Custom Headers](#custom-headers)
  - [Request Options](#request-options)
    - [Base Call Options](#base-call-options)
    - [Query and Procedure Calls](#query-and-procedure-calls)
    - [Record Operations (CRUD)](#record-operations-crud)
- [Actions](#actions)
  - [What are Actions?](#what-are-actions)
  - [Using Actions](#using-actions)
  - [Composing Multiple Operations](#composing-multiple-operations)
  - [Higher-Order Actions](#higher-order-actions)
- [Building Library-Style APIs with Actions](#building-library-style-apis-with-actions)
  - [Creating Posts](#creating-posts)
  - [Following Users](#following-users)
  - [Updating Profile with Retry Logic](#updating-profile-with-retry-logic)
  - [Packaging Actions as a Library](#packaging-actions-as-a-library)
  - [Best Practices for Actions](#best-practices-for-actions)
- [TypeScript Integration](#typescript-integration)
- [Related Packages](#related-packages)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Examples

```typescript
const profile = await client.call(app.bsky.actor.getProfile, {
  actor: 'pfrazee.com',
})

await client.create(app.bsky.feed.post, {
  text: 'Hello, world!',
  createdAt: new Date().toISOString(),
})

const posts = await client.list(app.bsky.feed.post, {
  limit: 10,
  repo: 'did:plc:pfrazee.com',
})
```

## Installation

```bash
npm install -g @atproto/lex
lex --help
```

## Quick Start

### 1. Install Lexicons

Install the Lexicon schemas you need for your application:

```bash
lex install app.bsky.feed.post app.bsky.feed.like
```

> [!NOTE]
>
> If you didn't install the CLI globally, or if you didn't setup your shell's
> PATH to include your package manager's binaries directory, you can use
> `npx @atproto/lex` or `pnpm exec lex` to run the command. The recommended
> approach is to add `@atproto/lex` as part of your project's `devDependencies`
> and run `lex` via your project's `scripts` (see
> [Development Workflow](#development-workflow) below).

This creates:

- `lexicons.json` - manifest tracking installed Lexicons and their versions (CIDs)
- `lexicons/` - directory containing the Lexicon JSON files

Make sure to commit these files to version control.

### 2. Generate TypeScript Definitions

TypeScript definitions will be automatically built when installing the lexicons.

If you wish to customize the output location, or any other options, you can run
the build command separately. For that purpose, make sure to use the
`--no-build` flag when installing lexicons to skip the automatic build step.

Generate TypeScript definitions for your installed Lexicons:

```bash
lex build --lexicons ./lexicons --out ./src/lexicons
```

### 3. Use in Your Application

```typescript
import { Client } from '@atproto/lex'
import * as app from './lexicons/app.js'

// Create an unauthenticated client
const client = new Client('https://public.api.bsky.app')

// Make requests using generated schemas
const response = await client.call(app.bsky.actor.getProfile, {
  actor: 'pfrazee.com',
})
```

## CLI Commands

### `lex install`

Install Lexicon schemas and their dependencies.

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
- `--no-build` - Skip building TypeScript lexicon schema files after installation (build is enabled by default)
- `--update` - Update all installed lexicons to their latest versions by re-resolving and re-installing them
- `--ci` - Error if the installed lexicons do not match the CIDs in the lexicons.json manifest
- `--lexicons <dir>` - Directory containing lexicon JSON files (default: `./lexicons`)
- `--out <dir>` - Output directory for generated TS files (default: `./src/lexicons`)

### `lex build`

Generate TypeScript definitions from Lexicon JSON files.

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
- `--allowLegacyBlobs` - Allow generating schemas that accept legacy blob references

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

You can create a new `Client` instance from an existing client. The new client will share the same underlying configuration (authentication, headers, labelers, service proxy), with the option to override specific settings.

```typescript
import { Client } from '@atproto/lex'

// Base client with authentication
const baseClient = new Client(session)

// Create a new client with additional configuration
const configuredClient = new Client(baseClient, {
  // These settings will be merged with baseClient's settings
  labelers: ['did:plc:labeler123'],
  headers: { 'x-app-version': '1.0.0' },
})

// Both clients share the same authentication but have different settings
console.log(baseClient.did === configuredClient.did) // true
console.log(baseClient.labelers.size === configuredClient.labelers.size) // false
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
- `repo` - Repository DID (defaults to authenticated user)
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
- `repo` - Repository DID (defaults to authenticated user)
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

for (const record of result.values) {
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

## Workflow Integration

### Development Workflow

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "lex:update": "lex install --update --save",
    "postinstall": "lex install --ci"
  }
}
```

This ensures:

1. `postinstall` - Lexicons are verified/installed after `npm install`

## Advanced Usage

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

This will make the generated code more tree-shakeable from places that import your library.

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
  headers?: HeadersInit // Custom request headers
  service?: Service // Override service proxy for this request
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
    repo: 'did:plc:xyz', // Different repo (defaults to authenticated user)
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
  repo: 'did:plc:xyz', // Different repo (defaults to authenticated user)
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
    repo: 'did:plc:xyz', // Different repo
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
  repo: 'did:plc:xyz', // Different repo
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
  repo: 'did:plc:xyz', // Different repo
  limit: 50, // Maximum records to return
  cursor: 'abc123', // Pagination cursor
  reverse: true, // Reverse chronological order
})
```

## Actions

Actions are composable functions that combine multiple XRPC calls into higher-level operations. They can be invoked using `client.call()` just like Lexicon methods, making them a powerful tool for building library-style APIs on top of the low-level client.

### What are Actions?

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

### Using Actions

Actions are called using `client.call()`, the same method used for XRPC queries and procedures:

```typescript
import { Action, Client } from '@atproto/lex'
import * as app from './lexicons/app.js'

// Define an action
const likePost: Action<
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

### Composing Multiple Operations

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

  // Check for abort
  options.signal?.throwIfAborted()

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

### Higher-Order Actions

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

  options.signal?.throwIfAborted()

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

## Building Library-Style APIs with Actions

Actions enable you to create high-level, convenience APIs similar to `@atproto/api`'s `Agent` class. Here are patterns for common operations:

### Creating Posts

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

### Following Users

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

### Updating Profile with Retry Logic

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
  let lastError: unknown

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      options?.signal?.throwIfAborted()

      // Get current profile and its CID
      const record = await client
        .xrpc(com.atproto.repo.getRecord, {
          params: {
            repo: client.assertDid,
            collection: 'app.bsky.actor.profile',
            rkey: 'self',
          },
        })
        .catch(() => undefined)

      // Merge updates with current profile
      const updated = app.bsky.actor.profile.main.build({
        ...(record?.body.value as any),
        ...updates,
      })

      // Validate
      const validated = app.bsky.actor.profile.main.parse(updated)

      // Save with optimistic concurrency control
      await client.put(app.bsky.actor.profile, validated, {
        ...options,
        swapRecord: record?.body.cid ?? null,
      })

      return
    } catch (error) {
      // Retry on swap/concurrent modification errors
      const isSwapError =
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string' &&
        error.message.includes('swap')

      if (isSwapError && attempt < maxRetries - 1) {
        lastError = error
        continue
      }

      throw error
    }
  }

  throw new Error('Max retries exceeded', { cause: lastError })
}

// Usage
await client.call(updateProfile, {
  displayName: 'Alice',
  description: 'Software engineer',
})
```

### Packaging Actions as a Library

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

// Optional: Create a class-based wrapper for convenience
export class BskyClient extends Client {
  async post(input: /* ... */) {
    return this.call(post, input)
  }

  async like(input: /* ... */) {
    return this.call(like, input)
  }

  async follow(input: /* ... */) {
    return this.call(follow, input)
  }

  async updateProfile(input: /* ... */) {
    return this.call(updateProfile, input)
  }
}
```

Usage:

```typescript
// Direct usage with actions
import { Client } from '@atproto/lex'
import * as actions from './actions.js'

const client = new Client(session)
await client.call(actions.post, { text: 'Hello!' })

// Or with the wrapper class
import { BskyClient } from './actions.js'

const client = new BskyClient(session)
await client.post({ text: 'Hello!' })
```

### Best Practices for Actions

1. **Type Safety**: Always provide explicit type parameters for `Action<Input, Output>`
2. **Authentication**: Use `client.assertAuthenticated()` when auth is required
3. **Abort Signals**: Check `options.signal?.throwIfAborted()` between long operations
4. **Composition**: Build complex actions from simpler ones
5. **Retries**: Implement retry logic for operations with optimistic concurrency control

## TypeScript Integration

Generated schemas provide full type safety:

```typescript
import * as app from './lexicons/app.js'
import type { Infer } from '@atproto/lex'

// Extract types from schemas
type Post = Infer<typeof app.bsky.feed.post.main>

const post: Post = {
  $type: 'app.bsky.feed.post',
  text: 'Hello!',
  createdAt: new Date().toISOString(),
}

// Validation methods
app.bsky.feed.post.main.check(data) // Type guard
app.bsky.feed.post.main.validate(data) // Returns ValidationResult
app.bsky.feed.post.main.parse(data) // Returns typed value or throws
app.bsky.feed.post.main.build(data) // Build with defaults
```

## Related Packages

- [@atproto/oauth-client](../../../oauth/oauth-client) - OAuth authentication
- [@atproto/oauth-client-browser](../../../oauth/oauth-client-browser) - Browser OAuth
- [@atproto/oauth-client-node](../../../oauth/oauth-client-node) - Node.js OAuth
- [@atproto/lex-schema](../lex-schema) - Lexicon schema definitions
- [@atproto/lex-builder](../lex-builder) - Schema builder (used by CLI)

## License

MIT or Apache2
