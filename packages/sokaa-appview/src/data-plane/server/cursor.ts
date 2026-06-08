import { DatabaseSchema } from './db/database-schema'

export async function getSubscriptionCursor(
  db: DatabaseSchema,
): Promise<number | undefined> {
  const row = await db
    .selectFrom('subscription_cursor')
    .selectAll()
    .executeTakeFirst()
  return row?.lastSeq
}

export async function setSubscriptionCursor(
  db: DatabaseSchema,
  lastSeq: number,
  updatedAt: string,
) {
  await db
    .insertInto('subscription_cursor')
    .values({ id: 1, lastSeq, updatedAt })
    .onConflict((oc) => oc.column('id').doUpdateSet({ lastSeq, updatedAt }))
    .execute()
}
