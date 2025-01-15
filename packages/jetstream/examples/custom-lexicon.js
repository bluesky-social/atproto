/* eslint-env node */
import { schemas } from '@atproto/api'
import { jetstream } from '@atproto/jetstream'

/** @param {AbortSignal} signal */
async function main(signal) {
  for await (const event of jetstream({
    signal,
    schemas: [
      // If you don't need the schemas from the official Bluesky API, you can
      // comment next line:
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
      // { $type: "foo.bar"; [x: string]: unknown } | { $type: "app.bsky.feed.post"; [x: string]: unknown }
      commit.record

      if (!commit.recordError) {
        // 'foo.bar' | 'app.bsky.feed.post' | ... (all knowns record types from the schemas)
        commit.record.$type

        if (commit.record.$type === 'foo.bar') {
          commit.record.fooObject.$type // 'foo.bar.defs#fooObject' | undefined
          commit.record.fooObject.text // string
          commit.record.fooObject.bar // number | undefined
        }
        if (commit.record.$type === 'app.bsky.feed.post') {
          commit.record.text // string
        }
      } else {
        commit.recordError // ValidationError | InvalidLexiconError | LexiconDefNotFoundError | Error
        commit.record // UnknownRecord
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
