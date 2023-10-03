import { AppBskyEmbedRecord, AppBskyEmbedRecordWithMedia } from '../client'
import { ModerationDecision, ModerationUI } from './types'

export function takeHighestPriorityDecision(
  ...decisions: (ModerationDecision | undefined)[]
): ModerationDecision {
  // remove undefined decisions
  const filtered = decisions.filter((d) => !!d) as ModerationDecision[]
  if (filtered.length === 0) {
    return ModerationDecision.noop()
  }

  // sort by highest priority
  filtered.sort((a, b) => {
    if (a.cause && b.cause) {
      return a.cause.priority - b.cause.priority
    }
    if (a.cause) {
      return -1
    }
    if (b.cause) {
      return 1
    }
    return 0
  })

  // use the top priority
  return filtered[0]
}

export function downgradeDecision(
  decision: ModerationDecision,
  to: 'blur' | 'alert' | 'noop',
) {
  decision.filter = false
  decision.noOverride = false
  if (to === 'noop') {
    decision.blur = false
    decision.blurMedia = false
    decision.alert = false
    delete decision.cause
  } else if (to === 'alert') {
    decision.blur = false
    decision.blurMedia = false
    decision.alert = true
  }
}

export function isModerationDecisionNoop(
  decision: ModerationDecision | undefined,
  { ignoreFilter }: { ignoreFilter: boolean } = { ignoreFilter: false },
): boolean {
  if (!decision) {
    return true
  }
  if (decision.alert) {
    return false
  }
  if (decision.blur) {
    return false
  }
  if (decision.filter && !ignoreFilter) {
    return false
  }
  return true
}

export function isQuotedPost(embed: unknown): embed is AppBskyEmbedRecord.View {
  return Boolean(embed && AppBskyEmbedRecord.isView(embed))
}

export function isQuotedPostWithMedia(
  embed: unknown,
): embed is AppBskyEmbedRecordWithMedia.View {
  return Boolean(embed && AppBskyEmbedRecordWithMedia.isView(embed))
}

export function toModerationUI(decision: ModerationDecision): ModerationUI {
  return {
    cause: decision.cause,
    filter: decision.filter,
    blur: decision.blur,
    alert: decision.alert,
    noOverride: decision.noOverride,
  }
}
