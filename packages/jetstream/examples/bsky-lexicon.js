/* eslint-env node */
import { schemas } from '@atproto/api'
import { jetstream } from '@atproto/jetstream'

/** @param {AbortSignal} signal */
async function main(signal) {
  try {
    for await (const event of jetstream({
      signal,
      schemas,
      wantedCollections: ['app.bsky.feed.post', 'app.bsky.feed.like'],
    })) {
      if (event.kind !== 'commit') continue

      if (event.commit.operation === 'create') {
        const { record } = event.commit

        if (record.$type === 'app.bsky.feed.post') {
          if (!record.langs || record.langs.includes('en')) {
            console.log(record.text)
          }
        }
      }
    }
  } catch (err) {
    if (!signal.aborted || signal.reason !== err?.['cause']) {
      throw err
    }
  }
}

const ac = new AbortController()
process.on('SIGINT', () => (ac.signal.aborted ? process.exit(1) : ac.abort()))
main(ac.signal)
