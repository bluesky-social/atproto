import { PrimaryDatabase } from '../db'
import { Labeler } from './base'
import { getFieldsFromRecord, keywordLabeling } from './util'
import { IdResolver } from '@atproto/identity'
import { BackgroundQueue } from '../background'
import { AtUri } from '@atproto/syntax'
import { IndexerConfig } from '../indexer/config'

export class KeywordLabeler extends Labeler {
  keywords: Record<string, string>

  constructor(
    protected ctx: {
      db: PrimaryDatabase
      idResolver: IdResolver
      cfg: IndexerConfig
      backgroundQueue: BackgroundQueue
    },
  ) {
    super(ctx)
    this.keywords = ctx.cfg.labelerKeywords
  }

  async labelRecord(_uri: AtUri, obj: unknown): Promise<string[]> {
    // skip image resolution
    const { text } = getFieldsFromRecord(obj)
    const txtLabels = await this.labelText(text.join(' '))
    return txtLabels
  }

  async labelText(text: string): Promise<string[]> {
    return keywordLabeling(this.keywords, text)
  }

  async labelImg(): Promise<string[]> {
    return []
  }
}
