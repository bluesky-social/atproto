# @atproto/lex

Type-safe Lexicon tooling for AT Protocol. This package provides CLI tools for managing Lexicon schemas and a client for making authenticated XRPC requests.

## Installation

```bash
npm install @atproto/lex
```

## Quick Start

### 1. Install Lexicons

Install the Lexicon schemas you need for your application:

```bash
npx lex install app.bsky.feed.post app.bsky.feed.like
```

This creates:

- `lexicons.json` - manifest tracking installed Lexicons and their versions (CIDs)
- `lexicons/` - directory containing the Lexicon JSON files

Make sure to commit these files to version control.

### 2. Generate TypeScript Definitions

Generate TypeScript definitions from your Lexicons:

```bash
npx lex build --lexicons ./lexicons --out ./src/lexicons
```

> [!TIP]
> Tou can install and build in one step using:
>
> ```bash
> npx lex install --build
> # or
> npx lex install --build ./src/lexicons
> ```

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
# Install specific Lexicons
npx lex install app.bsky.feed.post app.bsky.actor.profile

# Install all Lexicons from lexicons.json manifest
npx lex install

# Install and build in one command
npx lex install app.bsky.feed.post --build ./src/lexicons

# Update (re-fetch) all installed Lexicons to latest versions
npx lex install --update

# Verify installed Lexicons match manifest (CI mode)
npx lex install --ci
```

Options:

- `--save`, `-s` - Update lexicons.json with installed Lexicons
- `--build <dir>`, `-b <dir>` - Build TypeScript definitions after installing
- `--update` - Update all Lexicons to latest versions
- `--ci` - Fail if installed Lexicons don't match manifest

### `lex build`

Generate TypeScript definitions from Lexicon JSON files.

```bash
npx lex build --lexicons ./lexicons --out ./src/lexicons
```

Options:

- `--lexicons <dirs...>` - Directories containing Lexicon JSON files (default: `./lexicons`)
- `--out <dir>` - Output directory for generated TypeScript (default: `./src/lexicons`)
- `--clear` - Clear output directory before generating
- `--override` - Override existing files (no effect with --clear)
- `--pretty` - Run prettier on generated files (default: true)
- `--pure-annotations` - Add `/*#__PURE__*/` annotations for tree-shaking
- `--exclude <patterns...>` - Exclude Lexicons by ID patterns
- `--include <patterns...>` - Include only Lexicons matching ID patterns
- `--lib <package>` - Package name to import from (default: `@atproto/lex`)
- `--ignore-errors` - Continue processing despite errors
- `--allowLegacyBlobs` - Allow legacy blob references

## Client API

### Creating a Client

#### Unauthenticated Client

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
    "postinstall": "lex install --ci",
    "prebuild": "lex build --lexicons ./lexicons --out ./src/lexicons"
  }
}
```

This ensures:

1. `postinstall` - Lexicons are verified/installed after `npm install`
2. `prebuild` - TypeScript definitions are generated before building your app

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
npx lex build --lexicons ./lexicons --out ./src/lexicons --pure-annotations
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

All methods accept call options:

```typescript
const options = {
  signal: abortController.signal,
  headers: { 'x-request-id': '123' },
}

await client.create(schema, data, options)
await client.get(schema, { ...options, rkey: 'key' })
await client.call(method, params, options)
```

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

MIT
