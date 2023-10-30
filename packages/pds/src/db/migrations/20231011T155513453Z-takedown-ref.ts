import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('repo_root')
    .addColumn('takedownRef', 'varchar')
    .execute()
  await db.schema.alterTable('repo_root').dropColumn('takedownId').execute()

  await db.schema
    .alterTable('repo_blob')
    .addColumn('takedownRef', 'varchar')
    .execute()
  await db.schema.alterTable('repo_blob').dropColumn('takedownId').execute()

  await db.schema
    .alterTable('record')
    .addColumn('takedownRef', 'varchar')
    .execute()
  await db.schema.alterTable('record').dropColumn('takedownId').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('repo_root')
    .addColumn('takedownId', 'integer')
    .execute()
  await db.schema.alterTable('repo_root').dropColumn('takedownRef').execute()

  await db.schema
    .alterTable('repo_blob')
    .addColumn('takedownId', 'integer')
    .execute()
  await db.schema.alterTable('repo_blob').dropColumn('takedownRef').execute()

  await db.schema
    .alterTable('record')
    .addColumn('takedownId', 'integer')
    .execute()
  await db.schema.alterTable('record').dropColumn('takedownRef').execute()
}
