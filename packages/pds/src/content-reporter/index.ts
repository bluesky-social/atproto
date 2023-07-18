import { AtUri } from '@atproto/uri'
import { RepoRecord } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'
import { UnacceptableWordValidator } from './validator'
import { REASONOTHER } from '../lexicon/types/com/atproto/moderation/defs'
import { isRecord as isList } from '../lexicon/types/app/bsky/graph/list'
import { isRecord as isProfile } from '../lexicon/types/app/bsky/actor/profile'
import { isRecord as isFeedGenerator } from '../lexicon/types/app/bsky/feed/generator'
import { BackgroundQueue } from '../event-stream/background-queue'
import { ModerationService } from '../services/moderation'

export class ContentReporter {
  backgroundQueue: BackgroundQueue
  moderationService: ModerationService
  reporterDid: string
  validator: UnacceptableWordValidator

  constructor(opts: {
    backgroundQueue: BackgroundQueue
    moderationService: ModerationService
    reporterDid: string
    unacceptableB64: string
    falsePositivesB64?: string
  }) {
    this.backgroundQueue = opts.backgroundQueue
    this.moderationService = opts.moderationService
    this.reporterDid = opts.reporterDid
    this.validator = new UnacceptableWordValidator(
      decode(opts.unacceptableB64),
      opts.falsePositivesB64 ? decode(opts.falsePositivesB64) : undefined,
    )
  }

  checkHandle(opts: { handle: string; did: string }) {
    const { handle, did } = opts
    return this.checkContent({
      content: handle,
      subject: { did },
    })
  }

  checkRecord(opts: { record: RepoRecord; uri: AtUri; cid: CID }) {
    const { record, uri, cid } = opts
    let content = ''
    if (isProfile(record)) {
      content += ' ' + record.displayName
    } else if (isList(record)) {
      content += ' ' + record.name
    } else if (isFeedGenerator(record)) {
      content += ' ' + uri.rkey
      content += ' ' + record.displayName
    }

    return this.checkContent({
      content,
      subject: { uri, cid },
    })
  }

  checkContent(opts: {
    content: string
    subject: { did: string } | { uri: AtUri; cid?: CID }
  }) {
    const { content, subject } = opts
    const possibleSlurs = this.validator.getMatches(content)
    if (possibleSlurs.length < 1) {
      return
    }
    this.backgroundQueue.add(async () => {
      await this.moderationService.report({
        reasonType: REASONOTHER,
        reason: `Automatically flagged for possible slurs: ${possibleSlurs.join(
          ', ',
        )}`,
        subject,
        reportedBy: this.reporterDid,
      })
    })
  }
}

export const decode = (encoded: string): string[] => {
  return ui8.toString(ui8.fromString(encoded, 'base64'), 'utf8').split(',')
}

export const encode = (words: string[]): string => {
  return ui8.toString(ui8.fromString(words.join(','), 'utf8'), 'base64')
}
