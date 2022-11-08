import { RecordCreateOp } from '@atproto/repo'
import Database from '../db'
import { APP_BSKY_GRAPH, APP_BSKY_SYSTEM } from '../lexicon'
import * as schemas from '../lexicon/schemas'

export const process = async (
  db: Database,
  did: string,
  write: RecordCreateOp,
) => {
  // only process likes for now
  const record = write.value
  if (write.collection !== schemas.ids.AppBskyFeedLike) return
  if (!db.records.like.matchesSchema(!record)) return

  const scenes = await db.db
    .selectFrom('did_handle')
    .where('did_handle.actorType', '=', APP_BSKY_SYSTEM.ActorScene)
    .innerJoin('assertion', 'assertion.creator', 'did_handle.did')
    .where('assertion.confirmUri', 'is not', null)
    .where('assertion.subjectDid', '=', did)
    .innerJoin(
      'scene_likes_on_post',
      'scene_likes_on_post.did',
      'did_handle.did',
    )
    .where('scene_likes_on_post.subject', '=', record.subjectUri)
    .innerJoin('scene_member_count', 'scene_member_count.did', 'did_handle.did')
    .select([
      'did_handle.did as did',
      'did_handle.handle as handle',
      'scene_likes_on_post.count as likeCount',
      'scene_member_count.count as memberCount',
    ])
    .execute()

  // scenes.map((scene) => db.db.selectFrom('did_'))

  //   .where('assert.assertion', '=', APP_BSKY_GRAPH.AssertMember)
  //   .whereRef('confirm.assertionCid', '=', 'assert.cid')
  //   .where('assert.subjectDid', '=', did)
  //   .select([
  //     'did_handle.handle as handle',
  //     'did_handle.did as did',
  //     'scene.owner as owner',
  //   ])
  //   .execute()
  // scenes.map((scene) => db.db.selectFrom)
  // .
  // const did = writes[0].bb
  // if (write.collection === schemas.ids.AppBskyFeedLike) {
  // }
}
