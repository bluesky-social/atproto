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
import { ImageFlagger } from './abyss'
import { HiveLabeler, ImgLabeler } from './hive'
import { KeywordLabeler, TextLabeler } from './keyword'
import { ids } from '../lexicon/lexicons'
import { Abyss } from './abyss'
import { FuzzyMatcher, TextFlagger } from './fuzzy-matcher'
import {
  REASONOTHER,
  REASONVIOLATION,
} from '../lexicon/types/com/atproto/moderation/defs'

export class AutoModerator {
  public pushAgent: AtpAgent
  public imageFlagger?: ImageFlagger
  public textFlagger?: TextFlagger
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
    const { hiveApiKey, abyssEndpoint, abyssPassword } = ctx.cfg
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
    await this.pushLabels(uri, recordCid, labels)
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
    const formattedSubject =
      'did' in subject
        ? {
            $type: 'com.atproto.admin.defs#repoRef',
            did: subject.did,
          }
        : {
            $type: 'com.atproto.repo.strongRef',
            uri: subject.uri.toString(),
            cid: subject.cid.toString(),
          }

    await this.pushAgent.api.com.atproto.admin.emitModerationEvent({
      event: {
        $type: 'com.atproto.admin.defs#modEventReport',
        comment: `Automatically flagged for possible slurs: ${matches.join(
          ', ',
        )}`,
        reportType: REASONOTHER,
      },
      subject: formattedSubject,
      createdBy: this.ctx.cfg.serverDid,
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

    await this.pushAgent.api.com.atproto.admin.emitModerationEvent({
      event: {
        $type: 'com.atproto.admin.defs#modEventReport',
        comment: reportReason,
        reportType: REASONVIOLATION,
      },
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: uri.toString(),
        cid: recordCid.toString(),
      },
      createdBy: this.ctx.cfg.serverDid,
    })

    await this.pushAgent.com.atproto.admin.emitModerationEvent({
      event: {
        $type: 'com.atproto.admin.defs#modEventTakedown',
        comment: takedownReason,
      },
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: uri.toString(),
        cid: recordCid.toString(),
      },
      subjectBlobCids: takedownCids.map((c) => c.toString()),
      createdBy: this.ctx.cfg.serverDid,
    })
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
