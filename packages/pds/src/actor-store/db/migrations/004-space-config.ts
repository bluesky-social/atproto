import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('space')
    .addColumn('managingApp', 'varchar')
    .execute()

  await db.schema
    .alterTable('space')
    .addColumn('isPublic', 'integer', (col) => col.notNull().defaultTo(0))
    .execute()

  await db.schema
    .alterTable('space')
    .addColumn('appAccessMode', 'varchar', (col) =>
      col.notNull().defaultTo('allow'),
    )
    .execute()

  await db.schema
    .alterTable('space')
    .addColumn('appExceptions', 'text', (col) => col.notNull().defaultTo('[]'))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('space').dropColumn('appExceptions').execute()
  await db.schema.alterTable('space').dropColumn('appAccessMode').execute()
  await db.schema.alterTable('space').dropColumn('isPublic').execute()
  await db.schema.alterTable('space').dropColumn('managingApp').execute()
}
