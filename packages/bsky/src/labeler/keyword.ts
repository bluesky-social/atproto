import Database from '../db'
import { Labeler } from './base'
import { keywordLabeling } from './util'
import { IdResolver } from '@atproto/identity'
import { ServerConfig } from '../config'
import { BackgroundQueue } from '../background'

export class KeywordLabeler extends Labeler {
  keywords: Record<string, string>

  constructor(
    protected ctx: {
      db: Database
      idResolver: IdResolver
      cfg: ServerConfig
      backgroundQueue: BackgroundQueue
    },
  ) {
    super(ctx)
    this.keywords = ctx.cfg.labelerKeywords
  }

  async labelText(text: string): Promise<string[]> {
    return keywordLabeling(this.keywords, text)
  }

  async labelImg(): Promise<string[]> {
    return []
  }
}
