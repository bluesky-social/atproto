import { AtUri, BlobRef } from '@atproto/api'
import stream from 'stream'
import { runTestServer, CloseFn } from '../_util'
import { Labeler } from '../../src/labeler'
import { AppContext, Database } from '../../src'
import { BlobStore, cidForRecord } from '@atproto/repo'
import { keywordLabeling } from '../../src/labeler/util'
import { cidForCbor, streamToBytes, TID } from '@atproto/common'
import * as ui8 from 'uint8arrays'
import { LabelService } from '../../src/app-view/services/label'
import { BackgroundQueue } from '../../src/event-stream/background-queue'

describe('labeler', () => {
  let close: CloseFn
  let labeler: Labeler
  let labelSrvc: LabelService
  let ctx: AppContext
  let labelerDid: string
  let badBlob1: BlobRef
  let badBlob2: BlobRef
  let goodBlob: BlobRef

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_author_feed',
    })
    close = server.close
    ctx = server.ctx
    labelerDid = ctx.cfg.labelerDid
    labeler = new TestLabeler({
      db: ctx.db,
      blobstore: ctx.blobstore,
      backgroundQueue: ctx.backgroundQueue,
      labelerDid,
      keywords: { label_me: 'test-label', another_label: 'another-label' },
    })
    labelSrvc = ctx.services.appView.label(ctx.db)
    const bytes1 = new Uint8Array([1, 2, 3, 4])
    const bytes2 = new Uint8Array([5, 6, 7, 8])
    const bytes3 = new Uint8Array([4, 3, 2, 1])
    const cid1 = await cidForCbor(bytes1)
    const cid2 = await cidForCbor(bytes2)
    const cid3 = await cidForCbor(bytes3)
    ctx.blobstore.putPermanent(cid1, bytes1)
    ctx.blobstore.putPermanent(cid2, bytes2)
    ctx.blobstore.putPermanent(cid3, bytes3)
    badBlob1 = new BlobRef(cid1, 'image/jpeg', 4)
    badBlob2 = new BlobRef(cid2, 'image/jpeg', 4)
    goodBlob = new BlobRef(cid3, 'image/jpeg', 4)
  })

  afterAll(async () => {
    await close()
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
            alt: 'another_label',
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
      ['another-label', 'img-label', 'other-img-label'].sort(),
    )
  })

  it('retrieves repo labels on profile views', async () => {
    await ctx.db.db
      .insertInto('label')
      .values({
        src: labelerDid,
        uri: aliceDid,
        cid: '',
        val: 'repo-label',
        neg: 0,
        cts: new Date().toISOString(),
      })
      .execute()

    const labels = await labelSrvc.getLabelsForProfile('did:example:alice')
    // 4 from earlier & then just added one
    expect(labels.length).toBe(1)
    expect(labels[0]).toMatchObject({
      src: labelerDid,
      uri: aliceDid,
      val: 'repo-label',
      neg: false,
    })
  })
})

const aliceDid = 'did:example:alice'

const postUri = () => AtUri.make(aliceDid, 'app.bsky.feed.post', TID.nextStr())

class TestLabeler extends Labeler {
  hiveApiKey: string
  keywords: Record<string, string>

  constructor(opts: {
    db: Database
    blobstore: BlobStore
    backgroundQueue: BackgroundQueue
    labelerDid: string
    keywords: Record<string, string>
  }) {
    const { db, blobstore, backgroundQueue, labelerDid, keywords } = opts
    super({ db, blobstore, backgroundQueue, labelerDid })
    this.keywords = keywords
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
