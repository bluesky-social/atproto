import { jest } from '@jest/globals'
import { l } from '@atproto/lex'
import type { LexiconDocument, LexiconObject } from '@atproto/lex-document'
import type { NsidString } from '@atproto/syntax'
import {
  PublishedRecordSchemaResolver,
  RecordSchemaResolutionError,
} from '../src/repo/record-schema-resolver.js'

const recordDocument = (
  id: string,
  property: LexiconObject['properties'][string] = { type: 'string' },
): LexiconDocument => ({
  lexicon: 1,
  id: id as NsidString,
  defs: {
    main: {
      type: 'record',
      key: 'tid',
      record: {
        type: 'object',
        required: ['value'],
        properties: { value: property },
      },
    },
  },
})

const objectDocument = (id: string): LexiconDocument => ({
  lexicon: 1,
  id: id as NsidString,
  defs: {
    main: {
      type: 'object',
      required: ['value'],
      properties: { value: { type: 'string' } },
    },
  },
})

const recordDocumentWithRefs = (
  id: string,
  refs: readonly string[],
): LexiconDocument => ({
  lexicon: 1,
  id: id as NsidString,
  defs: {
    main: {
      type: 'record',
      key: 'tid',
      record: {
        type: 'object',
        required: refs.map((_, i) => `value${i}`),
        properties: Object.fromEntries(
          refs.map((ref, i) => [
            `value${i}`,
            { type: 'ref' as const, ref: `${ref}#main` },
          ]),
        ),
      },
    },
  },
})

