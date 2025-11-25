# @atproto/nexus

Library for connecting with [Nexus](#), a utility for syncing subsets of the AT network.

## Usage

Before you get started you'll need to get an instance of Nexus running for your app. See more in the [Nexus project](#).

```ts
import { Nexus, SimpleIndexer } from '@atproto/nexus'

const nexus = new Nexus('http://localhost:8080')

const indexer = new SimpleIndexer()
// handle events pertaining to a repo's account or identity
indexer.user(async (evt) => {
  console.log(
    `${evt.user.did} updated identity. handle: ${evt.user.handle}. status: ${evt.user.status}`,
  )
})
// handle events pertaining to a the creation, update, or deletion of a record
indexer.record(async (evt) => {
  const uri = `at://${evt.record.did}/${evt.record.collection}/${evt.record.rkey}`
  if (evt.record.action === 'create' || evt.record.action === 'update') {
    console.log(
      `record created/updated at ${uri}: ${JSON.stringify(evt.record.record)}`,
    )
  } else {
    console.log(`record deleted at ${uri}`)
  }
})
// without a handler, errors will end up as unhandled exceptions
indexer.error((err) => console.error(err))

const channel = nexus.channel(indexer)
channel.start()

// Open websocket connection. Note that only one connection can be open at a time.
// The library will handle reconnects and keeping the websocket alive
const channel = nexus.connect()

channel.start()

// dyanmically add/remove repos from the channel
// as you add repos, they will be backfilled and all existing records will be sent over the channel
await nexus.addRepos(['did:example:alice'])
await nexus.removeRepos(['did:example:bob'])

// on shutdown
await channel.destory()
```

## Usage with webhooks
If you don't want to maintain a persistent websocket connection, you can register a webhook with Nexus. The same events will be sent to the webhook URL you provide.

```ts
import express from 'express'
import { Nexus, parseNexusEvent } from '@atproto/nexus'

const app = express()
app.use(express.json())

app.post('/webhook', async (req, res) => {
  try {
    const evt = parseNexusEvent(req.body)
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
