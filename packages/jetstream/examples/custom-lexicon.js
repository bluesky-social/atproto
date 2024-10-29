/* eslint-env node */
import { schemas } from '@atproto/api'
import { jetstream } from '@atproto/jetstream'

/** @param {AbortSignal} signal */
async function main(signal) {
  for await (const event of jetstream({
    signal,
    schemas: [
      // If you also need Bluesky's official schemas in addition to yours,
      // import {schemas} from '@atproto/api' then uncomment the following
      // line:

      ...schemas,
      {
        lexicon: 1,
        id: 'foo.bar',
        defs: {
          main: {
            type: 'record',
            record: {
              type: 'object',
              required: ['fooObject'],
              properties: {
                fooObject: {
                  type: 'union',
                  refs: ['foo.bar.defs#fooObject'],
                },
              },
            },
          },
        },
      },
      {
        lexicon: 1,
        id: 'foo.bar.defs',
        defs: {
          fooObject: {
            type: 'object',
            required: ['text'],
            properties: {
              text: { type: 'ref', ref: '#textProp' },
              bar: { type: 'integer' },
            },
          },
          textProp: {
            type: 'string',
          },
        },
      },
    ],
    wantedCollections: ['foo.bar', 'app.bsky.feed.post'],
  })) {
    if (event.kind !== 'commit') continue

    if (
      event.commit.operation === 'create' ||
      event.commit.operation === 'update'
    ) {
      const { commit } = event
      commit.record // { $type: "foo.bar"; [x: string]: unknown } | { $type: "app.bsky.feed.post"; [x: string]: unknown }

      if (commit.collection === 'foo.bar' && commit.recordValid) {
        commit.record.$type // 'foo.bar'
        commit.record.fooObject.text // string
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
