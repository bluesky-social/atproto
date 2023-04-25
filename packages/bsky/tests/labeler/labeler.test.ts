import { AtUri, AtpAgent, BlobRef } from '@atproto/api'
import stream, { Readable } from 'stream'
import { Labeler } from '../../src/labeler'
import { AppContext, Database, ServerConfig } from '../../src'
import { cidForRecord } from '@atproto/repo'
import { keywordLabeling } from '../../src/labeler/util'
import { cidForCbor, streamToBytes, TID } from '@atproto/common'
import * as ui8 from 'uint8arrays'
import { LabelService } from '../../src/services/label'
import { TestEnvInfo, runTestEnv } from '@atproto/dev-env'
import { DidResolver } from '@atproto/did-resolver'
import { SeedClient } from '../seeds/client'
import usersSeed from '../seeds/users'
import { processAll } from '../_util'

describe('labeler', () => {
  let testEnv: TestEnvInfo
  let labeler: Labeler
  let labelSrvc: LabelService
  let ctx: AppContext
  let labelerDid: string
  let badBlob1: BlobRef
  let badBlob2: BlobRef
  let goodBlob: BlobRef
  let alice: string
  const postUri = () => AtUri.make(alice, 'app.bsky.feed.post', TID.nextStr())
  const profileUri = () => AtUri.make(alice, 'app.bsky.actor.profile', 'self')

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'labeler',
    })
    ctx = testEnv.bsky.ctx
    const pdsCtx = testEnv.pds.ctx
    labelerDid = ctx.cfg.labelerDid
    labeler = new TestLabeler(ctx)
    labelSrvc = ctx.services.label(ctx.db)
    const pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    const sc = new SeedClient(pdsAgent)
    await usersSeed(sc)
    await processAll(testEnv)
    alice = sc.dids.alice
    const repoSvc = pdsCtx.services.repo(pdsCtx.db)
    const storeBlob = async (bytes: Uint8Array) => {
      const blobRef = await repoSvc.blobs.addUntetheredBlob(
        alice,
        'image/jpeg',
        Readable.from([bytes], { objectMode: false }),
      )
      const preparedBlobRef = {
        cid: blobRef.ref,
        mimeType: 'image/jpeg',
        constraints: {},
      }
      await repoSvc.blobs.verifyBlobAndMakePermanent(alice, preparedBlobRef)
      await repoSvc.blobs.associateBlob(
        preparedBlobRef,
        postUri(),
        await cidForCbor(1),
        alice,
      )
      return blobRef
    }
    const bytes1 = new Uint8Array([1, 2, 3, 4])
    const bytes2 = new Uint8Array([5, 6, 7, 8])
    const bytes3 = new Uint8Array([4, 3, 2, 1])
    badBlob1 = await storeBlob(bytes1)
    badBlob2 = await storeBlob(bytes2)
    goodBlob = await storeBlob(bytes3)
  })

  afterAll(async () => {
    await testEnv.close()
  })

  it('labels text in posts', async () => {
    const post = {
      $type: 'app.bsky.feed.post',
      text: 'blah blah label_me',
      createdAt: new Date().toISOString(),
    }
    const cid = await cidForRecord(post)
    const uri = postUri()
    labeler.processRecord(uri, post)
    await labeler.processAll()
    const labels = await labelSrvc.getLabels(uri.toString())
    expect(labels.length).toBe(1)
    expect(labels[0]).toMatchObject({
      src: labelerDid,
      uri: uri.toString(),
      cid: cid.toString(),
      val: 'test-label',
      neg: false,
    })
  })

  it('labels embeds in posts', async () => {
    const post = {
      $type: 'app.bsky.feed.post',
      text: 'blah blah',
      embed: {
        $type: 'app.bsky.embed.images',
        images: [
          {
            image: badBlob1,
            alt: 'img',
          },
          {
            image: badBlob2,
            alt: 'label_me_2',
          },
          {
            image: goodBlob,
            alt: 'img',
          },
        ],
      },
      createdAt: new Date().toISOString(),
    }
    const uri = postUri()
    labeler.processRecord(uri, post)
    await labeler.processAll()
    const dbLabels = await labelSrvc.getLabels(uri.toString())
    const labels = dbLabels.map((row) => row.val).sort()
    expect(labels).toEqual(
      ['test-label', 'test-label-2', 'img-label', 'other-img-label'].sort(),
    )
  })

  it('labels text & imgs in profiles', async () => {
    const profile = {
      $type: 'app.bsky.actor.profile',
      displayName: 'label_me',
      description: 'label_me_2',
      avatar: badBlob1,
      banner: badBlob2,
      createdAt: new Date().toISOString(),
    }
    const uri = profileUri()
    labeler.processRecord(uri, profile)
    await labeler.processAll()
    const dbLabels = await labelSrvc.getLabels(uri.toString())
    const labels = dbLabels.map((row) => row.val).sort()
    expect(labels).toEqual(
      ['test-label', 'test-label-2', 'img-label', 'other-img-label'].sort(),
    )
  })

  it('retrieves both profile & repo labels on profile views', async () => {
    await ctx.db.db
      .insertInto('label')
      .values({
        src: labelerDid,
        uri: alice,
        cid: '',
        val: 'repo-label',
        neg: false,
        cts: new Date().toISOString(),
      })
      .execute()

    const labels = await labelSrvc.getLabelsForProfile(alice)
    // 4 from earlier & then just added one
    expect(labels.length).toBe(5)

    const repoLabel = labels.find((l) => l.uri.startsWith('did:'))
    expect(repoLabel).toMatchObject({
      src: labelerDid,
      uri: alice,
      val: 'repo-label',
      neg: false,
    })
  })
})

class TestLabeler extends Labeler {
  hiveApiKey: string
  keywords: Record<string, string>

  constructor(opts: {
    db: Database
    didResolver: DidResolver
    cfg: ServerConfig
  }) {
    const { db, cfg, didResolver } = opts
    super({ db, cfg, didResolver })
    this.keywords = cfg.labelerKeywords
  }

  async labelText(text: string): Promise<string[]> {
    return keywordLabeling(this.keywords, text)
  }

  async labelImg(img: stream.Readable): Promise<string[]> {
    const buf = await streamToBytes(img)
    if (ui8.equals(buf, new Uint8Array([1, 2, 3, 4]))) {
      return ['img-label']
    }

    if (ui8.equals(buf, new Uint8Array([5, 6, 7, 8]))) {
      return ['other-img-label']
    }
    return []
  }
}
