import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  if (dialect === 'pg') {
    await sql`
      alter table "repo_root" alter column "takedownId" type integer using "takedownId"::integer;
      alter table "repo_blob" alter column "takedownId" type integer using "takedownId"::integer;
      alter table "record" alter column "takedownId" type integer using "takedownId"::integer;
    `.execute(db)
  } else {
    await sql`alter table "repo_root" drop column "takedownId"`.execute(db)
    await sql`alter table "repo_root" add column "takedownId" integer`.execute(
      db,
    )
    await sql`alter table "repo_blob" drop column "takedownId"`.execute(db)
    await sql`alter table "repo_blob" add column "takedownId" integer`.execute(
      db,
    )
    await sql`alter table "record" drop column "takedownId"`.execute(db)
    await sql`alter table "record" add column "takedownId" integer`.execute(db)
  }
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  if (dialect === 'pg') {
    await sql`
      alter table "repo_root" alter column "takedownId" type varchar;
      alter table "repo_blob" alter column "takedownId" type varchar;
      alter table "record" alter column "takedownId" type varchar;
    `.execute(db)
  } else {
    await sql`alter table "repo_root" drop column "takedownId"`.execute(db)
    await sql`alter table "repo_root" add column "takedownId" varchar`.execute(
      db,
    )
    await sql`alter table "repo_blob" drop column "takedownId"`.execute(db)
    await sql`alter table "repo_blob" add column "takedownId" varchar`.execute(
      db,
    )
    await sql`alter table "record" drop column "takedownId"`.execute(db)
    await sql`alter table "record" add column "takedownId" varchar`.execute(db)
  }
}
