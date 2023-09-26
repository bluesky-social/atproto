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
import { ImageFlagger } from './abyss'
import { HiveLabeler, ImgLabeler } from './hive'
import { KeywordLabeler, TextLabeler } from './keyword'
import { ids } from '../lexicon/lexicons'
import { ImageUriBuilder } from '../image/uri'
import { ImageInvalidator } from '../image/invalidator'
import { Abyss } from './abyss'
import { FuzzyMatcher, TextFlagger } from './fuzzy-matcher'
import {
  REASONOTHER,
  REASONVIOLATION,
} from '../lexicon/types/com/atproto/moderation/defs'

export class AutoModerator {
  public pushAgent?: AtpAgent
  public imageFlagger?: ImageFlagger
  public textFlagger?: TextFlagger
  public imgLabeler?: ImgLabeler
  public textLabeler?: TextLabeler

  services: {
    label: (db: PrimaryDatabase) => LabelService
    moderation?: (db: PrimaryDatabase) => ModerationService
  }

  constructor(
    public ctx: {
      db: PrimaryDatabase
      idResolver: IdResolver
      cfg: IndexerConfig
      backgroundQueue: BackgroundQueue
      imgUriBuilder?: ImageUriBuilder
      imgInvalidator?: ImageInvalidator
    },
  ) {
    const { imgUriBuilder, imgInvalidator } = ctx
    const { hiveApiKey, abyssEndpoint, abyssPassword } = ctx.cfg
    this.services = {
      label: LabelService.creator(null),
    }
    if (imgUriBuilder && imgInvalidator) {
      this.services.moderation = ModerationService.creator(
        imgUriBuilder,
        imgInvalidator,
      )
    } else {
      log.error(
        { imgUriBuilder, imgInvalidator },
        'moderation service not properly configured',
      )
    }

    this.imgLabeler = hiveApiKey ? new HiveLabeler(hiveApiKey, ctx) : undefined
    this.textLabeler = new KeywordLabeler(ctx.cfg.labelerKeywords)
    if (abyssEndpoint && abyssPassword) {
      this.imageFlagger = new Abyss(abyssEndpoint, abyssPassword, ctx)
    } else {
      log.error(
        { abyssEndpoint, abyssPassword },
        'abyss not properly configured',
      )
    }

    if (ctx.cfg.fuzzyMatchB64) {
      this.textFlagger = FuzzyMatcher.fromB64(
        ctx.cfg.fuzzyMatchB64,
        ctx.cfg.fuzzyFalsePositiveB64,
      )
    }

    if (ctx.cfg.moderationPushUrl) {
      const url = new URL(ctx.cfg.moderationPushUrl)
      this.pushAgent = new AtpAgent({ service: url.origin })
      this.pushAgent.api.setHeader(
        'authorization',
        buildBasicAuth(url.username, url.password),
      )
    }
  }

