import { RecordWriteOp } from '@atproto/repo'
import Database from '../db'
import { APP_BSKY_GRAPH, APP_BSKY_SYSTEM } from '../lexicon'
import * as schemas from '../lexicon/schemas'
import {
  AddMember,
  AddUpvote,
  Message,
  RemoveMember,
  RemoveUpvote,
} from './messages'
import { sql } from 'kysely'
import { dbLogger as log } from '../logger'

class SceneProcessor {
  constructor(private db: Database) {}

  async send(message: Message): Promise<void> {
    const res = await this.db.db
      .insertInto('scene_message_queue')
      .values({
        message: JSON.stringify(message),
        read: 0,
        createdAt: new Date().toISOString(0),
      })
      .returning('id')
      .executeTakeFirst()
    if (!res) {
      throw new Error(`Failed to send message: :${message}`)
    }
    this.process(res.id)
  }

  async catchup(): Promise<void> {
    const res = await this.db.db
      .selectFrom('scene_message_queue')
      .where('read', '=', 0)
      .selectAll()
      .execute()
    await Promise.all(res.map((row) => this.process(row.id)))
  }

  async process(id: number): Promise<void> {
    await this.db.transaction(async (dbTxn) => {
      const res = await dbTxn.db
        .selectFrom('scene_message_queue')
        .where('id', '=', id)
        .forUpdate()
        .selectAll()
        .executeTakeFirst()

      if (!res) {
        log.error({ id }, 'message does not exist')
        return
      } else if (res.read === 1) return

      const message: Message = JSON.parse(res.message)
      if (message.type === 'add_member') {
        await this.handleAddMember(dbTxn, message)
      } else if (message.type === 'remove_member') {
        await this.handleRemoveMember(dbTxn, message)
      }

      await dbTxn.db
        .updateTable('scene_message_queue')
        .set({ read: 1 })
        .where('id', '=', id)
        .execute()
    })
  }

  async handleAddMember(db: Database, message: AddMember): Promise<void> {
    db.assertTransaction()
    const res = await db.db
      .updateTable('scene_member_count')
      .set({ count: sql`count + 1` })
      .where('did', '=', message.scene)
      .returning(['did', 'count'])
      .execute()
    if (res.length === 0) {
      await db.db
        .insertInto('scene_member_count')
        .values({ did: message.scene, count: 0 })
        .execute()
    }
  }

  async handleRemoveMember(db: Database, message: RemoveMember): Promise<void> {
    db.assertTransaction()
    await db.db
      .updateTable('scene_member_count')
      .set({ count: sql`count - 1` })
      .where('did', '=', message.scene)
      .returning(['did', 'count'])
      .execute()
  }

  async handleAddUpvote(db: Database, message: AddUpvote): Promise<void> {
    db.assertTransaction()
    const userScenes = await db.getScenesForUser(message.user)

    const res = await db.db
      .updateTable('scene_votes_on_post')
      .set({ count: sql`count + 1` })
      .where('subject', '=', message.subject)
      .where('did', 'in', userScenes)
      .returning(['did', 'count'])
      .execute()

    const toInsert = userScenes
      .filter((scene) => !res.some((row) => scene === row.did))
      .map((scene) => ({
        did: scene,
        subject: message.subject,
        count: 1,
      }))

    if (toInsert.length > 0) {
      await db.db.insertInto('scene_votes_on_post').values(toInsert).execute()
    }
  }

  async handleRemoveUpvote(db: Database, message: RemoveUpvote): Promise<void> {
    db.assertTransaction()
    const userScenes = await db.getScenesForUser(message.user)

    await db.db
      .updateTable('scene_votes_on_post')
      .set({ count: sql`count + 1` })
      .where('subject', '=', message.subject)
      .where('did', 'in', userScenes)
      .returning(['did', 'count'])
      .execute()
  }
}

// export const process = async (
//   db: Database,
//   did: string,
//   write: RecordWriteOp,
// ) => {
//   // only process upvotes for now
//   if (write.action !== 'create') return
//   const record = write.value
//   if (write.collection !== schemas.ids.AppBskyFeedVote) return
//   if (!db.records.vote.matchesSchema(record)) return
//   if (record.direction !== 'up') return

//   const { ref } = db.db.dynamic
//   const scenes = await db.db
//     .selectFrom('did_handle')
//     .where('did_handle.actorType', '=', APP_BSKY_SYSTEM.ActorScene)
//     .innerJoin('assertion', 'assertion.creator', 'did_handle.did')
//     .where('assertion.confirmUri', 'is not', null)
//     .where('assertion.subjectDid', '=', did)
//     .select([
//       'did_handle.did as did',
//       'did_handle.handle as handle',
//       views.upvoteCountFromScene(db, ref('did_handle.did')).as('likeCount'),
//       views.sceneMemberCount(db, ref('did_handle.did')).as('memberCount'),
//     ])
//     .execute()
// }
