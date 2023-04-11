import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { Labeler } from './base'
import { keywordLabeling } from './util'

export class KeywordLabeler extends Labeler {
  keywords: Record<string, string>

  constructor(opts: {
    db: Database
    blobstore: BlobStore
    keywords: Record<string, string>
  }) {
    super(opts.db, opts.blobstore)
    this.keywords = opts.keywords
  }

  async labelText(text: string): Promise<string[]> {
    return keywordLabeling(this.keywords, text)
  }

  async labelImg(): Promise<string[]> {
    return []
  }
}
