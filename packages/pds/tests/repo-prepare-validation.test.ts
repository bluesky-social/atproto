import { jest } from '@jest/globals'
import { TID } from '@atproto/common'
import { l } from '@atproto/lex'
import type { TypedLexMap } from '@atproto/lex-data'
import type { DidString, NsidString, RecordKeyString } from '@atproto/syntax'
import { InvalidRecordError, prepareCreate } from '../src/repo/index.js'

const collection = 'com.example.note' as NsidString
const rkey = TID.next().toString() as RecordKeyString
const did = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa' as DidString
const schema = l.record(
  'tid',
  collection,
  l.object({ text: l.string({ maxLength: 20 }) }),
)

const prepare = (
  record: TypedLexMap,
  options: {
    validate?: boolean
    recordSchemaResolver?: { resolve: () => Promise<typeof schema> }
  },
) =>
  prepareCreate({
    did,
    collection: record.$type as NsidString,
    rkey,
    record,
    ...options,
  })

describe('resolved record validation', () => {
  it('uses static known schemas before consulting the dynamic resolver', async () => {
    const resolver = { resolve: jest.fn(async () => schema) }

    await expect(
      prepare(
        {
          $type: 'app.bsky.feed.post' as NsidString,
          text: 'known',
          createdAt: new Date().toISOString(),
        },
        { validate: true, recordSchemaResolver: resolver },
      ),
    ).resolves.toMatchObject({ validationStatus: 'valid' })
    expect(resolver.resolve).not.toHaveBeenCalled()
  })

  it('resolves and validates an unknown schema only when validation is required', async () => {
    const resolver = { resolve: jest.fn(async () => schema) }

    await expect(
      prepare(
        { $type: collection, text: 'valid' },
        {
          validate: true,
          recordSchemaResolver: resolver,
        },
      ),
    ).resolves.toMatchObject({ validationStatus: 'valid' })
    expect(resolver.resolve).toHaveBeenCalledTimes(1)

    await expect(
      prepare(
        { $type: collection, text: 'not resolved' },
        {
          recordSchemaResolver: resolver,
        },
      ),
    ).resolves.toMatchObject({ validationStatus: 'unknown' })
    await expect(
      prepare(
        { $type: collection, text: 'not resolved' },
        {
          validate: false,
          recordSchemaResolver: resolver,
        },
      ),
    ).resolves.toMatchObject({ validationStatus: undefined })
    expect(resolver.resolve).toHaveBeenCalledTimes(1)
  })

  it('rejects a record that does not satisfy its resolved schema', async () => {
    const resolver = { resolve: jest.fn(async () => schema) }

    await expect(
      prepare(
        { $type: collection, text: 'this is longer than twenty characters' },
        { validate: true, recordSchemaResolver: resolver },
      ),
    ).rejects.toThrow(InvalidRecordError)
  })

  it('fails closed without exposing resolver internals', async () => {
    const resolver = {
      resolve: jest.fn(async () => {
        throw new Error('upstream secret https://internal.example/token')
      }),
    }

    const err = await prepare(
      { $type: collection, text: 'valid' },
      {
        validate: true,
        recordSchemaResolver: resolver,
      },
    ).catch((caught) => caught)

    expect(err).toBeInstanceOf(InvalidRecordError)
    expect(err.message).toBe(`Unable to validate lexicon type: ${collection}`)
    expect(err.message).not.toMatch(/secret|internal|token/)
  })
})
