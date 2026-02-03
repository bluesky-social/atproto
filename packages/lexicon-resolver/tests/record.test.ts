import { dataToCborBlock } from '@atproto/common'
import { SeedClient, TestNetworkNoAppView, usersSeed } from '@atproto/dev-env'
import { AtprotoRecordResolver, buildRecordResolver } from '../src/index.js'

describe('Record resolution', () => {
  let network: TestNetworkNoAppView
  let sc: SeedClient
  let resolveRecord: AtprotoRecordResolver

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'lex_record_resolution',
    })
    sc = network.getSeedClient()
    await usersSeed(sc)
    resolveRecord = buildRecordResolver({
      rpc: { fetch },
      idResolver: network.pds.ctx.idResolver,
    })
  })

  afterAll(async () => {
    await network.close()
  })

  it('resolves record by AT-URI object.', async () => {
    const post = await sc.post(sc.dids.alice, 'post1')
    const result = await resolveRecord(post.ref.uri, {
      forceRefresh: true,
    })
    expect(result.commit.did).toEqual(sc.dids.alice)
    expect(result.cid.toString()).toEqual(post.ref.cidStr)
    expect(result.uri.toString()).toEqual(post.ref.uriStr)
    expect(result.record.text).toEqual('post1')
  })

  it('resolves record by AT-URI string.', async () => {
    const post = await sc.post(sc.dids.alice, 'post2')
    const result = await resolveRecord(post.ref.uriStr, {
      forceRefresh: true,
    })
    expect(result.commit.did).toEqual(sc.dids.alice)
    expect(result.cid.toString()).toEqual(post.ref.cidStr)
    expect(result.uri.toString()).toEqual(post.ref.uriStr)
    expect(result.record.text).toEqual('post2')
  })

  it("does not resolve record that doesn't exist.", async () => {
    await expect(
      resolveRecord(`at://${sc.dids.alice}/app.bsky.feed.post/2222222222222`, {
        forceRefresh: true,
      }),
    ).rejects.toThrow('Record not found')
  })

  it('does not resolve record with bad commit signature.', async () => {
    const alicekey = await network.pds.ctx.actorStore.keypair(sc.dids.alice)
    const bobkey = await network.pds.ctx.actorStore.keypair(sc.dids.bob)
    const post = await sc.post(sc.dids.alice, 'post3')
    // switch alice's key away from the one used by her pds
    await network.pds.ctx.plcClient.updateAtprotoKey(
      sc.dids.alice,
      network.pds.ctx.plcRotationKey,
      bobkey.did(),
    )
    await expect(
      resolveRecord(post.ref.uri, {
        forceRefresh: true,
      }),
    ).rejects.toThrow('Invalid signature on commit')
    // reset alice's key
    await network.pds.ctx.plcClient.updateAtprotoKey(
      sc.dids.alice,
      network.pds.ctx.plcRotationKey,
      alicekey.did(),
    )
  })

  it('does not resolve record with corrupted CAR block.', async () => {
    const post = await sc.post(sc.dids.alice, 'post4')
    const badBlock = await dataToCborBlock({})
    await network.pds.ctx.actorStore.transact(sc.dids.alice, (txn) =>
      txn.repo.db.db
        .updateTable('repo_block')
        .set({
          content: badBlock.bytes,
          size: badBlock.bytes.byteLength,
        })
        .where('cid', '=', post.ref.cidStr)
        .execute(),
    )
    await expect(
      resolveRecord(post.ref.uri, {
        forceRefresh: true,
      }),
    ).rejects.toThrow('Malformed record proof')
  })

  it('does not resolve record with missing signing key.', async () => {
    const post = await sc.post(sc.dids.alice, 'post5')
    await network.pds.ctx.plcClient.updateData(
      sc.dids.alice,
      network.pds.ctx.plcRotationKey,
      (doc) => {
        doc.verificationMethods = {
          not_atproto: doc.verificationMethods.atproto,
        }
        return doc
      },
    )
    await expect(
      resolveRecord(post.ref.uri, {
        forceRefresh: true,
      }),
    ).rejects.toThrow('Incomplete DID identity data: missing signing key')
    // reset alice's key
    await network.pds.ctx.plcClient.updateData(
      sc.dids.alice,
      network.pds.ctx.plcRotationKey,
      (doc) => {
        doc.verificationMethods = {
          atproto: doc.verificationMethods.not_atproto,
        }
        return doc
      },
    )
  })

  it('does not resolve record with missing pds.', async () => {
    const post = await sc.post(sc.dids.alice, 'post6')
    await network.pds.ctx.plcClient.updateData(
      sc.dids.alice,
      network.pds.ctx.plcRotationKey,
      (doc) => {
        doc.services = {
          not_atproto_pds: doc.services.atproto_pds,
        }
        return doc
      },
    )
    await expect(
      resolveRecord(post.ref.uri, {
        forceRefresh: true,
      }),
    ).rejects.toThrow('Incomplete DID identity data: missing pds')
    // reset alice's pds
    await network.pds.ctx.plcClient.updateData(
      sc.dids.alice,
      network.pds.ctx.plcRotationKey,
      (doc) => {
        doc.services = {
          atproto_pds: doc.services.not_atproto_pds,
        }
        return doc
      },
    )
  })

  it('resolves record despite missing at:// handle.', async () => {
    const post = await sc.post(sc.dids.alice, 'post7')
    await network.pds.ctx.plcClient.updateData(
      sc.dids.alice,
      network.pds.ctx.plcRotationKey,
      (doc) => {
        doc.alsoKnownAs = doc.alsoKnownAs.map((aka) =>
          aka.replace('at://', 'notat://'),
        )
        return doc
      },
    )
    const result = await resolveRecord(post.ref.uriStr, {
      forceRefresh: true,
    })
    expect(result.commit.did).toEqual(sc.dids.alice)
    expect(result.cid.toString()).toEqual(post.ref.cidStr)
    expect(result.uri.toString()).toEqual(post.ref.uriStr)
    expect(result.record.text).toEqual('post7')
    // reset alice's handle
    await network.pds.ctx.plcClient.updateData(
      sc.dids.alice,
      network.pds.ctx.plcRotationKey,
      (doc) => {
        doc.alsoKnownAs = doc.alsoKnownAs.map((aka) =>
          aka.replace('notat://', 'at://'),
        )
        return doc
      },
    )
  })
})
