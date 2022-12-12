import { sql } from 'kysely'
import { Consumer } from '../types'
import { AddMember } from '../messages'
import Database from '../../db'

export default class extends Consumer<AddMember> {
  async dispatch(ctx: { db: Database; message: AddMember }) {
    const { db, message } = ctx
    const res = await db.db
      .updateTable('scene_member_count')
      .set({ count: sql`count + 1` })
      .where('did', '=', message.scene)
      .returningAll()
      .executeTakeFirst()
    if (!res) {
      await db.db
        .insertInto('scene_member_count')
        .values({ did: message.scene, count: 1 })
        .execute()
    }
  }
}
