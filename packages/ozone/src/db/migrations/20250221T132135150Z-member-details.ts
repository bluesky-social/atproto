import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  try {
    // Add trigram support, supporting user search.
    // Explicitly add to public schema, so the extension can be seen in all schemas.
    await sql`create extension if not exists pg_trgm with schema public`.execute(
      db,
    )
  } catch (err: unknown) {
    // The "if not exists" isn't bulletproof against races, and we see test suites racing to
    // create the extension. So we can just ignore errors indicating the extension already exists.
    if (!err?.['detail']?.includes?.('(pg_trgm) already exists')) throw err
  }

  await db.schema.alterTable('member').addColumn('handle', 'text').execute()
  await db.schema
    .alterTable('member')
    .addColumn('displayName', 'text')
    .execute()
  await db.schema
    .createIndex('member_display_name_idx')
    .on('member')
    .using('gist')
    .expression(sql`"displayName" gist_trgm_ops`)
    .execute()
  await db.schema
    .createIndex('member_handle_idx')
    .on('member')
    .using('gist')
    .expression(sql`"handle" gist_trgm_ops`)
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('member').dropColumn('handle').execute()
  await db.schema.alterTable('member').dropColumn('displayName').execute()
}
