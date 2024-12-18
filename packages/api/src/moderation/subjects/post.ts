import { ModerationDecision } from '../decision'
import {
  AppBskyFeedPost,
  AppBskyEmbedImages,
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyEmbedExternal,
  AppBskyActorDefs,
} from '../../client'
import { ModerationSubjectPost, ModerationOpts } from '../types'
import { matchMuteWord, MuteWordMatch } from '../mutewords'
import { decideAccount } from './account'
import { decideProfile } from './profile'

export function decidePost(
  subject: ModerationSubjectPost,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationDecision()

  acc.setDid(subject.author.did)
  acc.setIsMe(subject.author.did === opts.userDid)
  if (subject.labels?.length) {
    for (const label of subject.labels) {
      acc.addLabel('content', label, opts)
    }
  }
  acc.addHidden(checkHiddenPost(subject, opts.prefs.hiddenPosts))
  if (!acc.isMe) {
    acc.addMutedWord(findFirstMuteWordMatch(subject, opts.prefs.mutedWords))
  }

  let embedAcc
  if (subject.embed) {
    if (AppBskyEmbedRecord.isViewRecord(subject.embed.record)) {
      // quote post
      embedAcc = decideQuotedPost(subject.embed.record, opts)
    } else if (
      AppBskyEmbedRecordWithMedia.isView(subject.embed) &&
      AppBskyEmbedRecord.isViewRecord(subject.embed.record.record)
    ) {
      // quoted post with media
      embedAcc = decideQuotedPost(subject.embed.record.record, opts)
    } else if (AppBskyEmbedRecord.isViewBlocked(subject.embed.record)) {
      // blocked quote post
      embedAcc = decideBlockedQuotedPost(subject.embed.record, opts)
    } else if (
      AppBskyEmbedRecordWithMedia.isView(subject.embed) &&
      AppBskyEmbedRecord.isViewBlocked(subject.embed.record.record)
    ) {
      // blocked quoted post with media
      embedAcc = decideBlockedQuotedPost(subject.embed.record.record, opts)
    }
  }

  return ModerationDecision.merge(
    acc,
    embedAcc?.downgrade(),
    decideAccount(subject.author, opts),
    decideProfile(subject.author, opts),
  )
}

function decideQuotedPost(
  subject: AppBskyEmbedRecord.ViewRecord,
  opts: ModerationOpts,
) {
  const acc = new ModerationDecision()
  acc.setDid(subject.author.did)
  acc.setIsMe(subject.author.did === opts.userDid)
  if (subject.labels?.length) {
    for (const label of subject.labels) {
      acc.addLabel('content', label, opts)
    }
  }
  return ModerationDecision.merge(
    acc,
    decideAccount(subject.author, opts),
    decideProfile(subject.author, opts),
  )
}

function decideBlockedQuotedPost(
  subject: AppBskyEmbedRecord.ViewBlocked,
  opts: ModerationOpts,
) {
  const acc = new ModerationDecision()
  acc.setDid(subject.author.did)
  acc.setIsMe(subject.author.did === opts.userDid)
  if (subject.author.viewer?.muted) {
    if (subject.author.viewer?.mutedByList) {
      acc.addMutedByList(subject.author.viewer?.mutedByList)
    } else {
      acc.addMuted(subject.author.viewer?.muted)
    }
  }
  if (subject.author.viewer?.blocking) {
    if (subject.author.viewer?.blockingByList) {
      acc.addBlockingByList(subject.author.viewer?.blockingByList)
    } else {
      acc.addBlocking(subject.author.viewer?.blocking)
    }
  }
  acc.addBlockedBy(subject.author.viewer?.blockedBy)
  return acc
}

function checkHiddenPost(
  subject: ModerationSubjectPost,
  hiddenPosts: string[] | undefined,
) {
  if (!hiddenPosts?.length) {
    return false
  }
  if (hiddenPosts.includes(subject.uri)) {
    return true
  }
  if (subject.embed) {
    if (
      AppBskyEmbedRecord.isViewRecord(subject.embed.record) &&
      hiddenPosts.includes(subject.embed.record.uri)
    ) {
      return true
    }
    if (
      AppBskyEmbedRecordWithMedia.isView(subject.embed) &&
      AppBskyEmbedRecord.isViewRecord(subject.embed.record.record) &&
      hiddenPosts.includes(subject.embed.record.record.uri)
    ) {
      return true
    }
  }
  return false
}

