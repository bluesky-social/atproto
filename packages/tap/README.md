# @atproto/tap

TypeScript client library for [Tap](https://github.com/bluesky-social/indigo/tree/main/cmd/tap/README.md), a sync utility for the AT Protocol network.

Tap handles firehose connections, cryptographic verification, backfill, and filtering. This client library lets you connect to a Tap instance and receive simple JSON events for the repos you care about.

[![NPM](https://img.shields.io/npm/v/@atproto/tap)](https://www.npmjs.com/package/@atproto/tap)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## Quick Start

```bash
npm install @atproto/tap
```

```ts
import { Tap, SimpleIndexer } from '@atproto/tap'

const tap = new Tap('http://localhost:2480', { adminPassword: 'secret' })

const indexer = new SimpleIndexer()

indexer.identity(async (evt) => {
  console.log(`${evt.did} updated identity: ${evt.handle} (${evt.status})`)
})

indexer.record(async (evt) => {
  const uri = `at://${evt.did}/${evt.collection}/${evt.rkey}`
  if (evt.action === 'create' || evt.action === 'update') {
    console.log(`${evt.action}: ${uri}`)
  } else {
    console.log(`deleted: ${uri}`)
  }
})

indexer.error((err) => console.error(err))

const channel = tap.channel(indexer)
channel.start()

await tap.addRepos(['did:plc:ewvi7nxzyoun6zhxrhs64oiz'])

// On shutdown
await channel.destroy()
```

## Running Tap

See the [Tap README](https://github.com/bluesky-social/indigo/tree/main/cmd/tap/README.md) for details getting Tap up and running. Your app can communicate with it either locally or over the internet.

This library is intended to be used with Tap running in the default mode of "WebScoket with acks". In this mode, Tap provides:

- **At-least-once delivery**: Events may be redelivered if the connection drops before an ack is received
- **Per-repo ordering**: Events for the same repo are delivered in order
- **Backfill**: When you add a repo, historical events are delivered before live events

## API

### `Tap`

The main client for interacting with a Tap server.

```ts
const tap = new Tap(url: string, config?: TapConfig)
```

**Config options:**

- `adminPassword?: string` - Password for Basic auth (required if Tap server has auth enabled)

**Methods:**

- `channel(handler: TapHandler, opts?: TapWebsocketOptions): TapChannel` - Create a WebSocket channel to receive events
- `addRepos(dids: string[]): Promise<void>` - Add repos to track (triggers backfill)
- `removeRepos(dids: string[]): Promise<void>` - Stop tracking repos
- `resolveDid(did: string): Promise<DidDocument | null>` - Resolve a DID to its DID document
- `getRepoInfo(did: string): Promise<RepoInfo>` - Get info about a tracked repo

### `TapChannel`

WebSocket connection for receiving events. Created via `tap.channel()`.

```ts
const channel = tap.channel(handler, opts?)
```

**Methods:**

- `start(): Promise<void>` - Start receiving events. Returns a promise that resolves when the connection is destroyed or errors.
- `destroy(): Promise<void>` - Close the connection

The channel automatically handles reconnection and keepalive. Events are automatically acknowledged after your handler completes successfully.

### `SimpleIndexer`

A convenience class for handling events by type. Passed into `tap.channel()` when opening a channel with Tap.

```ts
const indexer = new SimpleIndexer()

indexer.identity(async (evt: IdentityEvent) => { ... })
indexer.record(async (evt: RecordEvent) => { ... })
indexer.error((err: Error) => { ... })
```

If no error handler is registered, errors will throw as unhandled exceptions.

### `LexIndexer`

A typed indexer that uses `@atproto/lex` schemas for type-safe event handling. Register handlers for specific record types and actions:

```ts
import { LexIndexer } from '@atproto/tap'
import * as com from './lexicons/com'

const indexer = new LexIndexer()

// Handle creates for a specific record type
indexer.create(com.example.post, async (evt) => {
  // evt.record is fully typed as com.example.post.Main
  console.log(`New post: ${evt.record.text}`)
})

// Handle updates
indexer.update(com.example.post, async (evt) => {
  console.log(`Updated post: ${evt.record.text}`)
})

// Handle deletes (no record on delete events)
indexer.delete(com.example.post, async (evt) => {
  console.log(`Deleted: at://${evt.did}/${evt.collection}/${evt.rkey}`)
})

// Handle both creates and updates with put()
indexer.put(com.example.like, async (evt) => {
  console.log(`Like ${evt.action}: ${evt.record.subject.uri}`)
})

// Fallback for unhandled record types/actions
indexer.other(async (evt) => {
  console.log(`Unhandled: ${evt.action}, ${evt.collection}`)
})

// Identity and error handlers
indexer.identity(async (evt) => { ... })
indexer.error((err) => { ... })

const channel = tap.channel(indexer)
```

Records are validated against their schemas before handlers are called. If validation fails, an error is thrown which will be picked up through the `error` handler..

Duplicate handler registration throws an error, including conflicts between `put()` and `create()`/`update()` for the same schema.

### `TapHandler`

You can create your own custom handler by creating a class that implements the `TapHandler` interface:

```ts
interface TapHandler {
  onEvent: (evt: TapEvent, opts: HandlerOpts) => void | Promise<void>
  onError: (err: Error) => void
}

interface HandlerOpts {
  signal: AbortSignal
  ack: () => Promise<void>
}
```

When implementing a custom handler, be sure to call `ack()` when you're done processing the event.

## Event Types

### `RecordEvent`

```ts
type RecordEvent = {
  id: number
  type: 'record'
  action: 'create' | 'update' | 'delete'
  did: string
  rev: string
  collection: string
  rkey: string
  record?: Record<string, unknown> // present for create/update
  cid?: string // present for create/update
  live: boolean // true if from firehose, false if from backfill
}
```

### `IdentityEvent`

```ts
type IdentityEvent = {
  id: number
  type: 'identity'
  did: string
  handle: string
  isActive: boolean
  status: 'active' | 'takendown' | 'suspended' | 'deactivated' | 'deleted'
}
```

## Webhook Mode

If your Tap server is configured for webhook delivery, you can use `parseTapEvent` to validate incoming webhook payloads:

```ts
import express from 'express'
import { parseTapEvent, assureAdminAuth } from '@atproto/tap'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

const app = express()
app.use(express.json())

app.post('/webhook', async (req, res) => {
  try {
    assureAdminAuth(ADMIN_PASSWORD, req.headers.authorization)
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const evt = parseTapEvent(req.body)
    // handle event...
    res.sendStatus(200)
  } catch (err) {
    console.error('Failed to process event:', err)
    res.status(500).json({ error: 'Failed to process event' })
  }
})
```

## Utilities

### Auth helpers

```ts
import {
  formatAdminAuthHeader,
  parseAdminAuthHeader,
  assureAdminAuth,
} from '@atproto/tap'

// Format a password into a Basic auth header value
const header = formatAdminAuthHeader('secret')
// => 'Basic YWRtaW46c2VjcmV0'

// Parse an auth header to extract the password (throws if invalid)
const password = parseAdminAuthHeader(header)

// Verify auth header matches expected password (timing-safe, throws if invalid)
assureAdminAuth('secret', req.headers.authorization)
```

### Event parsing

```ts
import { parseTapEvent } from '@atproto/tap'

const evt = parseTapEvent(jsonData) // validates and returns typed TapEvent
```

## License

MIT
