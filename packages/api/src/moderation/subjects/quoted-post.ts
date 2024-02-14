import { AppBskyEmbedRecord, AppBskyEmbedRecordWithMedia } from '../../client'
import { ModerationDecision } from '../decision'
import { ModerationOpts } from '../types'
import { decideAccount } from './account'

export function decideQuotedPost(
  subject: AppBskyEmbedRecord.View,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationDecision()

  if (AppBskyEmbedRecord.isViewRecord(subject.record)) {
    acc.setDid(subject.record.author.did)
    acc.setIsMe(subject.record.author.did === opts.userDid)
    if (subject.record.labels?.length) {
      for (const label of subject.record.labels) {
        acc.addLabel('content', label, opts)
      }
    }
  } else if (AppBskyEmbedRecord.isViewBlocked(subject.record)) {
    acc.setDid(subject.record.author.did)
    acc.setIsMe(subject.record.author.did === opts.userDid)
    if (subject.record.author.viewer?.blocking) {
      acc.addBlocking(subject.record.author.viewer?.blocking)
    } else if (subject.record.author.viewer?.blockedBy) {
      acc.addBlockedBy(subject.record.author.viewer?.blockedBy)
    } else {
      acc.addBlockOther(true)
    }
  }

  return acc
}

export function decideQuotedPostAccount(
  subject: AppBskyEmbedRecord.View,
  parentAuthorDid: string,
  opts: ModerationOpts,
): ModerationDecision {
  if (
    AppBskyEmbedRecord.isViewRecord(subject.record) &&
    subject.record.author.did !== parentAuthorDid
  ) {
    return decideAccount(subject.record.author, opts)
  }
  return new ModerationDecision()
}

export function decideQuotedPostWithMedia(
  subject: AppBskyEmbedRecordWithMedia.View,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationDecision()

  if (AppBskyEmbedRecord.isViewRecord(subject.record.record)) {
    acc.setDid(subject.record.record.author.did)
    acc.setIsMe(subject.record.record.author.did === opts.userDid)

    if (subject.record.record.labels?.length) {
      for (const label of subject.record.record.labels) {
        acc.addLabel('content', label, opts)
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

  return acc
}

export function decideQuotedPostWithMediaAccount(
  subject: AppBskyEmbedRecordWithMedia.View,
  parentAuthorDid: string,
  opts: ModerationOpts,
): ModerationDecision {
  if (
    AppBskyEmbedRecord.isViewRecord(subject.record.record) &&
    subject.record.record.author.did !== parentAuthorDid
  ) {
    return decideAccount(subject.record.record.author, opts)
  }
  return new ModerationDecision()
}
