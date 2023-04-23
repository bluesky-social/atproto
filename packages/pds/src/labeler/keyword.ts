import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { Labeler } from './base'
import { keywordLabeling } from './util'
import { BackgroundQueue } from '../event-stream/background-queue'

export class KeywordLabeler extends Labeler {
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

  async labelImg(): Promise<string[]> {
    return []
  }
}
