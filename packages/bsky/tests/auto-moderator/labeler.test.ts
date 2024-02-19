import { TestNetwork, usersSeed } from '@atproto/dev-env'
import { AtUri, BlobRef } from '@atproto/api'
import { Readable } from 'stream'
import { AutoModerator } from '../../src/auto-moderator'
import IndexerContext from '../../src/indexer/context'
import { cidForRecord } from '@atproto/repo'
import { TID } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { ImgLabeler } from '../../src/auto-moderator/hive'
import { TestOzone } from '@atproto/dev-env/src/ozone'

// outside of test suite so that TestLabeler can access them
let badCid1: CID | undefined = undefined
let badCid2: CID | undefined = undefined

describe('labeler', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let autoMod: AutoModerator
  let ctx: IndexerContext
  let badBlob1: BlobRef
  let badBlob2: BlobRef
  let goodBlob: BlobRef
  let alice: string
  const postUri = () => AtUri.make(alice, 'app.bsky.feed.post', TID.nextStr())

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_labeler',
    })
    ozone = network.ozone
    ctx = network.bsky.indexer.ctx
    const pdsCtx = network.pds.ctx
    autoMod = ctx.autoMod
    autoMod.imgLabeler = new TestImgLabeler()
    const sc = network.getSeedClient()
    await usersSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    const storeBlob = (bytes: Uint8Array) => {
      return pdsCtx.actorStore.transact(alice, async (store) => {
        const blobRef = await store.repo.blob.addUntetheredBlob(
          'image/jpeg',
          Readable.from([bytes], { objectMode: false }),
        )
        const preparedBlobRef = {
          cid: blobRef.ref,
          mimeType: 'image/jpeg',
          constraints: {},
        }
        await store.repo.blob.verifyBlobAndMakePermanent(preparedBlobRef)
        await store.repo.blob.associateBlob(preparedBlobRef, postUri())
        return blobRef
      })
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

  const getLabels = async (subject: string) => {
    return ozone.ctx.db.db
      .selectFrom('label')
      .selectAll()
      .where('uri', '=', subject)
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
    autoMod.processRecord(uri, cid, post)
    await network.processAll()
    const labels = await getLabels(uri.toString())
    expect(labels.length).toBe(1)
    expect(labels[0]).toMatchObject({
      src: ozone.ctx.cfg.service.did,
      uri: uri.toString(),
      cid: cid.toString(),
      val: 'test-label',
      neg: false,
    })

    // Verify that along with applying the labels, we are also leaving trace of the label as moderation event
    // Temporarily assign an instance of moderation service to the autoMod so that we can validate label event
    const modSrvc = ozone.ctx.modService(ozone.ctx.db)
    const { events } = await modSrvc.getEvents({
      includeAllUserRecords: false,
      subject: uri.toString(),
      limit: 10,
      types: [],
      addedLabels: [],
      removedLabels: [],
      addedTags: [],
      removedTags: [],
    })
    expect(events.length).toBe(1)
    expect(events[0]).toMatchObject({
      action: 'com.atproto.admin.defs#modEventLabel',
      subjectUri: uri.toString(),
      createLabelVals: 'test-label',
      negateLabelVals: null,
      comment: `[AutoModerator]: Applying labels`,
      createdBy: network.bsky.indexer.ctx.cfg.serverDid,
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
    const cid = await cidForRecord(post)
    autoMod.processRecord(uri, cid, post)
    await autoMod.processAll()
    const dbLabels = await getLabels(uri.toString())
    const labels = dbLabels.map((row) => row.val).sort()
    expect(labels).toEqual(
      ['test-label', 'test-label-2', 'img-label', 'other-img-label'].sort(),
    )
  })
})

class TestImgLabeler implements ImgLabeler {
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
