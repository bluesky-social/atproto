import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // supports listing user invites
  await db.schema
    .createIndex('invite_code_for_user_idx')
    .on('invite_code')
    .column('forUser')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('invite_code_for_user_idx').execute()
}
