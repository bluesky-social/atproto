import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // SQLite doesn't support ALTER COLUMN directly
  // But the schema change is backward compatible
  // Existing code already handles null passwords in validation
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // No-op: backward compatible
}
