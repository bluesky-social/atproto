import { Kysely } from 'kysely'

const commitBlockTable = 'repo_commit_block'
const commitHistoryTable = 'repo_commit_history'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable(commitBlockTable)
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('block', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint(`${commitBlockTable}_pkey`, [
      'creator',
      'commit',
      'block',
    ])
    .execute()
  await db.schema
    .createTable(commitHistoryTable)
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('prev', 'varchar')
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint(`${commitHistoryTable}_pkey`, [
      'creator',
      'commit',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(commitHistoryTable).execute()
  await db.schema.dropTable(commitBlockTable).execute()
}
