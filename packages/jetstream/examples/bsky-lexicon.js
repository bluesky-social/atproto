import { schemas } from '@atproto/api'
import { jetstream } from '@atproto/jetstream'

//
;(async () => {
  const ac = new AbortController()
  process.on('SIGINT', () => ac.abort())

  try {
    for await (const event of jetstream({
      signal: ac.signal,
      schemas,
      compress: true,
      wantedCollections: ['app.bsky.feed.post', 'app.bsky.feed.like'],
    })) {
      if (
        event.kind === 'commit' &&
        (event.commit.operation === 'create' ||
          event.commit.operation === 'update')
      ) {
        const { record } = event.commit

        if (record.$type === 'app.bsky.feed.post') {
          if (!record.langs || record.langs.includes('en')) {
            console.log(record.text)
          }
        }
      }
    }
  } catch (err) {
    if (!ac.signal.aborted || ac.signal.reason !== err?.['cause']) {
      throw err
    }
  }

  console.log('cleanly shut down')
})()
