import type { DidString } from '@atproto/lex'
import type { Database } from '../db/index.js'
import type { tools } from '../lexicons/index.js'

/** Load viewer preferences, including the default for an account without a row. */
export async function getNotificationPreferences(
  db: Database,
  did: DidString,
): Promise<tools.ozone.inbox.defs.NotificationPreferences> {
  const row = await db.db
    .selectFrom('inbox_notification_preference')
    .select('push')
    .where('did', '=', did)
    .executeTakeFirst()
  return { push: row?.push ?? true }
}

/** Store the authenticated viewer's notification preferences. */
export async function putNotificationPreferences(
  db: Database,
  did: DidString,
  preferences: tools.ozone.inbox.defs.NotificationPreferences,
): Promise<tools.ozone.inbox.defs.NotificationPreferences> {
  await db.db
    .insertInto('inbox_notification_preference')
    .values({ did, push: preferences.push })
    .onConflict((oc) =>
      oc.column('did').doUpdateSet({ push: preferences.push }),
    )
    .execute()
  return preferences
}
