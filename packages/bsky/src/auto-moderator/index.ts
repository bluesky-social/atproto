import { AtUri } from '@atproto/syntax'
import { AtpAgent } from '@atproto/api'
import { dedupe, getFieldsFromRecord } from './util'
import { labelerLogger as log } from '../logger'
import { PrimaryDatabase } from '../db'
import { IdResolver } from '@atproto/identity'
import { BackgroundQueue } from '../background'
import { IndexerConfig } from '../indexer/config'
import { buildBasicAuth } from '../auth-verifier'
import { CID } from 'multiformats/cid'
import { HiveLabeler, ImgLabeler } from './hive'
import { KeywordLabeler, TextLabeler } from './keyword'
import { ids } from '../lexicon/lexicons'

export class AutoModerator {
  public pushAgent: AtpAgent
  public imgLabeler?: ImgLabeler
  public textLabeler?: TextLabeler

  constructor(
    public ctx: {
      db: PrimaryDatabase
      idResolver: IdResolver
      cfg: IndexerConfig
      backgroundQueue: BackgroundQueue
    },
  ) {
    const { hiveApiKey } = ctx.cfg
    this.imgLabeler = hiveApiKey ? new HiveLabeler(hiveApiKey, ctx) : undefined
    this.textLabeler = new KeywordLabeler(ctx.cfg.labelerKeywords)

    const url = new URL(ctx.cfg.moderationPushUrl)
    this.pushAgent = new AtpAgent({ service: url.origin })
    this.pushAgent.api.setHeader(
      'authorization',
      buildBasicAuth(url.username, url.password),
    )
  }

  processRecord(uri: AtUri, cid: CID, obj: unknown) {
    this.ctx.backgroundQueue.add(async () => {
      const { text, imgs } = getFieldsFromRecord(obj, uri)
      await this.labelRecord(uri, cid, text, imgs).catch((err) => {
        log.error(
          { err, uri: uri.toString(), record: obj },
          'failed to label record',
        )
      })
    })
  }

  processHandle(_handle: string, _did: string) {
    // no-op since this functionality moved to auto-mod service
  }

  async labelRecord(uri: AtUri, recordCid: CID, text: string[], imgs: CID[]) {
    if (uri.collection !== ids.AppBskyFeedPost) {
      // @TODO label profiles
      return
    }
    const allLabels = await Promise.all([
      this.textLabeler?.labelText(text.join(' ')),
      ...imgs.map((cid) => this.imgLabeler?.labelImg(uri.host, cid)),
    ])
    const labels = dedupe(allLabels.flat())
    await this.pushLabels(uri, recordCid, labels)
  }

  async pushLabels(uri: AtUri, cid: CID, labels: string[]): Promise<void> {
    if (labels.length < 1) return

    await this.pushAgent.com.atproto.admin.emitModerationEvent({
      event: {
        $type: 'com.atproto.admin.defs#modEventLabel',
        comment: '[AutoModerator]: Applying labels',
        createLabelVals: labels,
        negateLabelVals: [],
      },
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: uri.toString(),
        cid: cid.toString(),
      },
      createdBy: this.ctx.cfg.serverDid,
    })
  }

  async processAll() {
    await this.ctx.backgroundQueue.processAll()
  }
}
