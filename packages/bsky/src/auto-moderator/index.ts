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
import { TakedownFlagger } from './abyss'
import { HiveLabeler, ImgLabeler } from './hive'
import { KeywordLabeler, TextLabeler } from './keyword'
import { ids } from '../lexicon/lexicons'
import { ImageUriBuilder } from '../image/uri'
import { ImageInvalidator } from '../image/invalidator'
import { Abyss } from './abyss'

export class AutoModerator {
  public pushAgent?: AtpAgent

  public takedownFlagger: TakedownFlagger
  public imgLabeler?: ImgLabeler
  public textLabeler?: TextLabeler

  services: {
    label: (db: PrimaryDatabase) => LabelService
    moderation: (db: PrimaryDatabase) => ModerationService
  }

  constructor(
    public ctx: {
      db: PrimaryDatabase
      idResolver: IdResolver
      cfg: IndexerConfig
      backgroundQueue: BackgroundQueue
      imgUriBuilder: ImageUriBuilder
      imgInvalidator: ImageInvalidator
    },
  ) {
    this.services = {
      label: LabelService.creator(null),
      moderation: ModerationService.creator(
        ctx.imgUriBuilder,
        ctx.imgInvalidator,
      ),
    }
    this.imgLabeler = ctx.cfg.hiveApiKey
      ? new HiveLabeler(ctx.cfg.hiveApiKey, ctx)
      : undefined
    this.textLabeler = new KeywordLabeler(ctx.cfg.labelerKeywords)
    this.takedownFlagger = new Abyss(
      ctx.cfg.abyssEndpoint,
      ctx.cfg.abyssPassword,
      ctx,
    )

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
      this.textLabeler?.labelText(text.join(' ')),
      ...imgs.map((cid) => this.imgLabeler?.labelImg(uri.host, cid)),
    ])
    const labels = dedupe(allLabels.flat())
    await this.storeLabels(uri, recordCid, labels)
  }

  async checkImgForTakedown(uri: AtUri, recordCid: CID, imgCids: CID[]) {
    if (imgCids.length < 0) return
    const results = await Promise.all(
      imgCids.map((cid) => this.takedownFlagger.scanImage(uri.host, cid)),
    )
    const takedownCids: CID[] = []
    for (let i = 0; i < results.length; i++) {
      if (results[i].length > 0) {
        takedownCids.push(imgCids[i])
      }
    }
    if (takedownCids.length === 0) return
    await this.ctx.db.transaction(async (dbTxn) => {
      const modSrvc = this.services.moderation(dbTxn)
      const action = await modSrvc.logAction({
        action: 'com.atproto.admin.defs#takedown',
        subject: { uri, cid: recordCid },
        subjectBlobCids: takedownCids,
        reason: `automated takedown for labels: ${results.flat().join(', ')}`,
        createdBy: this.ctx.cfg.labelerDid,
      })
      await modSrvc.takedownRecord({
        takedownId: action.id,
        uri: uri,
        blobCids: takedownCids,
      })
    })
  }

  async storeLabels(uri: AtUri, cid: CID, labels: string[]): Promise<void> {
    if (labels.length < 1) return
    const labelSrvc = this.services.label(this.ctx.db)
    const formatted = await labelSrvc.formatAndCreate(
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
