import { AtUri, BlobRef } from '@atproto/api'
import stream from 'stream'
import { runTestServer, CloseFn } from '../_util'
import { Labeler } from '../../src/labeler'
import { Database } from '../../src'
import { BlobStore, cidForRecord } from '@atproto/repo'
import { keywordLabeling } from '../../src/labeler/util'
import { cidForCbor, streamToBytes, TID } from '@atproto/common'
import * as ui8 from 'uint8arrays'

describe('labeler', () => {
  let close: CloseFn
  let labeler: Labeler
  let blobstore: BlobStore
  let db: Database
  let labelerDid: string
  let badBlob1: BlobRef
  let badBlob2: BlobRef
  let goodBlob: BlobRef

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_author_feed',
    })
    close = server.close
    blobstore = server.ctx.blobstore
    db = server.ctx.db
    labelerDid = server.ctx.cfg.labelerDid
    labeler = new TestLabeler({
      db,
      blobstore,
      labelerDid,
      keywords: { label_me: 'test-label', another_label: 'another-label' },
    })
    const bytes1 = new Uint8Array([1, 2, 3, 4])
    const bytes2 = new Uint8Array([5, 6, 7, 8])
    const bytes3 = new Uint8Array([4, 3, 2, 1])
    const cid1 = await cidForCbor(bytes1)
    const cid2 = await cidForCbor(bytes2)
    const cid3 = await cidForCbor(bytes3)
    blobstore.putPermanent(cid1, bytes1)
    blobstore.putPermanent(cid2, bytes2)
    blobstore.putPermanent(cid3, bytes3)
    badBlob1 = new BlobRef(cid1, 'image/jpeg', 4)
    badBlob2 = new BlobRef(cid2, 'image/jpeg', 4)
    goodBlob = new BlobRef(cid3, 'image/jpeg', 4)
  })

  afterAll(async () => {
    await close()
  })

  const getLabels = async (uri: AtUri) => {
    return await db.db
      .selectFrom('label')
      .where('subjectUri', '=', uri.toString())
      .selectAll()
      .execute()
  }

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
    const labels = await getLabels(uri)
    expect(labels.length).toBe(1)
    expect(labels[0]).toMatchObject({
      sourceDid: labelerDid,
      subjectUri: uri.toString(),
      subjectCid: cid.toString(),
      value: 'test-label',
      negated: 0,
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
    const dbLabels = await getLabels(uri)
    const labels = dbLabels.map((row) => row.value).sort()
    expect(labels).toEqual(
      ['another-label', 'img-label', 'other-img-label'].sort(),
    )
  })

  it('labels text & imgs in profiles', async () => {
    const profile = {
      $type: 'app.bsky.actor.profile',
      displayName: 'label_me',
      description: 'another_label',
      avatar: badBlob1,
      banner: badBlob2,
      createdAt: new Date().toISOString(),
    }
    const uri = profileUri()
    labeler.processRecord(uri, profile)
    await labeler.processAll()
    const dbLabels = await getLabels(uri)
    const labels = dbLabels.map((row) => row.value).sort()
    expect(labels).toEqual(
      ['test-label', 'another-label', 'img-label', 'other-img-label'].sort(),
    )
  })
})

const postUri = () =>
  AtUri.make('did:example:alice', 'app.bsky.feed.post', TID.nextStr())

const profileUri = () =>
  AtUri.make('did:example:alice', 'app.bsky.actor.profile', TID.nextStr())

class TestLabeler extends Labeler {
  hiveApiKey: string
  keywords: Record<string, string>

  constructor(opts: {
    db: Database
    blobstore: BlobStore
    labelerDid: string
    keywords: Record<string, string>
  }) {
    const { db, blobstore, labelerDid, keywords } = opts
    super({ db, blobstore, labelerDid })
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
