import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Used for listOnlineMembers
  await sql`
    CREATE INDEX IF NOT EXISTS report_activity_member_created_idx
    ON report_activity ("createdBy", "createdAt", id)
    WHERE "isAutomated" = false
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex('report_activity_member_created_idx')
    .ifExists()
    .execute()
}