describe('PublishedRecordSchemaResolver', () => {
  it('builds a record validator, including published cross-document refs', async () => {
    const documents = new Map<string, LexiconDocument>([
      [
        'com.example.message',
        recordDocument('com.example.message', {
          type: 'ref',
          ref: 'com.example.value#main',
        }),
      ],
      ['com.example.value', objectDocument('com.example.value')],
    ])
    const get = jest.fn(async (nsid: string) => {
      const lexicon = documents.get(nsid)
      if (!lexicon) throw new Error('missing fixture')
      return { lexicon }
    })
    const resolver = new PublishedRecordSchemaResolver({ get })

    const schema = await resolver.resolve('com.example.message' as NsidString)

    expect(schema).toBeInstanceOf(l.RecordSchema)
    expect(
      schema.safeValidate({
        $type: 'com.example.message',
        value: { value: 'ok' },
      }),
    ).toMatchObject({ success: true })
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('singleflights concurrent requests and caches successful schemas', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const get = jest.fn(async () => {
      await gate
      return { lexicon: recordDocument('com.example.message') }
    })
    const resolver = new PublishedRecordSchemaResolver({ get })

    const pending = Array.from({ length: 3 }, () =>
      resolver.resolve('com.example.message' as NsidString),
    )
    release?.()
    const [first, second, third] = await Promise.all(pending)

    expect(first).toBe(second)
    expect(second).toBe(third)
    expect(await resolver.resolve('com.example.message' as NsidString)).toBe(
      first,
    )
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('expires and bounds the positive cache', async () => {
    let now = 0
    const get = jest.fn(async (nsid: string) => ({
      lexicon: recordDocument(nsid),
    }))
    const resolver = new PublishedRecordSchemaResolver(
      { get },
      {
        maxPositiveEntries: 1,
        positiveTtlMs: 10,
        now: () => now,
      },
    )

    await resolver.resolve('com.example.one' as NsidString)
    await resolver.resolve('com.example.two' as NsidString)
    await resolver.resolve('com.example.one' as NsidString)
    expect(get).toHaveBeenCalledTimes(3)

    now = 11
    await resolver.resolve('com.example.one' as NsidString)
    expect(get).toHaveBeenCalledTimes(4)
  })

  it('negatively caches failures with a bounded TTL and sanitized error', async () => {
    let now = 0
    const get = jest.fn(async () => {
      throw new Error(
        'secret upstream detail at https://internal.example/did:plc:sensitive',
      )
    })
    const resolver = new PublishedRecordSchemaResolver(
      { get },
      {
        maxNegativeEntries: 1,
        negativeTtlMs: 10,
        now: () => now,
      },
    )

    const first = await resolver
      .resolve('com.example.missing' as NsidString)
      .catch((err) => err)
    expect(first).toBeInstanceOf(RecordSchemaResolutionError)
    expect(first.message).toBe(
      'Unable to resolve record schema for com.example.missing',
    )
    expect(first.message).not.toMatch(/secret|internal|did:plc/)

    await expect(
      resolver.resolve('com.example.missing' as NsidString),
    ).rejects.toThrow('Unable to resolve record schema for com.example.missing')
    expect(get).toHaveBeenCalledTimes(1)

    now = 11
    await expect(
      resolver.resolve('com.example.missing' as NsidString),
    ).rejects.toThrow(RecordSchemaResolutionError)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('fails closed when the published main definition is not a record', async () => {
    const get = jest.fn(async () => ({
      lexicon: objectDocument('com.example.object'),
    }))
    const resolver = new PublishedRecordSchemaResolver({ get })

    await expect(
      resolver.resolve('com.example.object' as NsidString),
    ).rejects.toThrow('Unable to resolve record schema for com.example.object')
  })

  it('bounds cross-document resolution and negatively caches the failure', async () => {
    const get = jest.fn(async (nsid: string) => ({
      lexicon:
        nsid === 'com.example.message'
          ? recordDocument('com.example.message', {
              type: 'ref',
              ref: 'com.example.value#main',
            })
          : objectDocument(nsid),
    }))
    const resolver = new PublishedRecordSchemaResolver(
      { get },
      { maxDocumentsPerSchema: 1 },
    )

    await expect(
      resolver.resolve('com.example.message' as NsidString),
    ).rejects.toThrow('Unable to resolve record schema for com.example.message')
    await expect(
      resolver.resolve('com.example.message' as NsidString),
    ).rejects.toThrow(RecordSchemaResolutionError)
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('bounds the aggregate number of definitions resolved per build', async () => {
    const root = 'com.example.message'
    const refs = ['com.example.valueOne', 'com.example.valueTwo']
    const get = jest.fn(async (nsid: string) => ({
      lexicon:
        nsid === root
          ? recordDocumentWithRefs(root, refs)
          : objectDocument(nsid),
    }))
    const resolver = new PublishedRecordSchemaResolver(
      { get },
      {
        maxDocumentsPerSchema: 10,
        // The root plus only one referenced definition may be resolved.
        maxReferencesPerSchema: 2,
      },
    )

    await expect(resolver.resolve(root as NsidString)).rejects.toThrow(
      `Unable to resolve record schema for ${root}`,
    )
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('bounds per-build document fetch concurrency', async () => {
    const root = 'com.example.message'
    const refs = Array.from({ length: 5 }, (_, i) => `com.example.value${i}`)
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let active = 0
    let maxActive = 0
    const get = jest.fn(async (nsid: string) => {
      if (nsid === root) {
        return { lexicon: recordDocumentWithRefs(root, refs) }
      }
      active += 1
      maxActive = Math.max(maxActive, active)
      await gate
      active -= 1
      return { lexicon: objectDocument(nsid) }
    })
    const resolver = new PublishedRecordSchemaResolver(
      { get },
      { maxFetchConcurrency: 2 },
    )

    const pending = resolver.resolve(root as NsidString)
    while (get.mock.calls.length < 3) {
      await new Promise<void>((resolve) => setImmediate(resolve))
    }
    expect(maxActive).toBe(2)
    release?.()
    await expect(pending).resolves.toBeInstanceOf(l.RecordSchema)
    expect(maxActive).toBe(2)
  })

  it('evicts the oldest failure when the negative cache is full', async () => {
    const get = jest.fn(async () => {
      throw new Error('not published')
    })
    const resolver = new PublishedRecordSchemaResolver(
      { get },
      { maxNegativeEntries: 1 },
    )

    await expect(
      resolver.resolve('com.example.one' as NsidString),
    ).rejects.toThrow(RecordSchemaResolutionError)
    await expect(
      resolver.resolve('com.example.two' as NsidString),
    ).rejects.toThrow(RecordSchemaResolutionError)
    await expect(
      resolver.resolve('com.example.one' as NsidString),
    ).rejects.toThrow(RecordSchemaResolutionError)
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('bounds concurrent root resolutions', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const get = jest.fn(async (nsid: string) => {
      await gate
      return { lexicon: recordDocument(nsid) }
    })
    const resolver = new PublishedRecordSchemaResolver(
      { get },
      { maxInflightResolutions: 1 },
    )

    const first = resolver.resolve('com.example.one' as NsidString)
    await expect(
      resolver.resolve('com.example.two' as NsidString),
    ).rejects.toThrow('Unable to resolve record schema for com.example.two')
    expect(get).toHaveBeenCalledTimes(1)

    release?.()
    await expect(first).resolves.toBeInstanceOf(l.RecordSchema)
  })

  it('applies a build deadline and sanitizes the timeout', async () => {
    const get = jest.fn(() => new Promise<never>(() => {}))
    const resolver = new PublishedRecordSchemaResolver(
      { get },
      { buildTimeoutMs: 5 },
    )

    await expect(
      resolver.resolve('com.example.slow' as NsidString),
    ).rejects.toThrow('Unable to resolve record schema for com.example.slow')
  })
})
