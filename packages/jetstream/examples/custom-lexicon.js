import { jetstream } from '@atproto/jetstream'

//
;(async () => {
  const ac = new AbortController()
  process.on('SIGINT', () => ac.abort())

  try {
    for await (const event of jetstream({
      signal: ac.signal,
      schemas: [
        {
          lexicon: 1,
          id: 'fo.bar.baz',
          defs: {
            main: {
              type: 'record',
              description:
                'Record declaring of the existence of a feed generator, and containing metadata about it. The record can exist in any repository.',
              key: 'any',
              record: {
                type: 'object',
                required: ['foo'],
                properties: {
                  foo: { type: 'string' },
                },
              },
            },
          },
        },
      ],
      compress: true,
      wantedCollections: ['fo.bar.baz'],
    })) {
      if (
        event.kind === 'commit' &&
        (event.commit.operation === 'create' ||
          event.commit.operation === 'update')
      ) {
        const { record } = event.commit

        if (record.$type === 'fo.bar.baz') {
          record.foo
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
