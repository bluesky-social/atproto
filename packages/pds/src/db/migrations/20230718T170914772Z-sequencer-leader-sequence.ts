import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<any>, dialect: Dialect): Promise<void> {
  if (dialect === 'sqlite') return
  const res = await db
    .selectFrom('repo_seq')
    .select('seq')
    .where('seq', 'is not', null)
    .orderBy('seq', 'desc')
    .limit(1)
    .executeTakeFirst()
  const startAt = res?.seq ? res.seq + 50000 : 1
  await sql`CREATE SEQUENCE repo_seq_sequence START ${sql.literal(
    startAt,
  )};`.execute(db)
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  if (dialect === 'sqlite') return
  await sql`DROP SEQUENCE repo_seq_sequence;`.execute(db)
}
