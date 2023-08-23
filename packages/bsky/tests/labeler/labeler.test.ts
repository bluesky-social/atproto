import { AtUri, AtpAgent, BlobRef } from '@atproto/api'
import { Readable } from 'stream'
import { Labeler } from '../../src/labeler'
import { Database, IndexerConfig } from '../../src'
import IndexerContext from '../../src/indexer/context'
import { cidForRecord } from '@atproto/repo'
import { keywordLabeling } from '../../src/labeler/util'
import { cidForCbor, TID } from '@atproto/common'
import { LabelService } from '../../src/services/label'
import { TestNetwork } from '@atproto/dev-env'
import { IdResolver } from '@atproto/identity'
import { SeedClient } from '../seeds/client'
import usersSeed from '../seeds/users'
import { BackgroundQueue } from '../../src/background'
import { CID } from 'multiformats/cid'

// outside of test suite so that TestLabeler can access them
let badCid1: CID | undefined = undefined
let badCid2: CID | undefined = undefined

describe('labeler', () => {
  let network: TestNetwork
  let labeler: Labeler
  let labelSrvc: LabelService
  let ctx: IndexerContext
  let labelerDid: string
  let badBlob1: BlobRef
  let badBlob2: BlobRef
  let goodBlob: BlobRef
  let alice: string
  const postUri = () => AtUri.make(alice, 'app.bsky.feed.post', TID.nextStr())

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_labeler',
    })
    ctx = network.bsky.indexer.ctx
    const pdsCtx = network.pds.ctx
    labelerDid = ctx.cfg.labelerDid
    labeler = new TestLabeler(network.bsky.indexer.ctx)
    labelSrvc = ctx.services.label(ctx.db)
    const pdsAgent = new AtpAgent({ service: network.pds.url })
    const sc = new SeedClient(pdsAgent)
    await usersSeed(sc)
    await network.processAll()
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
    badCid1 = badBlob1.ref
    badCid2 = badBlob2.ref
  })

  afterAll(async () => {
    await network.close()
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

  it('retrieves repo labels on profile views', async () => {
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

    expect(labels.length).toBe(1)
    expect(labels[0]).toMatchObject({
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
    idResolver: IdResolver
    cfg: IndexerConfig
    backgroundQueue: BackgroundQueue
  }) {
    const { db, cfg, idResolver, backgroundQueue } = opts
    super({ db, cfg, idResolver, backgroundQueue })
    this.keywords = cfg.labelerKeywords
  }

  async labelText(text: string): Promise<string[]> {
    return keywordLabeling(this.keywords, text)
  }

  async labelImg(_did: string, cid: CID): Promise<string[]> {
    if (cid.equals(badCid1)) {
      return ['img-label']
    }
    if (cid.equals(badCid2)) {
      return ['other-img-label']
    }
    return []
  }
}
