import type { Selectable } from 'kysely'
import type { DidString } from '@atproto/lex-schema'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { Database } from '../db/index.js'
import type { InboxNotificationPreference } from '../db/schema/inbox_notification_preference.js'
import type { tools } from '../lexicons/index.js'

/** Load viewer preferences, including the default for an account without a row. */
export async function getNotificationPreferences(
  db: Database,
  did: DidString,
): Promise<tools.ozone.inbox.defs.NotificationPreferences> {
  const row = await db.db
    .selectFrom('inbox_notification_preference')
    .selectAll()
    .where('did', '=', did)
    .executeTakeFirst()
  return preferencesFromRow(row)
}

/** Store the authenticated viewer's notification preferences. */
export async function putNotificationPreferences(
  db: Database,
  did: DidString,
  preferences: tools.ozone.inbox.putNotificationPreferences.$InputBody,
): Promise<tools.ozone.inbox.defs.NotificationPreferences> {
  const updates = {
    ...(preferences.reports !== undefined && { reports: preferences.reports }),
    ...(preferences.account !== undefined && { account: preferences.account }),
    ...(preferences.labels !== undefined && { labels: preferences.labels }),
  }
  if (Object.keys(updates).length === 0)
    throw new InvalidRequestError(
      'At least one notification category is required',
    )
  const row = await db.db
    .insertInto('inbox_notification_preference')
    .values({ did, ...updates })
    .onConflict((oc) => oc.column('did').doUpdateSet(updates))
    .returningAll()
    .executeTakeFirstOrThrow()
  return preferencesFromRow(row)
}

function preferencesFromRow(
  row?: Selectable<InboxNotificationPreference>,
): tools.ozone.inbox.defs.NotificationPreferences {
  const fallback = row?.push ?? true
  return {
    reports: row?.reports ?? fallback,
    account: row?.account ?? fallback,
    labels: row?.labels ?? fallback,
  }
}
