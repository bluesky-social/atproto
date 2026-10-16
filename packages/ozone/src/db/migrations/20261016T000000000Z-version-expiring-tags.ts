import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('expiring_tag')
    .addColumn('version', 'integer')
    .execute()
  await db.schema
    .createIndex('idx_expiring_tag_v1_expires_at')
    .on('expiring_tag')
    .column('expiresAt')
    .where(sql.ref('version'), '=', sql.lit(1))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_expiring_tag_v1_expires_at').execute()
  await db.schema.alterTable('expiring_tag').dropColumn('version').execute()
}