function findFirstMuteWordMatch(
  subject: ModerationSubjectPost,
  mutedWords: AppBskyActorDefs.MutedWord[] | undefined,
): MuteWordMatch {
  if (!mutedWords?.length) {
    return null
  }

  const postAuthor = subject.author

  if (AppBskyFeedPost.isRecord(subject.record)) {
    const match = matchMuteWord({
      mutedWords,
      text: subject.record.text,
      facets: subject.record.facets,
      outlineTags: subject.record.tags,
      languages: subject.record.langs,
      actor: postAuthor,
    })
    // post text
    if (match) {
      return match
    }

    if (
      subject.record.embed &&
      AppBskyEmbedImages.isMain(subject.record.embed)
    ) {
      // post images
      for (const image of subject.record.embed.images) {
        const match = matchMuteWord({
          mutedWords,
          text: image.alt,
          languages: subject.record.langs,
          actor: postAuthor,
        })
        if (match) {
          return match
        }
      }
    }
  }

  if (subject.embed) {
    // quote post
    if (AppBskyEmbedRecord.isViewRecord(subject.embed.record)) {
      if (AppBskyFeedPost.isRecord(subject.embed.record.value)) {
        const embeddedPost = subject.embed.record.value
        const embedAuthor = subject.embed.record.author
        const match = matchMuteWord({
          mutedWords,
          text: embeddedPost.text,
          facets: embeddedPost.facets,
          outlineTags: embeddedPost.tags,
          languages: embeddedPost.langs,
          actor: embedAuthor,
        })

        // quoted post text
        if (match) {
          return match
        }

        // quoted post's images
        if (AppBskyEmbedImages.isMain(embeddedPost.embed)) {
          for (const image of embeddedPost.embed.images) {
            const match = matchMuteWord({
              mutedWords,
              text: image.alt,
              languages: embeddedPost.langs,
              actor: embedAuthor,
            })
            if (match) {
              return match
            }
          }
        }

        // quoted post's link card
        if (AppBskyEmbedExternal.isMain(embeddedPost.embed)) {
          const { external } = embeddedPost.embed
          const match = matchMuteWord({
            mutedWords,
            text: external.title + ' ' + external.description,
            languages: [],
            actor: embedAuthor,
          })
          if (match) {
            return match
          }
        }

        if (AppBskyEmbedRecordWithMedia.isMain(embeddedPost.embed)) {
          // quoted post's link card when it did a quote + media
          if (AppBskyEmbedExternal.isMain(embeddedPost.embed.media)) {
            const { external } = embeddedPost.embed.media
            const match = matchMuteWord({
              mutedWords,
              text: external.title + ' ' + external.description,
              languages: [],
              actor: embedAuthor,
            })
            if (match) {
              return match
            }
          }

          // quoted post's images when it did a quote + media
          if (AppBskyEmbedImages.isMain(embeddedPost.embed.media)) {
            for (const image of embeddedPost.embed.media.images) {
              const match = matchMuteWord({
                mutedWords,
                text: image.alt,
                languages: AppBskyFeedPost.isRecord(embeddedPost.record)
                  ? embeddedPost.langs
                  : [],
                actor: embedAuthor,
              })
              if (match) {
                return match
              }
            }
          }
        }
      }
    }
    // link card
    else if (AppBskyEmbedExternal.isView(subject.embed)) {
      const { external } = subject.embed
      const match = matchMuteWord({
        mutedWords,
        text: external.title + ' ' + external.description,
        languages: [],
        actor: postAuthor,
      })
      if (match) {
        return match
      }
    }
    // quote post with media
    else if (
      AppBskyEmbedRecordWithMedia.isView(subject.embed) &&
      AppBskyEmbedRecord.isViewRecord(subject.embed.record.record)
    ) {
      const embedAuthor = subject.embed.record.record.author

      // quoted post text
      if (AppBskyFeedPost.isRecord(subject.embed.record.record.value)) {
        const post = subject.embed.record.record.value
        const match = matchMuteWord({
          mutedWords,
          text: post.text,
          facets: post.facets,
          outlineTags: post.tags,
          languages: post.langs,
          actor: embedAuthor,
        })
        if (match) {
          return match
        }
      }

      // quoted post images
      if (AppBskyEmbedImages.isView(subject.embed.media)) {
        for (const image of subject.embed.media.images) {
          const match = matchMuteWord({
            mutedWords,
            text: image.alt,
            languages: AppBskyFeedPost.isRecord(subject.record)
              ? subject.record.langs
              : [],
            actor: embedAuthor,
          })
          if (match) {
            return match
          }
        }
      }

      if (AppBskyEmbedExternal.isView(subject.embed.media)) {
        const { external } = subject.embed.media
        const match = matchMuteWord({
          mutedWords,
          text: external.title + ' ' + external.description,
          languages: [],
          actor: embedAuthor,
        })
        if (match) {
          return match
        }
      }
    }
  }
  return null
}
