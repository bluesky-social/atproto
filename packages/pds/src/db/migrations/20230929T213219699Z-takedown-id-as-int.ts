import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table "repo_root" alter column "takedownId" type integer using "takedownId"::integer;
    alter table "repo_blob" alter column "takedownId" type integer using "takedownId"::integer;
    alter table "record" alter column "takedownId" type integer using "takedownId"::integer;
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table "repo_root" alter column "takedownId" type varchar;
    alter table "repo_blob" alter column "takedownId" type varchar;
    alter table "record" alter column "takedownId" type varchar;
  `.execute(db)
}
