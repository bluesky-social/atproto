import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { Labeler } from './base'
import { keywordLabeling } from './util'

export class KeywordLabeler extends Labeler {
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

  async labelImg(): Promise<string[]> {
    return []
  }
}
