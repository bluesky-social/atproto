import * as util from 'node:util'
import { UriString } from '@atproto/lex'
import { BlobRef } from '@atproto/lex-data'
import { AtUriString, DidString } from '@atproto/syntax'
import {
  GateRecord,
  PostRecord,
  PostgateRecord,
  isFollowerRule,
  isFollowingRule,
  isListRule,
  isMentionFacet,
  isMentionRule,
  isPostgateDisableRule,
} from './types.js'

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
  const allowFollower = gate.allow.some(isFollowerRule)
  const allowFollowing = gate.allow.some(isFollowingRule)
  const allowListUris = gate.allow
    .map((item) => (isListRule(item) ? item.list : undefined))
    .filter((v) => v != null)

  // check mentions first since it's quick and synchronous
  if (allowMentions) {
    const isMentioned = rootPost?.facets?.some((facet) => {
      return facet.features.some(
        (item) => isMentionFacet(item) && item.did === replierDid,
      )
    })
    if (isMentioned) {
      return {
        canReply: true,
        allowMentions,
        allowFollower,
        allowFollowing,
        allowListUris,
      }
    }
  }
  return { allowMentions, allowFollower, allowFollowing, allowListUris }
}

type ParsedThreadGate = {
  canReply?: boolean
  allowMentions?: boolean
  allowFollower?: boolean
  allowFollowing?: boolean
  allowListUris?: AtUriString[]
}

export const cidFromBlobJson = (json: BlobRef): string => {
  return json.ref.toString()
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

export class VideoUriBuilder {
  constructor(
    private opts: {
      playlistUrlPattern: string // e.g. https://hostname/vid/%s/%s/playlist.m3u8
      thumbnailUrlPattern: string // e.g. https://hostname/vid/%s/%s/thumbnail.jpg
    },
  ) {}
  playlist({ did, cid }: { did: DidString; cid: string }): UriString {
    return util.format(
      this.opts.playlistUrlPattern,
      encodeURIComponent(did),
      encodeURIComponent(cid),
    ) as UriString
  }
  thumbnail({ did, cid }: { did: DidString; cid: string }): UriString {
    return util.format(
      this.opts.thumbnailUrlPattern,
      encodeURIComponent(did),
      encodeURIComponent(cid),
    ) as UriString
  }
}
