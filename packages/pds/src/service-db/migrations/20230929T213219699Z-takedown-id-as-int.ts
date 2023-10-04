import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table "repo_root" drop column "takedownId"`.execute(db)
  await sql`alter table "repo_root" add column "takedownId" integer`.execute(db)
  await sql`alter table "repo_blob" drop column "takedownId"`.execute(db)
  await sql`alter table "repo_blob" add column "takedownId" integer`.execute(db)
  await sql`alter table "record" drop column "takedownId"`.execute(db)
  await sql`alter table "record" add column "takedownId" integer`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table "repo_root" drop column "takedownId"`.execute(db)
  await sql`alter table "repo_root" add column "takedownId" varchar`.execute(db)
  await sql`alter table "repo_blob" drop column "takedownId"`.execute(db)
  await sql`alter table "repo_blob" add column "takedownId" varchar`.execute(db)
  await sql`alter table "record" drop column "takedownId"`.execute(db)
  await sql`alter table "record" add column "takedownId" varchar`.execute(db)
}
