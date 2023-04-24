import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  if (dialect !== 'pg') return
  const { ref } = db.dynamic
  // Get name of db
  const dbnameResult = await sql<{
    dbname: string
  }>`select current_database() as dbname`.execute(db)
  // Update word similarity threshold, e.g. used for actor search index via <<% operator.
  const dbRef = ref(dbnameResult.rows[0].dbname)
  await sql`alter database ${dbRef} set pg_trgm.strict_word_similarity_threshold TO .1`.execute(
    db,
  )
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  if (dialect !== 'pg') return
  const { ref } = db.dynamic
  // Get name of db
  const dbnameResult = await sql<{
    dbname: string
  }>`select current_database() as dbname`.execute(db)
  // Update word similarity threshold back to default
  const dbRef = ref(dbnameResult.rows[0].dbname)
  await sql`alter database ${dbRef} set pg_trgm.strict_word_similarity_threshold TO .5`.execute(
    db,
  )
}
