/* eslint-env node */
import { schemas } from '@atproto/api'
import { jetstream } from '@atproto/jetstream'

/** @param {AbortSignal} signal */
async function main(signal) {
  for await (const event of jetstream({
    signal,
    schemas,
    wantedCollections: ['app.bsky.feed.post'],
  })) {
    if (event.kind !== 'commit') continue
    if (event.commit.operation !== 'create') continue

    const { record, recordValid } = event.commit

    if (recordValid && record.$type === 'app.bsky.feed.post') {
      if (
        !record.reply &&
        record.langs?.some((l) => l === 'fr' || l === 'en')
      ) {
        console.log(record.text)
      }
    }
  }
}

const ac = new AbortController()
process.on('SIGINT', () => (ac.signal.aborted ? process.exit(2) : ac.abort()))
void main(ac.signal).catch((err) => {
  if (!ac.signal.aborted || ac.signal.reason !== err?.['cause']) {
    console.error(err)
    process.exit(1)
  }
})
