import { sql } from 'kysely'
import Database from '../../db'
import { Consumer } from '../types'
import { AddUpvote, sceneVotesOnPostTableUpdates } from '../messages'

export default class extends Consumer<AddUpvote> {
  async dispatch(ctx: { db: Database; message: AddUpvote }) {
    const { db, message } = ctx
    const userScenes = await db.getScenesForUser(message.user)
    if (userScenes.length < 1) return
    const updated = await db.db
      .updateTable('scene_votes_on_post')
      .set({ count: sql`count + 1` })
      .where('subject', '=', message.subject)
      .where('did', 'in', userScenes)
      .returningAll()
      .execute()
    const updatedIds = updated.map((row) => row.did)
    const toInsert = userScenes.filter((scene) => updatedIds.indexOf(scene) < 0)
    if (toInsert.length > 0) {
      await db.db
        .insertInto('scene_votes_on_post')
        .values(
          toInsert.map((scene) => ({
            did: scene,
            subject: message.subject,
            count: 1,
            postedTrending: 0 as const,
          })),
        )
        .execute()
    }

    return [sceneVotesOnPostTableUpdates(userScenes, message.subject)]
  }
}
