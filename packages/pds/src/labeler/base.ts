import stream from 'stream'
import PQueue from 'p-queue'
import Database from '../db'
import { BlobStore, cidForRecord } from '@atproto/repo'
import { dedupe, getFieldsFromRecord } from './util'

export abstract class Labeler {
  public processingQueue: PQueue | null // null during teardown
  constructor(public db: Database, public blobstore: BlobStore) {
    this.processingQueue = new PQueue()
  }

  processRecord(uri: string, obj: unknown) {
    this.processingQueue?.add(() => this.createAndStoreLabels(uri, obj))
  }

  async createAndStoreLabels(uri: string, obj: unknown): Promise<void> {
    const labels = await this.labelRecord(obj)
    if (labels.length < 1) return
    const cid = await cidForRecord(obj)
    const rows = labels.map((value) => ({
      sourceDid: 'did:example:blah',
      subjectUri: uri,
      subjectCid: cid.toString(),
      value,
      negated: 0 as const,
      createdAt: new Date().toISOString(),
    }))

    await this.db.db.insertInto('label').values(rows).execute()
  }

  async labelRecord(obj: unknown): Promise<string[]> {
    const { text, imgs } = getFieldsFromRecord(obj)
    const txtLabels = await this.labelText(text.join(' '))
    const imgLabels = await Promise.all(
      imgs.map(async (cid) => {
        const stream = await this.blobstore.getStream(cid)
        return this.labelImg(stream)
      }),
    )
    return dedupe([...txtLabels, ...imgLabels.flat()])
  }

  abstract labelText(text: string): Promise<string[]>
  abstract labelImg(img: stream.Readable): Promise<string[]>

  async processAll() {
    await this.processingQueue?.onIdle()
  }

  async destroy() {
    const pQueue = this.processingQueue
    this.processingQueue = null
    pQueue?.pause()
    pQueue?.clear()
    await pQueue?.onIdle()
  }
}
