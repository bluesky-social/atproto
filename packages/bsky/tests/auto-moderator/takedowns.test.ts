import fs from 'fs/promises'
import { TestNetwork, SeedClient, ImageRef, usersSeed } from '@atproto/dev-env'
import { AtpAgent } from '@atproto/api'
import { AutoModerator } from '../../src/auto-moderator'
import { sha256RawToCid } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { ImageFlagger } from '../../src/auto-moderator/abyss'
import { ImageInvalidator } from '../../src/image/invalidator'
import { sha256 } from '@atproto/crypto'
import { ids } from '../../src/lexicon/lexicons'
import { TestOzone } from '@atproto/dev-env/src/ozone'
import { PrimaryDatabase } from '../../src'

// outside of test suite so that TestLabeler can access them
let badCid1: CID | undefined = undefined
let badCid2: CID | undefined = undefined

describe('takedowner', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let bskyDb: PrimaryDatabase
  let autoMod: AutoModerator
  let testInvalidator: TestInvalidator
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
    ozone = network.ozone
    bskyDb = network.bsky.ctx.db.getPrimary()
    autoMod = network.bsky.indexer.ctx.autoMod
    autoMod.imageFlagger = new TestFlagger()
    pdsAgent = new AtpAgent({ service: network.pds.url })
    sc = network.getSeedClient()
    await usersSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    const fileBytes1 = await fs.readFile(
      '../dev-env/src/seed/img/key-portrait-small.jpg',
    )
    const fileBytes2 = await fs.readFile(
      '../dev-env/src/seed/img/key-portrait-large.jpg',
    )
    badCid1 = sha256RawToCid(await sha256(fileBytes1))
    badCid2 = sha256RawToCid(await sha256(fileBytes2))
    goodBlob = await sc.uploadFile(
      alice,
      '../dev-env/src/seed/img/key-landscape-small.jpg',
      'image/jpeg',
    )
    badBlob1 = await sc.uploadFile(
      alice,
      '../dev-env/src/seed/img/key-portrait-small.jpg',
      'image/jpeg',
    )
    badBlob2 = await sc.uploadFile(
      alice,
      '../dev-env/src/seed/img/key-portrait-large.jpg',
      'image/jpeg',
    )
  })

  afterAll(async () => {
    await network.close()
  })

  it('takes down flagged content in posts', async () => {
    const post = await sc.post(alice, 'blah', undefined, [goodBlob, badBlob1])
    await network.processAll()
    const [modStatus, takedownEvent] = await Promise.all([
      ozone.ctx.db.db
        .selectFrom('moderation_subject_status')
        .where('did', '=', alice)
        .where(
          'recordPath',
          '=',
          `${post.ref.uri.collection}/${post.ref.uri.rkey}`,
        )
        .select(['takendown', 'id'])
        .executeTakeFirst(),
      ozone.ctx.db.db
        .selectFrom('moderation_event')
        .where('subjectDid', '=', alice)
        .where('action', '=', 'com.atproto.admin.defs#modEventTakedown')
        .selectAll()
        .executeTakeFirst(),
    ])
    if (!modStatus || !takedownEvent) {
      throw new Error('expected mod action')
    }
    expect(modStatus.takendown).toEqual(true)
    const record = await bskyDb.db
      .selectFrom('record')
      .where('uri', '=', post.ref.uriStr)
      .select('takedownRef')
      .executeTakeFirst()
    expect(record?.takedownRef).toEqual(`BSKY-TAKEDOWN-${takedownEvent.id}`)

    const recordPds = await network.pds.ctx.actorStore.read(
      post.ref.uri.hostname,
      (store) =>
        store.db.db
          .selectFrom('record')
          .where('uri', '=', post.ref.uriStr)
          .select('takedownRef')
          .executeTakeFirst(),
    )
    expect(recordPds?.takedownRef).toEqual(`BSKY-TAKEDOWN-${takedownEvent.id}`)

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
    const [modStatus, takedownEvent] = await Promise.all([
      ozone.ctx.db.db
        .selectFrom('moderation_subject_status')
        .where('did', '=', alice)
        .where('recordPath', '=', `${ids.AppBskyActorProfile}/self`)
        .select(['takendown', 'id'])
        .executeTakeFirst(),
      ozone.ctx.db.db
        .selectFrom('moderation_event')
        .where('subjectDid', '=', alice)
        .where(
          'subjectUri',
          '=',
          AtUri.make(alice, ids.AppBskyActorProfile, 'self').toString(),
        )
        .where('action', '=', 'com.atproto.admin.defs#modEventTakedown')
        .selectAll()
        .executeTakeFirst(),
    ])
    if (!modStatus || !takedownEvent) {
      throw new Error('expected mod action')
    }
    expect(modStatus.takendown).toEqual(true)
    const recordBsky = await bskyDb.db
      .selectFrom('record')
      .where('uri', '=', res.data.uri)
      .select('takedownRef')
      .executeTakeFirst()
    expect(recordBsky?.takedownRef).toEqual(`BSKY-TAKEDOWN-${takedownEvent.id}`)

    const recordPds = await network.pds.ctx.actorStore.read(alice, (store) =>
      store.db.db
        .selectFrom('record')
        .where('uri', '=', res.data.uri)
        .select('takedownRef')
        .executeTakeFirst(),
    )
    expect(recordPds?.takedownRef).toEqual(`BSKY-TAKEDOWN-${takedownEvent.id}`)

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
