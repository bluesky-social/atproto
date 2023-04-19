import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { Labeler } from './base'
import { keywordLabeling } from './util'
import AppContext from '../context'

export class KeywordLabeler extends Labeler {
  keywords: Record<string, string>

  constructor(
    protected ctx: AppContext,
    opts: {
      keywords: Record<string, string>
    },
  ) {
    super(ctx)
    this.keywords = opts.keywords
  }

  async labelText(text: string): Promise<string[]> {
    return keywordLabeling(this.keywords, text)
  }

  async labelImg(): Promise<string[]> {
    return []
  }
}
