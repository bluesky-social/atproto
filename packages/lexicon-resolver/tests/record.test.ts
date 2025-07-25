import { dataToCborBlock } from '@atproto/common'
import { SeedClient, TestNetworkNoAppView, usersSeed } from '@atproto/dev-env'
import { resolveRecord } from '../src/record.js'

describe.only('Record resolution', () => {
  let network: TestNetworkNoAppView
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'lex_record_resolution',
    })
    sc = network.getSeedClient()
    await usersSeed(sc)
  })

  afterAll(async () => {
    await network.close()
  })

  it('resolves record by AT-URI object.', async () => {
    const post = await sc.post(sc.dids.alice, 'post1')
    const result = await resolveRecord(post.ref.uri, {
      rpc: { fetch },
      idResolver: network.pds.ctx.idResolver,
    })
    expect(result.commit.did).toEqual(sc.dids.alice)
    expect(result.cid.toString()).toEqual(post.ref.cidStr)
    expect(result.uri.toString()).toEqual(post.ref.uriStr)
    expect(result.record.text).toEqual('post1')
  })

  it('resolves record by AT-URI string.', async () => {
    const post = await sc.post(sc.dids.alice, 'post2')
    const result = await resolveRecord(post.ref.uriStr, {
      rpc: { fetch },
      idResolver: network.pds.ctx.idResolver,
    })
    expect(result.commit.did).toEqual(sc.dids.alice)
    expect(result.cid.toString()).toEqual(post.ref.cidStr)
    expect(result.uri.toString()).toEqual(post.ref.uriStr)
    expect(result.record.text).toEqual('post2')
  })

  it("does not resolve record that doesn't exist.", async () => {
    await expect(
      resolveRecord(`at://${sc.dids.alice}/app.bsky.feed.post/2222222222222`, {
        rpc: { fetch },
        idResolver: network.pds.ctx.idResolver,
      }),
    ).rejects.toThrow('Record not found')
  })

  it('does not resolve record with bad commit signature.', async () => {
    const post = await sc.post(sc.dids.alice, 'post3')
    const verified = await resolveRecord(post.ref.uri, {
      rpc: { fetch },
      idResolver: network.pds.ctx.idResolver,
    })
    const goodCommitBlock = await dataToCborBlock(verified.commit)
    const badCommitBlock = await dataToCborBlock({
      ...verified.commit,
      sig: new Uint8Array(),
    })
    await network.pds.ctx.actorStore.transact(sc.dids.alice, (txn) =>
      txn.repo.db.db
        .updateTable('repo_block')
        .set({
          content: badCommitBlock.bytes,
          size: badCommitBlock.bytes.byteLength,
        })
        .where('cid', '=', goodCommitBlock.cid.toString())
        .execute(),
    )
    await expect(
      resolveRecord(post.ref.uri, {
        rpc: { fetch },
        idResolver: network.pds.ctx.idResolver,
      }),
    ).rejects.toThrow('Invalid signature on commit')
  })
})
