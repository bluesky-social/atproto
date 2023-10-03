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

export const violatesThreadGate = async (
  db: DatabaseSchema,
  did: string,
  owner: string,
  root: PostRecord | null,
  gate: GateRecord | null,
) => {
  if (did === owner) return false
  if (!gate?.allow) return false

  const allowMentions = gate.allow.find(isMentionRule)
  const allowFollowing = gate.allow.find(isFollowingRule)
  const allowListUris = gate.allow?.filter(isListRule).map((item) => item.list)

  // check mentions first since it's quick and synchronous
  if (allowMentions) {
    const isMentioned = root?.facets?.some((facet) => {
      return facet.features.some((item) => isMention(item) && item.did === did)
    })
    if (isMentioned) {
      return false
    }
  }

  // check follows and list containment
  if (!allowFollowing && !allowListUris.length) {
    return true
  }
  const { ref } = db.dynamic
  const nullResult = sql<null>`${null}`
  const check = await db
    .selectFrom(valuesList([did]).as(sql`subject (did)`))
    .select([
      allowFollowing
        ? db
            .selectFrom('follow')
            .where('creator', '=', owner)
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
  }
  if (allowListUris.length && check?.isInList) {
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
