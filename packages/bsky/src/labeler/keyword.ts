import Database from '../db'
import { Labeler } from './base'
import { keywordLabeling } from './util'
import { DidResolver } from '@atproto/did-resolver'
import { ServerConfig } from '../config'

export class KeywordLabeler extends Labeler {
  keywords: Record<string, string>

  constructor(
    protected ctx: {
      db: Database
      didResolver: DidResolver
      cfg: ServerConfig
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
