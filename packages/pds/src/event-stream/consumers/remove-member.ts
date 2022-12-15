import { sql } from 'kysely'
import Database from '../../db'
import { RemoveMember } from '../messages'
import { Consumer } from '../types'

export default class extends Consumer<RemoveMember> {
  async dispatch(ctx: { db: Database; message: RemoveMember }) {
    const { db, message } = ctx
    await db.db
      .updateTable('scene_member_count')
      .set({ count: sql`count - 1` })
      .where('did', '=', message.scene)
      .returning(['did', 'count'])
      .execute()
  }
}
