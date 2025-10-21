# @atproto/nexus

Library for connecting with [Nexus](#), a utility for syncing subsets of the AT network.

## Usage

Before you get started you'll need to get an instance of Nexus running for your app. See more in the [Nexus project](#).

```ts
import { Nexus } from '@atproto/nexus'

const nexus = new Nexus('http://localhost:8080')

// Open websocket connection. Note that only one connection can be open at a time.
const channel = nexus.connect()

// Process incoming events
channel.on('event', async (evt) => {
  if (evt.isUserEvt()) {
    console.log(
      `${evt.data.did} updated identity. handle: ${evt.data.handle}. status: ${evt.data.status}`,
    )
  } else if (evt.isRecordEvt()) {
    if (evt.data.action === 'create' || evt.data.action === 'update') {
      console.log(
        `record created/updated at ${evt.uri.toString()}: ${JSON.stringify(evt.data.record)}`,
      )
    } else {
      console.log(`record deleted at ${evt.uri.toString()}`)
    }
    console.log(`${evt.data.did}`)
  }
  // Unless acks are disabled in Nexus, every event must be acked after processing.
  // If left unacked, Nexus will retry sending.
  await evt.ack()
})

// If the websocket connection drops, the client will attempt to reconnect automatically.
channel.on('reconnecting', (_code, reason) => {
  console.info(`Channel reconnecting: ${reason}`)
})

// Log errors that occur on the channel
channel.on('error', (err) => {
  console.error('Error on channel', err)
})

// dyanmically add/remove repos from the channel
// as you add repos, they will be backfilled and all existing records will be sent over the channel
await nexus.addRepos(['did:example:alice'])
await nexus.removeRepos(['did:example:bob'])

// on shutdown
channel.close()
```

## Usage with webhooks
If you don't want to maintain a persistent websocket connection, you can register a webhook with Nexus. The same events will be sent to the webhook URL you provide.

```ts
import express from 'express'
import { Nexus, parseNexusEvent } from '@atproto/nexus'

const app = express()
app.use(express.json())

// Set up webhook endpoint
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