  processRecord(uri: AtUri, cid: CID, obj: unknown) {
    this.ctx.backgroundQueue.add(async () => {
      const { text, imgs } = getFieldsFromRecord(obj, uri)
      await Promise.all([
        this.labelRecord(uri, cid, text, imgs).catch((err) => {
          log.error(
            { err, uri: uri.toString(), record: obj },
            'failed to label record',
          )
        }),
        this.flagRecordText(uri, cid, text).catch((err) => {
          log.error(
            { err, uri: uri.toString(), record: obj },
            'failed to check record for text flagging',
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

  processHandle(handle: string, did: string) {
    this.ctx.backgroundQueue.add(async () => {
      await this.flagSubjectText(handle, { did }).catch((err) => {
        log.error({ err, handle, did }, 'failed to label handle')
      })
    })
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
    await this.storeLabels(uri, recordCid, labels)
  }

  async flagRecordText(uri: AtUri, cid: CID, text: string[]) {
    if (
      ![
        ids.AppBskyActorProfile,
        ids.AppBskyGraphList,
        ids.AppBskyFeedGenerator,
      ].includes(uri.collection)
    ) {
      return
    }
    return this.flagSubjectText(text.join(' '), { uri, cid })
  }

  async flagSubjectText(
    text: string,
    subject: { did: string } | { uri: AtUri; cid: CID },
  ) {
    if (!this.textFlagger) return
    const matches = this.textFlagger.getMatches(text)
    if (matches.length < 1) return
    if (!this.services.moderation) {
      log.error(
        { subject, text, matches },
        'no moderation service setup to flag record text',
      )
      return
    }
    await this.services.moderation(this.ctx.db).report({
      reasonType: REASONOTHER,
      reason: `Automatically flagged for possible slurs: ${matches.join(', ')}`,
      subject,
      reportedBy: this.ctx.cfg.labelerDid,
    })
  }

  async checkImgForTakedown(uri: AtUri, recordCid: CID, imgCids: CID[]) {
    if (imgCids.length < 0) return
    const results = await Promise.all(
      imgCids.map((cid) => this.imageFlagger?.scanImage(uri.host, cid, uri)),
    )
    const takedownCids: CID[] = []
    for (let i = 0; i < results.length; i++) {
      if (results.at(i)?.length) {
        takedownCids.push(imgCids[i])
      }
    }
    if (takedownCids.length === 0) return
    try {
      await this.persistTakedown(
        uri,
        recordCid,
        takedownCids,
        dedupe(results.flat()),
      )
    } catch (err) {
      log.error(
        {
          err,
          uri: uri.toString(),
          imgCids: imgCids.map((c) => c.toString()),
          results,
        },
        'failed to persist takedown',
      )
    }
  }

  async persistTakedown(
    uri: AtUri,
    recordCid: CID,
    takedownCids: CID[],
    labels: string[],
  ) {
    const reportReason = `automated takedown (${labels.join(
      ', ',
    )}). account needs review and possibly additional action`
    const takedownReason = `automated takedown for labels: ${labels.join(', ')}`
    log.warn(
      {
        uri: uri.toString(),
        blobCids: takedownCids,
        labels,
      },
      'hard takedown of record (and blobs) based on auto-matching',
    )

    if (this.services.moderation) {
      await this.ctx.db.transaction(async (dbTxn) => {
        // directly/locally create report, even if we use pushAgent for the takedown. don't have acctual account credentials for pushAgent, only admin auth
        if (!this.services.moderation) {
          // checked above, outside the transaction
          return
        }
        const modSrvc = this.services.moderation(dbTxn)
        await modSrvc.report({
          reportedBy: this.ctx.cfg.labelerDid,
          reasonType: REASONVIOLATION,
          subject: {
            uri: uri,
            cid: recordCid,
          },
          reason: reportReason,
        })
      })
    }

    if (this.pushAgent) {
      await this.pushAgent.com.atproto.admin.takeModerationAction({
        action: 'com.atproto.admin.defs#takedown',
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: uri.toString(),
          cid: recordCid.toString(),
        },
        subjectBlobCids: takedownCids.map((c) => c.toString()),
        reason: takedownReason,
        createdBy: this.ctx.cfg.labelerDid,
      })
    } else {
      await this.ctx.db.transaction(async (dbTxn) => {
        if (!this.services.moderation) {
          throw new Error('no mod push agent or uri invalidator setup')
        }
        const modSrvc = this.services.moderation(dbTxn)
        const action = await modSrvc.logAction({
          action: 'com.atproto.admin.defs#takedown',
          subject: { uri, cid: recordCid },
          subjectBlobCids: takedownCids,
          reason: takedownReason,
          createdBy: this.ctx.cfg.labelerDid,
        })
        await modSrvc.takedownRecord({
          takedownId: action.id,
          uri: uri,
          blobCids: takedownCids,
        })
      })
    }
  }

  async storeLabels(uri: AtUri, cid: CID, labels: string[]): Promise<void> {
    if (labels.length < 1) return
    const labelSrvc = this.services.label(this.ctx.db)
    await labelSrvc.formatAndCreate(
      this.ctx.cfg.labelerDid,
      uri.toString(),
      cid.toString(),
      { create: labels },
    )
  }

  async processAll() {
    await this.ctx.backgroundQueue.processAll()
  }
}
