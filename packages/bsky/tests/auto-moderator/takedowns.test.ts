import fs from 'fs/promises'
import { AtpAgent } from '@atproto/api'
import { AutoModerator } from '../../src/auto-moderator'
import IndexerContext from '../../src/indexer/context'
import { sha256RawToCid } from '@atproto/common'
import { TestNetwork } from '@atproto/dev-env'
import { ImageRef, SeedClient } from '../seeds/client'
import usersSeed from '../seeds/users'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { ImageFlagger } from '../../src/auto-moderator/abyss'
import { ImageInvalidator } from '../../src/image/invalidator'
import { sha256 } from '@atproto/crypto'
import { ids } from '../../src/lexicon/lexicons'

// outside of test suite so that TestLabeler can access them
let badCid1: CID | undefined = undefined
let badCid2: CID | undefined = undefined

describe('takedowner', () => {
  let network: TestNetwork
  let autoMod: AutoModerator
  let testInvalidator: TestInvalidator
  let ctx: IndexerContext
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let alice: string
  let badBlob1: ImageRef
  let badBlob2: ImageRef
  let goodBlob: ImageRef

  beforeAll(async () => {
    testInvalidator = new TestInvalidator()
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_automod_takedown',
      bsky: {
        imgInvalidator: testInvalidator,
      },
    })
    ctx = network.bsky.indexer.ctx
    autoMod = ctx.autoMod
    autoMod.imageFlagger = new TestFlagger()
    pdsAgent = new AtpAgent({ service: network.pds.url })
    sc = new SeedClient(pdsAgent)
    await usersSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    const fileBytes1 = await fs.readFile(
      'tests/image/fixtures/key-portrait-small.jpg',
    )
    const fileBytes2 = await fs.readFile(
      'tests/image/fixtures/key-portrait-large.jpg',
    )
    badCid1 = sha256RawToCid(await sha256(fileBytes1))
    badCid2 = sha256RawToCid(await sha256(fileBytes2))
    goodBlob = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-landscape-small.jpg',
      'image/jpeg',
    )
    badBlob1 = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-portrait-small.jpg',
      'image/jpeg',
    )
    badBlob2 = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-portrait-large.jpg',
      'image/jpeg',
    )
  })

  afterAll(async () => {
    await network.close()
  })

  it('takes down flagged content in posts', async () => {
    const post = await sc.post(alice, 'blah', undefined, [goodBlob, badBlob1])
    await network.processAll()
    await autoMod.processAll()
    const modAction = await ctx.db.db
      .selectFrom('moderation_action')
      .where('subjectUri', '=', post.ref.uriStr)
      .select(['action', 'id'])
      .executeTakeFirst()
    if (!modAction) {
      throw new Error('expected mod action')
    }
    expect(modAction.action).toEqual('com.atproto.admin.defs#takedown')
    const record = await ctx.db.db
      .selectFrom('record')
      .where('uri', '=', post.ref.uriStr)
      .select('takedownId')
      .executeTakeFirst()
    expect(record?.takedownId).toEqual(modAction.id)

    const recordPds = await network.pds.ctx.db.db
      .selectFrom('record')
      .where('uri', '=', post.ref.uriStr)
      .select('takedownId')
      .executeTakeFirst()
    expect(recordPds?.takedownId).toEqual(modAction.id)

    expect(testInvalidator.invalidated.length).toBe(1)
    expect(testInvalidator.invalidated[0].subject).toBe(
      badBlob1.image.ref.toString(),
    )
  })

  it('takes down flagged content in profiles', async () => {
    const res = await pdsAgent.api.com.atproto.repo.putRecord(
      {
        repo: alice,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        record: {
          avatar: badBlob2.image,
        },
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await network.processAll()
    const modAction = await ctx.db.db
      .selectFrom('moderation_action')
      .where('subjectUri', '=', res.data.uri)
      .select(['action', 'id'])
      .executeTakeFirst()
    if (!modAction) {
      throw new Error('expected mod action')
    }
    expect(modAction.action).toEqual('com.atproto.admin.defs#takedown')
    const record = await ctx.db.db
      .selectFrom('record')
      .where('uri', '=', res.data.uri)
      .select('takedownId')
      .executeTakeFirst()
    expect(record?.takedownId).toEqual(modAction.id)

    const recordPds = await network.pds.ctx.db.db
      .selectFrom('record')
      .where('uri', '=', res.data.uri)
      .select('takedownId')
      .executeTakeFirst()
    expect(recordPds?.takedownId).toEqual(modAction.id)

    expect(testInvalidator.invalidated.length).toBe(2)
    expect(testInvalidator.invalidated[1].subject).toBe(
      badBlob2.image.ref.toString(),
    )
  })
})

class TestInvalidator implements ImageInvalidator {
  public invalidated: { subject: string; paths: string[] }[] = []
  async invalidate(subject: string, paths: string[]) {
    this.invalidated.push({ subject, paths })
  }
}

class TestFlagger implements ImageFlagger {
  async scanImage(_did: string, cid: CID, _uri: AtUri): Promise<string[]> {
    if (cid.equals(badCid1)) {
      return ['kill-it']
    } else if (cid.equals(badCid2)) {
      return ['with-fire']
    }
    return []
  }
}
