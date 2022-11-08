import { RecordWriteOp } from '@atproto/repo'
import Database from '../db'
import { APP_BSKY_SYSTEM } from '../lexicon'
import * as views from '../db/views'
import * as schemas from '../lexicon/schemas'

<<<<<<< Updated upstream
=======
type MemberAddUpdate = {
  type: 'member_add'
}

class SceneProcessor {
  process()
}

>>>>>>> Stashed changes
export const process = async (
  db: Database,
  did: string,
  write: RecordWriteOp,
) => {
  // only process upvotes for now
  if (write.action !== 'create') return
  const record = write.value
  if (write.collection !== schemas.ids.AppBskyFeedVote) return
  if (!db.records.vote.matchesSchema(record)) return
  if (record.direction !== 'up') return

  const { ref } = db.db.dynamic
  const scenes = await db.db
    .selectFrom('did_handle')
    .where('did_handle.actorType', '=', APP_BSKY_SYSTEM.ActorScene)
    .innerJoin('assertion', 'assertion.creator', 'did_handle.did')
    .where('assertion.confirmUri', 'is not', null)
    .where('assertion.subjectDid', '=', did)
    .select([
      'did_handle.did as did',
      'did_handle.handle as handle',
      views.upvoteCountFromScene(db, ref('did_handle.did')).as('likeCount'),
      views.sceneMemberCount(db, ref('did_handle.did')).as('memberCount'),
    ])
    .execute()
}
