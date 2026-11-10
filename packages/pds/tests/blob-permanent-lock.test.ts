import { jest } from '@jest/globals'
import SqliteDB from 'better-sqlite3'
import type { AtpAgent } from '@atproto/api'
import { type SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { parseCid } from '@atproto/lex-data'
import type { BlobStore } from '@atproto/repo'
import type { DidString } from '@atproto/syntax'
import type { AppContext } from '../src/index.js'

/**
 * Making a blob permanent is blobstore i/o: on S3-compatible storage, a copy
 * and a delete per blob, which can take seconds. It must not happen while the
 * actor db write lock is held, or every other write to that repo (and the
 * sqlite busy-retry budget of each of them) waits on the blobstore.
 *
 * A second sqlite connection probes the actor db write lock each time the
 * blobstore is asked to make a blob permanent.
 */
describe('making blobs permanent vs the actor db write lock', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent
  let sc: SeedClient
  let alice: DidString
  let probe: SqliteDB.Database

  let lockHeldDuringMakePermanent: boolean[] = []

  const writeLockHeld = (): boolean => {
    try {
      probe.exec('BEGIN IMMEDIATE')
      probe.exec('ROLLBACK')
      return false
    } catch (err) {
      if (err instanceof Error && 'code' in err && err.code === 'SQLITE_BUSY') {
        return true
      }
      throw err
    }
  }

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'blob_permanent_lock',
    })
    ctx = network.pds.ctx
    agent = network.pds.getAgent()
    sc = network.getSeedClient()
    await sc.createAccount('alice', {
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    alice = sc.dids.alice

    const { dbLocation } = await ctx.actorStore.getLocation(alice)
    probe = new SqliteDB(dbLocation, { timeout: 0 })

    // The network runs the built package, so patch the class of the blobstore
    // instances it actually creates.
    const proto: BlobStore = Object.getPrototypeOf(ctx.blobstore(alice))
    const makePermanent = proto.makePermanent
    jest.spyOn(proto, 'makePermanent').mockImplementation(function (
      this: BlobStore,
      ...args
    ) {
      lockHeldDuringMakePermanent.push(writeLockHeld())
      return makePermanent.apply(this, args)
    })
  })

  beforeEach(() => {
    lockHeldDuringMakePermanent = []
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    probe?.close()
    await network?.close()
  })

  const upload = (file: string, encoding = 'image/jpeg') =>
    sc.uploadFile(alice, `../dev-env/assets/${file}`, encoding)

  const expectPermanent = async (cid: string) => {
    const row = probe
      .prepare<[string], { tempKey: string | null }>(
        'SELECT tempKey FROM blob WHERE cid = ?',
      )
      .get(cid)
    expect(row).toEqual({ tempKey: null })
    await expect(ctx.blobstore(alice).hasStored(parseCid(cid))).resolves.toBe(
      true,
    )
  }

  it('createRecord', async () => {
    const img = await upload('key-portrait-small.jpg')
    await sc.post(alice, 'createRecord', undefined, [img])

    expect(lockHeldDuringMakePermanent).toEqual([false])
    await expectPermanent(img.image.ref.toString())
  })

  it('applyWrites', async () => {
    const img = await upload('key-landscape-small.jpg')
    await agent.com.atproto.repo.applyWrites(
      {
        repo: alice,
        writes: [
          {
            $type: 'com.atproto.repo.applyWrites#create',
            collection: 'app.bsky.feed.post',
            value: {
              $type: 'app.bsky.feed.post',
              text: 'applyWrites',
              embed: { $type: 'app.bsky.embed.images', images: [img] },
              createdAt: new Date().toISOString(),
            },
          },
        ],
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )

    expect(lockHeldDuringMakePermanent).toEqual([false])
    await expectPermanent(img.image.ref.toString())
  })

  it('putRecord', async () => {
    const img = await upload('key-alt.jpg')
    await sc.updateProfile(alice, { displayName: 'alice', avatar: img.image })

    expect(lockHeldDuringMakePermanent).toEqual([false])
    await expectPermanent(img.image.ref.toString())
  })

  it('does not serve a blob whose write failed after it was moved', async () => {
    const img = await upload('at.png', 'image/png')
    const cid = img.image.ref.toString()
    await expect(
      agent.com.atproto.repo.createRecord(
        {
          repo: alice,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text: 'bad swap',
            embed: { $type: 'app.bsky.embed.images', images: [img] },
            createdAt: new Date().toISOString(),
          },
          swapCommit: cid,
        },
        { headers: sc.getHeaders(alice), encoding: 'application/json' },
      ),
    ).rejects.toMatchObject({ error: 'InvalidSwap' })

    // The blob was moved before the write failed...
    await expect(ctx.blobstore(alice).hasStored(parseCid(cid))).resolves.toBe(
      true,
    )
    // ...but no record references it, so it is not served.
    await expect(
      agent.com.atproto.sync.getBlob({ did: alice, cid }),
    ).rejects.toThrow('Blob not found')
  })
})
