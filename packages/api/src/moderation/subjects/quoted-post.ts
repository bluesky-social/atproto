import { AppBskyEmbedRecord, AppBskyEmbedRecordWithMedia } from '../../client'
import { ModerationCauseAccumulator } from '../accumulator'
import { ModerationOpts, ModerationDecision } from '../types'
import { decideAccount } from './account'

export function decideQuotedPost(
  subject: AppBskyEmbedRecord.View,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationCauseAccumulator()

  if (AppBskyEmbedRecord.isViewRecord(subject.record)) {
    acc.setDid(subject.record.author.did)

    if (subject.record.labels?.length) {
      for (const label of subject.record.labels) {
        acc.addLabel(label, opts)
      }
    }
  } else if (AppBskyEmbedRecord.isViewBlocked(subject.record)) {
    acc.setDid(subject.record.author.did)
    if (subject.record.author.viewer?.blocking) {
      acc.addBlocking(subject.record.author.viewer?.blocking)
    } else if (subject.record.author.viewer?.blockedBy) {
      acc.addBlockedBy(subject.record.author.viewer?.blockedBy)
    } else {
      acc.addBlockOther(true)
    }
  }

  return acc.finalizeDecision(opts)
}

export function decideQuotedPostAccount(
  subject: AppBskyEmbedRecord.View,
  opts: ModerationOpts,
): ModerationDecision {
  if (AppBskyEmbedRecord.isViewRecord(subject.record)) {
    return decideAccount(subject.record.author, opts)
  }
  return ModerationDecision.noop()
}

export function decideQuotedPostWithMedia(
  subject: AppBskyEmbedRecordWithMedia.View,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationCauseAccumulator()

  if (AppBskyEmbedRecord.isViewRecord(subject.record.record)) {
    acc.setDid(subject.record.record.author.did)

    if (subject.record.record.labels?.length) {
      for (const label of subject.record.record.labels) {
        acc.addLabel(label, opts)
      }
    }
  } else if (AppBskyEmbedRecord.isViewBlocked(subject.record.record)) {
    acc.setDid(subject.record.record.author.did)
    if (subject.record.record.author.viewer?.blocking) {
      acc.addBlocking(subject.record.record.author.viewer?.blocking)
    } else if (subject.record.record.author.viewer?.blockedBy) {
      acc.addBlockedBy(subject.record.record.author.viewer?.blockedBy)
    } else {
      acc.addBlockOther(true)
    }
  }

  return acc.finalizeDecision(opts)
}

export function decideQuotedPostWithMediaAccount(
  subject: AppBskyEmbedRecordWithMedia.View,
  opts: ModerationOpts,
): ModerationDecision {
  if (AppBskyEmbedRecord.isViewRecord(subject.record.record)) {
    return decideAccount(subject.record.record.author, opts)
  }
  return ModerationDecision.noop()
}
