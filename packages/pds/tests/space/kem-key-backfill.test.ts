import fs from 'node:fs/promises'
import * as plc from '@did-plc/lib'
import { jest } from '@jest/globals'
import { check, fileExists } from '@atproto/common'
import { Secp256k1Keypair } from '@atproto/crypto'
import { type SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import type { DidString, HandleString } from '@atproto/lex'
import type { AppContext } from '../../src/index.js'
import { KemKeyBackfill } from '../../src/kem-key-backfill.js'

describe('kem key backfill', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'kem_key_backfill',
    })
    ctx = network.pds.ctx
    sc = network.getSeedClient()
  })

  beforeEach(async () => {
    // The PDS completed a backfill of no accounts when it started
    await ctx.accountManager.db.db
      .updateTable('kem_key_backfill_lease')
      .set({ owner: '', expiresAt: 0, completedAt: null })
      .execute()
  })

  afterAll(async () => {
    await network?.close()
  })

  const createBackfill = () =>
    new KemKeyBackfill(ctx, { leaseMs: 10_000, pollMs: 10 })

  const localKemKey = async (did: string) => {
    const kemKey = await ctx.actorStore.kemKeypair(did)
    if (!kemKey) throw new Error(`no local kem key for ${did}`)
    return kemKey.did()
  }

  const publishedKemKey = async (did: string) => {
    const data = await ctx.plcClient.getDocumentData(did)
    return data.verificationMethods['atproto_kem']
  }

  const opCount = async (did: string) =>
    (await ctx.plcClient.getOperationLog(did)).length

  const isComplete = async () => {
    const lease = await ctx.accountManager.db.db
      .selectFrom('kem_key_backfill_lease')
      .select('completedAt')
      .executeTakeFirstOrThrow()
    return lease.completedAt !== null
  }

  // Puts an account in the state an alpha account is in: no local KEM key, and
  // none in its PLC doc.
  const createAlphaAccount = async (name: string): Promise<DidString> => {
    const { did } = await sc.createAccount(name, {
      handle: `${name}.test` as HandleString,
      email: `${name}@test.com`,
      password: `${name}-pass`,
    })
    const { kemKeyLocation } = await ctx.actorStore.getLocation(did)
    await fs.rm(kemKeyLocation)
    await ctx.plcClient.updateData(did, ctx.plcRotationKey, (op) => {
      const { atproto_kem: _, ...verificationMethods } = op.verificationMethods
      return { ...op, verificationMethods }
    })
    return did
  }

  it('publishes keys, sequences identity events, and completes', async () => {
    const alice = await createAlphaAccount('alice')
    const bob = await createAlphaAccount('bob')

    await using backfill = createBackfill()
    await backfill.run()

    for (const did of [alice, bob]) {
      expect(await publishedKemKey(did)).toBe(await localKemKey(did))
      const evts = await ctx.sequencer.db.db
        .selectFrom('repo_seq')
        .select('eventType')
        .where('did', '=', did)
        .orderBy('seq', 'desc')
        .limit(1)
        .execute()
      expect(evts[0]?.eventType).toBe('identity')
    }
    expect(await isComplete()).toBe(true)
  })

  it('leaves accounts that already have a key alone', async () => {
    const { did } = await sc.createAccount('carol', {
      handle: 'carol.test' as HandleString,
      email: 'carol@test.com',
      password: 'carol-pass',
    })
    const kemKey = await localKemKey(did)
    const before = await opCount(did)

    await using backfill = createBackfill()
    await backfill.run()

    expect(await opCount(did)).toBe(before)
    expect(await localKemKey(did)).toBe(kemKey)
  })

  it('writes a key without publishing it when the pds cannot', async () => {
    const dan = await createAlphaAccount('dan')
    const ownKey = await Secp256k1Keypair.create()
    await ctx.plcClient.updateData(dan, ctx.plcRotationKey, (op) => ({
      ...op,
      rotationKeys: [ownKey.did()],
    }))
    const eve = await createAlphaAccount('eve')
    await ctx.plcClient.updateData(eve, ctx.plcRotationKey, (op) => ({
      ...op,
      services: {
        atproto_pds: {
          type: 'AtprotoPersonalDataServer',
          endpoint: 'https://elsewhere.test',
        },
      },
    }))
    const before = [await opCount(dan), await opCount(eve)]

    await using backfill = createBackfill()
    await backfill.run()

    expect([await opCount(dan), await opCount(eve)]).toEqual(before)
    for (const did of [dan, eve]) {
      const { kemKeyLocation } = await ctx.actorStore.getLocation(did)
      expect(await fileExists(kemKeyLocation)).toBe(true)
    }
    expect(await isComplete()).toBe(true)
  })

  it('retries failed accounts before completing', async () => {
    const did = await createAlphaAccount('frank')
    using updateData = jest
      .spyOn(ctx.plcClient, 'updateData')
      .mockRejectedValueOnce(new Error('plc unavailable'))

    await using backfill = createBackfill()
    await backfill.run()

    expect(updateData).toHaveBeenCalledTimes(2)
    expect(await publishedKemKey(did)).toBe(await localKemKey(did))
    expect(await isComplete()).toBe(true)
  })

  it('does not write a key after losing the lease', async () => {
    const did = await createAlphaAccount('ivan')
    const before = await opCount(did)
    const updateData = ctx.plcClient.updateData.bind(ctx.plcClient)
    using _ = jest
      .spyOn(ctx.plcClient, 'updateData')
      .mockImplementationOnce(async (...args) => {
        await updateData(...args)
        // Another process takes over while this one is mid-account
        await ctx.accountManager.db.db
          .updateTable('kem_key_backfill_lease')
          .set({ owner: 'other', expiresAt: Date.now() + 100 })
          .execute()
      })

    await using backfill = createBackfill()
    await backfill.run()

    // The first key was abandoned, and the retry published a second
    expect(await opCount(did)).toBe(before + 2)
    expect(await publishedKemKey(did)).toBe(await localKemKey(did))
    expect(await isComplete()).toBe(true)
  })

  it('runs in one process at a time', async () => {
    const did = await createAlphaAccount('gina')
    const before = await opCount(did)

    await using first = createBackfill()
    await using second = createBackfill()
    await Promise.all([first.run(), second.run()])

    expect(await opCount(did)).toBe(before + 1)
    expect(await isComplete()).toBe(true)
  })

  it('never runs again once complete', async () => {
    await using first = createBackfill()
    await first.run()
    expect(await isComplete()).toBe(true)

    const did = await createAlphaAccount('hank')
    await using second = createBackfill()
    await second.run()

    const { kemKeyLocation } = await ctx.actorStore.getLocation(did)
    expect(await fileExists(kemKeyLocation)).toBe(false)
    expect(await publishedKemKey(did)).toBeUndefined()
  })

  it('leaves the KEM key out of identity ops for an account without one', async () => {
    const did = await createAlphaAccount('ivy')
    const agent = network.pds.getAgent()
    const headers = sc.getHeaders(did)

    const { data } =
      await agent.com.atproto.identity.getRecommendedDidCredentials(undefined, {
        headers,
      })
    expect(data.verificationMethods).not.toHaveProperty('atproto_kem')

    // An op without a KEM key is accepted, as there is none it could carry
    const lastOp = await ctx.plcClient.getLastOp(did)
    if (check.is(lastOp, plc.def.tombstone)) throw new Error('tombstoned')
    const operation = await plc.createUpdateOp(
      lastOp,
      ctx.plcRotationKey,
      (op) => op,
    )
    await agent.com.atproto.identity.submitPlcOperation(
      { operation },
      { encoding: 'application/json', headers },
    )
  })
})
