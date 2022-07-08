# ADX API

## Usage

```typescript
import { adx } from '@adxp/api'

// configure the API
adx.configure({
  schemas: [ublogSchema, likeSchema, pollSchema, followSchema, feedViewSchema]
})

const alice = adx.user('alice.com')
await alice.collections() // list all of alice's collections
const feed = alice.collection('blueskyweb.xyz:Feed')

await feed.list('*') // fetch all (apply no validation)
await feed.list('Ublog') // fetch only ublogs
await feed.list(['Ublog', 'Like']) // fetch ublogs and likes
await feed.list(['Ublog', 'Like', '*']) // fetch all, but apply validation on ublogs and likes
await feed.list({type: 'Ublog', ext: 'Poll'}) // fetch only ublogs and support poll extensions

await feed.get('Ublog', key) // fetch the record and validate as a ublog
await feed.get('*', key) // fetch the record and don't validate

await feed.create('Ublog', record) // create a record after validating as a ublog
await feed.create({type: 'Ublog', ext: 'Poll'}, record) // create a record after validating as a ublog with the poll extension
await feed.create('*', record) // create a record with no validation

await feed.put('Ublog', record) // write a record after validating as a ublog
await feed.put({type: 'Ublog', ext: 'Poll'}, record) // write a record after validating as a ublog with the poll extension
await feed.put('*', record) // write a record after no validation

await feed.del(record) // delete a record

await alice.view('FeedView') // fetch the feed view from alice's PDS

const ublogSchema = adx.schema({type: 'Ublog', ext: 'Poll'}) // create a validator for ublog posts
for (const post in (await alice.view('FeedView')).posts) {
  if (ublogSchema.isValid(post)) {
    // good to go
  }
}
```

