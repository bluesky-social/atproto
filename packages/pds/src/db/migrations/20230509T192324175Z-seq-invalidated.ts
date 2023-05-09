import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('repo_seq')
    .dropConstraint('invalidated_by_fkey')
    .execute()
  await db.schema.alterTable('repo_seq').dropColumn('invalidatedBy').execute()
  await db.schema
    .alterTable('repo_seq')
    .addColumn('invalidated', 'int2', (col) => col.notNull().defaultTo(0))
    .execute()
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  await db.schema.alterTable('repo_seq').dropColumn('invalidated').execute()

  if (dialect === 'pg') {
    await db.schema
      .alterTable('repo_seq')
      .addColumn('invalidatedBy', 'bigint')
      .execute()
    await db.schema
      .alterTable('repo_seq')
      .addForeignKeyConstraint(
        'invalidated_by_fkey',
        // @ts-ignore
        ['invalidatedBy'],
        'repo_seq',
        ['seq'],
      )
      .execute()
  } else {
    await db.schema
      .alterTable('repo_seq')
      .addColumn('invalidatedBy', 'integer')
      .execute()
  }
}
