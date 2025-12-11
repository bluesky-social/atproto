# @atproto/tap

Library for connecting with [Tap](#), a utility for syncing subsets of the AT network.

## Usage

Before you get started you'll need to get an instance of Tap running for your app. See more in the [Tap project](#).

```ts
import { Tap, SimpleIndexer } from '@atproto/tap'

const tap = new Tap('http://localhost:8080')

const indexer = new SimpleIndexer()

// handle events pertaining to a repo's account or identity
indexer.identity(async (evt) => {
  console.log(
    `${evt.did} updated identity. handle: ${evt.handle}. status: ${evt.status}`,
  )
})

// handle events pertaining to a the creation, update, or deletion of a record
indexer.record(async (evt) => {
  const uri = `at://${evt.did}/${evt.collection}/${evt.rkey}`
  if (evt.action === 'create' || evt.action === 'update') {
    console.log(`record created/updated at ${uri}: ${JSON.stringify(evt.record)}`)
  } else {
    console.log(`record deleted at ${uri}`)
  }
})

// without a handler, errors will end up as unhandled exceptions
indexer.error((err) => console.error(err))

// Open websocket connection, the library will handle reconnects and keeping the websocket alive
const channel = tap.channel(indexer)
channel.start() // note: this returns a promise that only resolves once the connection errors or is destroyed

// dyanmically add/remove repos from the channel
// as you add repos, they will be backfilled and all existing records will be sent over the channel
await tap.addRepos(['did:example:alice'])
await tap.removeRepos(['did:example:bob'])

// ...

// on shutdown
await channel.destroy()
```

## Usage with webhooks
If you don't want to maintain a persistent websocket connection, you can register a webhook with Tap. The same events will be sent to the webhook URL you provide.

```ts
import express from 'express'
import { Tap, parseTapEvent } from '@atproto/tap'

const app = express()
app.use(express.json())

app.post('/webhook', async (req, res) => {
  try {
    assureAdminAuth(ADMIN_PASSWORD, req.headers.authorization)
  } catch{
    res.status(401).json({ error: 'Invalid admin auth' })
    return
  }
  try {
    const evt = parseTapEvent(req.body)
    // ...
    res.sendStatus(200)
  } catch (err) {
    console.error('Error processing webhook:', err)
    res.status(500).json({ error: 'Failed to process event' })
  }
})

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000')
})
```
