# @atproto/sync: atproto sync tools

TypeScript library for syncing data from the [atproto](https://atproto.com) network. Currently only supports firehose (relay) subscriptions

[![NPM](https://img.shields.io/npm/v/@atproto/sync)](https://www.npmjs.com/package/@atproto/sync)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## Usage

The firehose class will spin up a websocket connection to `com.atproto.sync.subscribeRepos` on a given repo host (by default the Relay run by Bluesky).

Each event will be parsed, authenticated, and then passed on to the supplied `handleEvt` which can handle indexing.

On `Commit` events, the firehose will verify signatures and repo proofs to ensure that the event is authentic. This can be disabled with the `unauthenticatedCommits` flag. Similarly on `Identity` events, the firehose will fetch the latest DID document for the repo and do bidirectional verification on the associated handle. This can be disabled with the `unauthenticatedHandles` flag.

Events of a certain type can be excluded using the `excludeIdentity`/`excludeAccount`/`excludeCommit` flags. And repo writes can be filtered down to specific collections using `filterCollections`. By default, all events are parsed and passed through to the handler. Note that this filtered currently happens client-side, though it is likely we will introduce server-side methods for doing so in the future.

Non-fatal errors that are encountered will be passed to the required `onError` handler. In most cases, these can just be logged.

When using the firehose class, events are processed serially. Each event must be finished being handled before the next one is parsed and authenticated.

```ts
import { Firehose } from '@atproto/sync'
import { IdResolver } from '@atproto/identity'

const idResolver = new IdResolver()
const firehose = new Firehose({
  idResolver,
  service: 'wss://bsky.network',
  handleEvt: async (evt) => {
    if (evt.event === 'identity') {
      // ...
    } else if (evt.event === 'account') {
      // ...
    } else if (evt.event === 'create') {
      // ...
    } else if (evt.event === 'update') {
      // ...
    } else if (evt.event === 'delete') {
      // ...
    }
  },
  onError: (err) => {
    console.error(err)
  },
  filterCollections: ['com.myexample.app'],
})
firehose.start()

// on service shutdown
await firehose.destroy()
```

For more robust indexing pipelines, it's recommended to use the supplied `MemoryRunner` class. This provides an in-memory partitioned queue. As events from a given repo must be processed in order, this allows events to be processed concurrently while still processing events from any given repo serially.

The `MemoryRunner` also tracks an internal cursor based on the last finished consecutive work. This ensures that no events are dropped, although it does mean that some events may occassionally be replayed (if the websocket drops and reconnects) and therefore it's recommended that any indexing logic is idempotent. An optional `setCursor` parameter may be supplied to the `MemoryRunner` which can be used to persistently store the most recently processed cursor.

```ts
import { Firehose, MemoryRunner } from '@atproto/sync'
import { IdResolver } from '@atproto/identity'

const idResolver = new IdResolver()
const runner = new MemoryRunner({
  setCursor: (cursor) => {
    // persist cursor
  },
})
const firehose = new Firehose({
  idResolver,
  runner,
  service: 'wss://bsky.network',
  handleEvt: async (evt) => {
    // ...
  },
  onError: (err) => {
    console.error(err)
  },
})
firehose.start()

// on service shutdown
await firehose.destroy()
await runner.destroy()
```

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
