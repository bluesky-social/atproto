import { sql } from 'kysely'
import { AtUri } from '@atproto/syntax'
import {
  Record as PostRecord,
  ReplyRef,
} from '../../lexicon/types/app/bsky/feed/post'
import {
  Record as GateRecord,
  isFollowingRule,
  isListRule,
  isMentionRule,
} from '../../lexicon/types/app/bsky/feed/threadgate'
import { isMention } from '../../lexicon/types/app/bsky/richtext/facet'
import { valuesList } from '../../db/util'
import DatabaseSchema from '../../db/database-schema'
import { ids } from '../../lexicon/lexicons'

export const invalidReplyRoot = (
  reply: ReplyRef,
  parent: {
    record: PostRecord
    invalidReplyRoot: boolean | null
  },
) => {
  const replyRoot = reply.root.uri
  const replyParent = reply.parent.uri
  // if parent is not a valid reply, transitively this is not a valid one either
  if (parent.invalidReplyRoot) {
    return true
  }
  // replying to root post: ensure the root looks correct
  if (replyParent === replyRoot) {
    return !!parent.record.reply
  }
  // replying to a reply: ensure the parent is a reply for the same root post
  return parent.record.reply?.root.uri !== replyRoot
}

type ParsedThreadGate = {
  canReply?: boolean
  allowMentions?: boolean
  allowFollowing?: boolean
  allowListUris?: string[]
}

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

  const allowMentions = !!gate.allow.find(isMentionRule)
  const allowFollowing = !!gate.allow.find(isFollowingRule)
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

export const violatesThreadGate = async (
  db: DatabaseSchema,
  replierDid: string,
  ownerDid: string,
  rootPost: PostRecord | null,
  gate: GateRecord | null,
) => {
  const {
    canReply,
    allowFollowing,
    allowListUris = [],
  } = parseThreadGate(replierDid, ownerDid, rootPost, gate)
  if (canReply) {
    return false
  }
  if (!allowFollowing && !allowListUris?.length) {
    return true
  }
  const { ref } = db.dynamic
  const nullResult = sql<null>`${null}`
  const check = await db
    .selectFrom(valuesList([replierDid]).as(sql`subject (did)`))
    .select([
      allowFollowing
        ? db
            .selectFrom('follow')
            .where('creator', '=', ownerDid)
            .whereRef('subjectDid', '=', ref('subject.did'))
            .select('creator')
            .as('isFollowed')
        : nullResult.as('isFollowed'),
      allowListUris.length
        ? db
            .selectFrom('list_item')
            .where('list_item.listUri', 'in', allowListUris)
            .whereRef('list_item.subjectDid', '=', ref('subject.did'))
            .limit(1)
            .select('listUri')
            .as('isInList')
        : nullResult.as('isInList'),
    ])
    .executeTakeFirst()

  if (allowFollowing && check?.isFollowed) {
    return false
  } else if (allowListUris.length && check?.isInList) {
    return false
  }

  return true
}

export const postToThreadgateUri = (postUri: string) => {
  const gateUri = new AtUri(postUri)
  gateUri.collection = ids.AppBskyFeedThreadgate
  return gateUri.toString()
}

export const threadgateToPostUri = (gateUri: string) => {
  const postUri = new AtUri(gateUri)
  postUri.collection = ids.AppBskyFeedPost
  return postUri.toString()
}
