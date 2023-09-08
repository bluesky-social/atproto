import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  const timestamp = dialect === 'sqlite' ? 'datetime' : 'timestamptz'
  await db.schema
    .createTable('email_token')
    .addColumn('purpose', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('token', 'varchar', (col) => col.notNull())
    .addColumn('requestedAt', timestamp, (col) => col.notNull())
    .addPrimaryKeyConstraint('email_token_pkey', ['purpose', 'did'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('email_token').execute()
}
