import { BlobRef } from '@atproto/lexicon'
import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
import {
  Record as GateRecord,
  isFollowingRule,
  isListRule,
  isMentionRule,
} from '../lexicon/types/app/bsky/feed/threadgate'
import {
  Record as PostgateRecord,
  isDisableRule as isPostgateDisableRule,
} from '../lexicon/types/app/bsky/feed/postgate'
import { isMention } from '../lexicon/types/app/bsky/richtext/facet'

export const parseThreadGate = (
  replierDid: string,
  ownerDid: string,
  rootPost: PostRecord | null,
  gate: GateRecord | null,
): ParsedThreadGate => {
  if (replierDid === ownerDid) {
    return { canReply: true }
  }
  // if gate.allow is unset then *any* reply is allowed, if it is an empty array then *no* reply is allowed
  if (!gate || !gate.allow) {
    return { canReply: true }
  }

  const allowMentions = gate.allow.some(isMentionRule)
  const allowFollowing = gate.allow.some(isFollowingRule)
  const allowListUris = gate.allow?.filter(isListRule).map((item) => item.list)

  // check mentions first since it's quick and synchronous
  if (allowMentions) {
    const isMentioned = rootPost?.facets?.some((facet) => {
      return facet.features.some(
        (item) => isMention(item) && item.did === replierDid,
      )
    })
    if (isMentioned) {
      return { canReply: true, allowMentions, allowFollowing, allowListUris }
    }
  }
  return { allowMentions, allowFollowing, allowListUris }
}

type ParsedThreadGate = {
  canReply?: boolean
  allowMentions?: boolean
  allowFollowing?: boolean
  allowListUris?: string[]
}

export const cidFromBlobJson = (json: BlobRef) => {
  if (json instanceof BlobRef) {
    return json.ref.toString()
  }
  // @NOTE below handles the fact that parseRecordBytes() produces raw json rather than lexicon values
  if (json['$type'] === 'blob') {
    return (json['ref']?.['$link'] ?? '') as string
  }
  return (json['cid'] ?? '') as string
}

export const parsePostgate = ({
  gate,
  viewerDid,
  authorDid,
}: {
  gate: PostgateRecord | undefined
  viewerDid: string | undefined
  authorDid: string
}): ParsedPostgate => {
  if (viewerDid === authorDid) {
    return { embeddingRules: { canEmbed: true } }
  }
  // default state is unset, allow everyone
  if (!gate || !gate.embeddingRules) {
    return { embeddingRules: { canEmbed: true } }
  }

  const disabled = gate.embeddingRules.some(isPostgateDisableRule)
  if (disabled) {
    return { embeddingRules: { canEmbed: false } }
  }

  return { embeddingRules: { canEmbed: true } }
}

type ParsedPostgate = {
  embeddingRules: {
    canEmbed: boolean
  }
}
