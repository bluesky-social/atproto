import { Selectable, sql } from 'kysely'
import { AtUri } from '@atproto/syntax'
import {
  Record as PostRecord,
  ReplyRef,
  isFollowingInteraction,
  isListInteraction,
  isMentionInteraction,
} from '../../lexicon/types/app/bsky/feed/post'
import { isMention } from '../../lexicon/types/app/bsky/richtext/facet'
import { valuesList } from '../../db/util'
import DatabaseSchema, { DatabaseSchemaType } from '../../db/database-schema'

type Post = Selectable<DatabaseSchemaType['post']>

export const checkInvalidReply = (reply: ReplyRef, parent: Post) => {
  const replyRoot = reply.root.uri
  const replyParent = reply.parent.uri
  // if parent is not a valid reply, transitively this is not a valid one either
  if (parent.isInvalidReply) {
    return true
  }
  // replying to root post: ensure the root looks correct
  if (replyParent === replyRoot) {
    return parent.replyParent !== null || parent.replyRoot !== null
  }
  // replying to a reply: ensure the parent is a reply for the same root post
  return parent.replyRoot !== replyRoot
}

export const checkInvalidInteractions = async (
  db: DatabaseSchema,
  did: string,
  rootUri: AtUri,
  root: PostRecord,
) => {
  if (!root.interactions) return false

  const allowMentions = root.interactions.find(isMentionInteraction)
  const allowFollowing = root.interactions.find(isFollowingInteraction)
  const allowListUris = root.interactions
    .filter(isListInteraction)
    .map((item) => item.list.uri)

  // check mentions first since it's quick and synchronous
  if (allowMentions) {
    const isMentioned = root.facets?.some(
      (item) => isMention(item) && item.did === did,
    )
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
            .where('creator', '=', rootUri.hostname)
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
