import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  const pdsBuilder =
    dialect === 'pg'
      ? db.schema
          .createTable('pds')
          .addColumn('id', 'serial', (col) => col.primaryKey())
      : db.schema
          .createTable('pds')
          .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
  await pdsBuilder
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('host', 'varchar', (col) => col.notNull())
    .addColumn('weight', 'integer', (col) => col.notNull().defaultTo(1))
    .execute()
  await db.schema
    .alterTable('user_account')
    .addColumn('pdsId', 'integer', (col) => col.references('pds.id'))
    .execute()
  await db.schema
    .alterTable('user_account')
    .addColumn('takedownRef', 'varchar')
    .execute()
  const migrationDb = db as Kysely<MigrationSchema>
  const { ref } = migrationDb.dynamic
  await migrationDb
    .updateTable('user_account')
    .where(
      'did',
      'in',
      migrationDb
        .selectFrom('repo_root')
        .select('repo_root.did')
        .where('takedownRef', 'is not', null),
    )
    .set({
      takedownRef: migrationDb
        .selectFrom('repo_root')
        .select('repo_root.takedownRef')
        .whereRef('did', '=', ref('user_account.did')),
    })
    .execute()
  // when running manually, ensure to drop column only after it's completely out of use in read path
  await db.schema.alterTable('repo_root').dropColumn('takedownRef').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('repo_root')
    .addColumn('takedownRef', 'varchar')
    .execute()
  // @NOTE no data migration for takedownId here
  await db.schema.alterTable('user_account').dropColumn('takedownRef').execute()
  await db.schema.alterTable('user_account').dropColumn('pdsId').execute()
  await db.schema.dropTable('pds').execute()
}

type MigrationSchema = { repo_root: RepoRoot; user_account: UserAccount }

interface RepoRoot {
  did: string
  takedownRef: string | null
}

interface UserAccount {
  did: string
  takedownRef: string | null
}
