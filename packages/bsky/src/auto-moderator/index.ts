import { AtUri } from '@atproto/syntax'
import { AtpAgent } from '@atproto/api'
import { dedupe, getFieldsFromRecord } from './util'
import { labelerLogger as log } from '../logger'
import { PrimaryDatabase } from '../db'
import { IdResolver } from '@atproto/identity'
import { BackgroundQueue } from '../background'
import { IndexerConfig } from '../indexer/config'
import { buildBasicAuth } from '../auth'
import { CID } from 'multiformats/cid'
import { LabelService } from '../services/label'
import { ModerationService } from '../services/moderation'
import { ImageTakedowner } from './image-takedowner'
import { HiveLabeler } from './hive'
import { KeywordLabeler } from './keyword'
import { ids } from '../lexicon/lexicons'
import { ImageUriBuilder } from '../image/uri'
import { ImageInvalidator } from '../image/invalidator'

export class AutoModerator {
  public pushAgent?: AtpAgent

  public imgTakedowner: ImageTakedowner
  public hive?: HiveLabeler
  public keyword?: KeywordLabeler

  services: {
    label: LabelService
    moderation: ModerationService
  }

  constructor(
    protected ctx: {
      db: PrimaryDatabase
      idResolver: IdResolver
      cfg: IndexerConfig
      backgroundQueue: BackgroundQueue
      imgUriBuilder: ImageUriBuilder
      imgInvalidator: ImageInvalidator
    },
  ) {
    this.services = {
      label: new LabelService(ctx.db, null),
      moderation: new ModerationService(
        ctx.db,
        ctx.imgUriBuilder,
        ctx.imgInvalidator,
      ),
    }
    this.hive = ctx.cfg.hiveApiKey
      ? new HiveLabeler(ctx.cfg.hiveApiKey, ctx)
      : undefined
    this.keyword = new KeywordLabeler(ctx.cfg.labelerKeywords)

    if (ctx.cfg.labelerPushUrl) {
      const url = new URL(ctx.cfg.labelerPushUrl)
      this.pushAgent = new AtpAgent({ service: url.origin })
      this.pushAgent.api.setHeader(
        'authorization',
        buildBasicAuth(url.username, url.password),
      )
    }
  }

  processRecord(uri: AtUri, cid: CID, obj: unknown) {
    this.ctx.backgroundQueue.add(async () => {
      const { text, imgs } = getFieldsFromRecord(obj)
      await Promise.all([
        this.labelRecord(uri, cid, text, imgs).catch((err) => {
          log.error(
            { err, uri: uri.toString(), record: obj },
            'failed to label record',
          )
        }),
        this.checkImgForTakedown(uri, cid, imgs).catch((err) => {
          log.error(
            { err, uri: uri.toString(), record: obj },
            'failed to check img for takedown',
          )
        }),
      ])
    })
  }

  async labelRecord(uri: AtUri, recordCid: CID, text: string[], imgs: CID[]) {
    if (uri.collection === ids.AppBskyActorProfile) {
      // @TODO label profiles
      return
    }
    const allLabels = await Promise.all([
      this.keyword?.labelText(text.join(' ')),
      ...imgs.map((cid) => this.hive?.labelImg(uri.host, cid)),
    ])
    const labels = dedupe(allLabels.flat())
    await this.storeLabels(uri, recordCid, labels)
  }

  async checkImgForTakedown(uri: AtUri, recordCid: CID, imgCids: CID[]) {
    if (imgCids.length < 0) return
    const results = await Promise.all(
      imgCids.map((cid) => this.imgTakedowner.scanImage(uri.host, cid)),
    )
    const result = results.flat()
    if (result.length === 0) return
    const action = await this.services.moderation.logAction({
      action: 'com.atproto.admin.defs#takedown',
      subject: { uri, cid: recordCid },
      subjectBlobCids: imgCids,
      reason: `automated takedown for labels: ${result.join(', ')}`,
      createdBy: this.ctx.cfg.labelerDid,
    })
    await this.services.moderation.takedownRecord({
      takedownId: action.id,
      uri: uri,
      blobCids: imgCids,
    })
  }

  async storeLabels(uri: AtUri, cid: CID, labels: string[]): Promise<void> {
    if (labels.length < 1) return
    const formatted = await this.services.label.formatAndCreate(
      this.ctx.cfg.labelerDid,
      uri.toString(),
      cid.toString(),
      { create: labels },
    )
    if (this.pushAgent) {
      const agent = this.pushAgent
      try {
        await agent.api.app.bsky.unspecced.applyLabels({ labels: formatted })
      } catch (err) {
        log.error(
          {
            err,
            uri: uri.toString(),
            labels,
            receiver: agent.service.toString(),
          },
          'failed to push labels',
        )
      }
    }
  }

  async processAll() {
    await this.ctx.backgroundQueue.processAll()
  }
}
