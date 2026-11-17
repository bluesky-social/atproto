import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { P256Keypair } from '@atproto/crypto'
import type { Did, DidDocument } from '@atproto/did'
import { XrpcAuthenticationError } from '@atproto/lex-client'
import { LexValidationError, l } from '@atproto/lex-schema'
import { createSpaceCredential } from '@atproto/space'
import { collect, nsidOf, recordCalls } from '../tests/_util.js'
import type { AtprotoDidResolver } from './atproto-did-resolver.js'
import { com } from './lexicons/index.js'
import type { NotifyRegistration } from './space-credential-provider.js'
import { SpaceReader } from './space-reader.js'

const { authorizeSpaceSync, listRecords, listWriters, defs } = com.atproto.space

const AUTHORITY = 'did:plc:authority'
const ALICE = 'did:plc:alice'
const BOB = 'did:plc:bob'
const REV = '3jzfcijpj2z2a'
const CID = 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'

const note = l.record('tid', 'com.example.note', l.object({ text: l.string() }))
const other = l.record('tid', 'com.example.other', l.object({}))

const task = l.record(
  'tid',
  'com.example.task',
  l.object({ done: l.boolean() }),
)

const group = l.space('any', 'com.example.group', [note, task])
const SPACE = `at://${AUTHORITY}/space/${group.spaceType}/main` as const

type Route = (request: Request) => Response | Promise<Response>

const reply =
  (body: unknown, status = 200): Route =>
  () =>
    Response.json(body, { status })

/** Serves each request with the next of `routes`. */
const inTurn =
  (...routes: Route[]): Route =>
  (request) =>
    routes.shift()!(request)

const unauthorized = reply(
  { error: 'AuthenticationRequired', message: 'Revoked' },
  401,
)

// The client does not check the credential's signature.
const mintCredential: Route = async (request) => {
  const { space, credentialKey } = await request.json()
  const credential = await createSpaceCredential({
    iss: AUTHORITY,
    sub: space,
    keyId: credentialKey,
    keypair: await P256Keypair.create(),
  })
  return Response.json({ credential })
}

/**
 * A reader of `SPACE`, whose accounts are all hosted by one PDS, serving
 * `routes` by NSID (and minting credentials, by default).
 */
function stubSpace(
  routes: Record<string, Route> = {},
  options?: SpaceReader.Options,
) {
  const served: Record<string, Route> = {
    [authorizeSpaceSync.$lxm]: mintCredential,
    ...routes,
  }
  const resolve = vi.fn(async (did: Did): Promise<DidDocument> => ({
    id: did,
    service: [
      {
        id: '#atproto_pds',
        type: 'AtprotoPersonalDataServer',
        serviceEndpoint: 'https://pds.example',
      },
    ],
  }))
  const calls = recordCalls(async (request) => {
    const route = served[nsidOf(request)]
    if (!route) throw new Error(`Unexpected request to ${request.url}`)
    return route(request)
  })
  const reader = SpaceReader.openSpace(group, SPACE, {
    fetch: calls.fetch,
    didResolver: { resolve } as unknown as AtprotoDidResolver,
    ...options,
  })
  return { reader, resolve, to: calls.to }
}

const cursorOf = (request: Request) =>
  new URL(request.url).searchParams.get('cursor')

const write = (repo: string) => ({
  $type: defs.repoWrite.$type,
  repo,
  repoRev: REV,
  data: { $bytes: 'AAAA' },
  spaceRev: REV,
})

const listed = (rkey: string, collection: string, value?: object) => ({
  collection,
  rkey,
  cid: CID,
  value,
})

const record = (rkey: string) => listed(rkey, note.$type, { $type: note.$type })

const collectionOf = (request: Request) =>
  new URL(request.url).searchParams.get('collection')

/** One record for each way a listed record is classified. */
const classified = [
  listed('valid', note.$type, note.$build({ text: 'hello' })),
  listed('invalid', note.$type, { $type: note.$type }),
  listed('task', task.$type, task.$build({ done: true })),
  listed('undeclared', other.$type, { $type: other.$type }),
  listed('mislisted', note.$type, task.$build({ done: true })),
  listed('untyped', note.$type, { text: 'hello' }),
  listed('excluded', note.$type),
]

