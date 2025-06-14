import { Kysely } from "kysely"

export async function up(
  db: Kysely<unknown>,
): Promise<void> {
  await db.schema.alterTable("account").alterColumn("passwordScrypt")
    .dropNotNull()
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("account").alterColumn("passwordScrypt")
    .setNotNull()
    .execute()
}
