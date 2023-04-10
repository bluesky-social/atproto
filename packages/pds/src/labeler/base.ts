import stream from 'stream'
import Database from '../db'
import { BlobStore } from '@atproto/repo'
import { dedupe, getFieldsFromRecord, getRecordFromDb } from './util'

export interface Labeler {
  labelRecord(uri: string): Promise<string[]>
  labelText(text: string): Promise<string[]>
  labelImg(img: stream.Readable): Promise<string[]>
}

export abstract class BaseLabeler implements Labeler {
  constructor(public db: Database, public blobstore: BlobStore) {}
  async labelRecord(uri: string): Promise<string[]> {
    // only label posts & profile
    if (
      !uri.includes('app.bsky.feed.post') &&
      !uri.includes('app.bsky.actor.profile')
    ) {
      return []
    }

    const record = await getRecordFromDb(this.db, uri)
    if (!record) return []

    const { text, imgs } = getFieldsFromRecord(record)
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
}