describe(SpaceReader, () => {
  describe('writers', () => {
    it('follows the cursor across pages', async () => {
      const { reader, to } = stubSpace({
        [listWriters.$lxm]: inTurn(
          reply({ repos: [write(ALICE)], cursor: 'page2' }),
          reply({ repos: [write(BOB)] }),
        ),
      })

      const writers = await collect(reader.writers())
      expect(writers.map((w) => w.repo)).toEqual([ALICE, BOB])
      expect(to(listWriters).map(cursorOf)).toEqual([null, 'page2'])
    })

    it('stops when the host repeats the cursor', async () => {
      const { reader, to } = stubSpace({
        [listWriters.$lxm]: inTurn(
          reply({ repos: [write(ALICE)], cursor: 'page2' }),
          reply({ repos: [write(BOB)], cursor: 'page2' }),
        ),
      })

      const writers = await collect(reader.writers())
      expect(writers.map((w) => w.repo)).toEqual([ALICE, BOB])
      expect(to(listWriters)).toHaveLength(2)
    })

    it('skips entries of an unknown kind', async () => {
      const { reader } = stubSpace({
        [listWriters.$lxm]: reply({
          repos: [
            write(ALICE),
            { $type: 'com.example.future#repoFrozen', repo: BOB },
            { $type: defs.repoRemoved.$type, repo: BOB, spaceRev: REV },
          ],
        }),
      })

      expect(await collect(reader.writers())).toEqual([
        expect.objectContaining({ $type: defs.repoWrite.$type, repo: ALICE }),
        expect.objectContaining({ $type: defs.repoRemoved.$type, repo: BOB }),
      ])
    })
  })

  describe('records', () => {
    it('follows the cursor across pages', async () => {
      const { reader, to } = stubSpace({
        [listRecords.$lxm]: inTurn(
          reply({ records: [record('a')], cursor: 'page2' }),
          reply({ records: [record('b')] }),
        ),
      })

      const records = await collect(reader.records({ repo: ALICE }))
      expect(records.map((r) => r.rkey)).toEqual(['a', 'b'])
      expect(to(listRecords).map(cursorOf)).toEqual([null, 'page2'])
    })

    it('stops when the host repeats the cursor', async () => {
      const { reader, to } = stubSpace({
        [listRecords.$lxm]: inTurn(
          reply({ records: [record('a')], cursor: 'page2' }),
          reply({ records: [record('b')], cursor: 'page2' }),
        ),
      })

      const records = await collect(reader.records({ repo: ALICE }))
      expect(records.map((r) => r.rkey)).toEqual(['a', 'b'])
      expect(to(listRecords)).toHaveLength(2)
    })

    it("validates records against the space type's schemas", async () => {
      const { reader, to } = stubSpace({
        [listRecords.$lxm]: reply({ records: classified }),
      })

      const records = await collect(reader.records({ repo: ALICE }))
      expect(records.map((r) => [r.rkey, r.valid])).toEqual([
        ['valid', true],
        ['invalid', false],
        ['task', true],
        ['undeclared', false],
        ['mislisted', false],
        ['untyped', false],
        ['excluded', false],
      ])
      for (const r of records) {
        if (!r.valid) expect(r.error).toBeInstanceOf(LexValidationError)
      }
      expect(records.find((r) => r.rkey === 'undeclared')).toMatchObject({
        error: {
          issues: [{ path: ['$type'], values: [note.$type, task.$type] }],
        },
      })
      expect(records.find((r) => r.rkey === 'mislisted')).toMatchObject({
        error: { issues: [{ path: ['$type'], values: [note.$type] }] },
      })
      expect(to(listRecords).map(collectionOf)).toEqual([null])

      type Item = (typeof records)[number]
      expectTypeOf<Item['valid']>().toEqualTypeOf<boolean>()
      expectTypeOf<
        Extract<Item, { valid: true }>['collection']
      >().toEqualTypeOf<typeof note.$type | typeof task.$type>()
      expectTypeOf<
        Extract<Item, { collection: typeof note.$type }>['value']['text']
      >().toEqualTypeOf<string>()
      expectTypeOf<
        Extract<Item, { collection: typeof task.$type }>['value']['done']
      >().toEqualTypeOf<boolean>()
    })
  })

  describe('list', () => {
    it('flags records listed outside of the requested collection', async () => {
      const { reader, to } = stubSpace({
        [listRecords.$lxm]: reply({ records: classified }),
      })

      const { records } = await reader.list(note.$type, { repo: ALICE })
      expect(records.map((r) => [r.rkey, r.valid])).toEqual([
        ['valid', true],
        ['invalid', false],
        ['task', false],
        ['undeclared', false],
        ['mislisted', false],
        ['untyped', false],
        ['excluded', false],
      ])
      expect(records.find((r) => r.rkey === 'task')).toMatchObject({
        error: { issues: [{ path: ['$type'], values: [note.$type] }] },
      })
      expect(to(listRecords).map(collectionOf)).toEqual([note.$type])
      type Item = (typeof records)[number]
      expectTypeOf<Item['valid']>().toEqualTypeOf<boolean>()
      expectTypeOf<
        Extract<Item, { valid: true }>['value']['text']
      >().toEqualTypeOf<string>()

      expect(
        await collect(reader.listAll(note.$type, { repo: ALICE })),
      ).toEqual(records)
    })

    it('refuses collections not declared by the space type', async () => {
      const { reader, to } = stubSpace()

      await expect(
        // @ts-expect-error not a collection of the space type
        reader.list(other.$type, { repo: ALICE }),
      ).rejects.toThrow(
        `${other.$type} is not a collection of ${group.spaceType} spaces`,
      )
      await expect(
        // @ts-expect-error not a collection of the space type
        reader.listAll(other.$type, { repo: ALICE }).next(),
      ).rejects.toThrow(TypeError)
      expect(to(listRecords)).toHaveLength(0)
    })
  })

  describe('credentials', () => {
    it('renews a credential the host rejects, and retries with it', async () => {
      const { reader, to } = stubSpace({
        [listWriters.$lxm]: inTurn(unauthorized, reply({ repos: [] })),
      })

      await expect(reader.listWriters()).resolves.toMatchObject({
        body: { repos: [] },
      })
      expect(to(authorizeSpaceSync)).toHaveLength(2)

      const [rejected, retried] = to(listWriters)
      const { token } = await reader.authorize()
      expect(retried.headers.get('authorization')).toBe(
        `Atproto-Space-Credential ${token}`,
      )
      expect(rejected.headers.get('authorization')).not.toBe(
        retried.headers.get('authorization'),
      )
    })

    it('renews a rejected credential only once', async () => {
      const { reader, to } = stubSpace({ [listWriters.$lxm]: unauthorized })

      await expect(reader.listWriters()).rejects.toBeInstanceOf(
        XrpcAuthenticationError,
      )
      expect(to(authorizeSpaceSync)).toHaveLength(2)
      expect(to(listWriters)).toHaveLength(2)
    })

    it('re-resolves the space authority when renewing', async () => {
      const { reader, resolve } = stubSpace()
      await reader.authorize()
      resolve.mockClear()

      await reader.authorize({ renew: true })
      expect(resolve).toHaveBeenCalledExactlyOnceWith(
        AUTHORITY,
        expect.objectContaining({ noCache: true }),
      )
    })

    it('forgets the credential of a deleted space', async () => {
      const { reader, to } = stubSpace({
        [authorizeSpaceSync.$lxm]: inTurn(
          mintCredential,
          reply({ error: 'SpaceDeleted', message: 'Deleted' }, 400),
          mintCredential,
        ),
      })

      await reader.authorize()
      await expect(reader.authorize({ renew: true })).rejects.toMatchObject({
        error: 'SpaceDeleted',
      })
      await reader.authorize()
      expect(to(authorizeSpaceSync)).toHaveLength(3)
    })

    it('registers for notifications with every credential', async () => {
      const notify: NotifyRegistration = {
        endpoint: 'https://syncer.example',
        token: 'secret',
      }
      const { reader, to } = stubSpace(
        {},
        { notifyRegistrationProvider: async () => notify },
      )

      await reader.authorize()
      await reader.authorize({ renew: true })

      const bodies = await Promise.all(
        to(authorizeSpaceSync).map((request) => request.json()),
      )
      expect(bodies).toEqual([
        expect.objectContaining({ notify }),
        expect.objectContaining({ notify }),
      ])
    })
  })
})
