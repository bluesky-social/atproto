import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  sql`alter table "repo_root" alter column "takedownId" type integer using "takedownId"::integer`.execute(
    db,
  )
  sql`alter table "repo_blob" alter column "takedownId" type integer using "takedownId"::integer`.execute(
    db,
  )
  sql`alter table "record" alter column "takedownId" type integer using "takedownId"::integer`.execute(
    db,
  )
}

export async function down(db: Kysely<unknown>): Promise<void> {
  sql`alter table "repo_root" alter column "takedownId" type varchar`.execute(
    db,
  )
  sql`alter table "repo_blob" alter column "takedownId" type varchar`.execute(
    db,
  )
  sql`alter table "record" alter column "takedownId" type varchar`.execute(db)
}
