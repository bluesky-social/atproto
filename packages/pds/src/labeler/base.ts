import Database from '../db'
import { BlobStore, cidForRecord } from '@atproto/repo'
import { dedupe, getFieldsFromRecord } from './util'
import { AtUri } from '@atproto/uri'
import { labelerLogger as log } from '../logger'
import { BackgroundQueue } from '../event-stream/background-queue'
import { CID } from 'multiformats/cid'

export abstract class Labeler {
  public db: Database
  public blobstore: BlobStore
  public labelerDid: string
  public backgroundQueue: BackgroundQueue
  constructor(opts: {
    db: Database
    blobstore: BlobStore
    labelerDid: string
    backgroundQueue: BackgroundQueue
  }) {
    this.db = opts.db
    this.blobstore = opts.blobstore
    this.labelerDid = opts.labelerDid
    this.backgroundQueue = opts.backgroundQueue
  }

  processRecord(uri: AtUri, obj: unknown) {
    this.backgroundQueue.add(() =>
      this.createAndStoreLabels(uri, obj).catch((err) => {
        log.error(
          { err, uri: uri.toString(), record: obj },
          'failed to label record',
        )
      }),
    )
  }

  async createAndStoreLabels(uri: AtUri, obj: unknown): Promise<void> {
    const labels = await this.labelRecord(obj)
    if (labels.length < 1) return
    const cid = await cidForRecord(obj)
    const rows = labels.map((val) => ({
      src: this.labelerDid,
      uri: uri.toString(),
      cid: cid.toString(),
      val,
      neg: 0 as const,
      cts: new Date().toISOString(),
    }))

    await this.db.db
      .insertInto('label')
      .values(rows)
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async labelRecord(obj: unknown): Promise<string[]> {
    const { text, imgs } = getFieldsFromRecord(obj)
    const txtLabels = await this.labelText(text.join(' '))
    const imgLabels = await Promise.all(
      imgs.map(async (cid) => this.labelImg(cid)),
    )
    return dedupe([...txtLabels, ...imgLabels.flat()])
  }

  abstract labelText(text: string): Promise<string[]>
  abstract labelImg(cid: CID): Promise<string[]>

  async processAll() {
    await this.backgroundQueue.processAll()
  }
}
