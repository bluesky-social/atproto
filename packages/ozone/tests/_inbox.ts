import { sql } from 'kysely'
import type { ModeratorClient, SeedClient, TestNetwork } from '@atproto/dev-env'
import type { DatetimeString, DidString } from '@atproto/lex'
import type { Database } from '../src/db/index.js'
import type { InboxSeen } from '../src/db/schema/inbox_seen.js'

type ReportView = Awaited<
  ReturnType<ModeratorClient['queryReports']>
>['reports'][number]

/** Resolve the public report ID using the same API available to moderators. */
export async function reportForEvent(
  mod: ModeratorClient,
  eventId: number,
): Promise<
  Omit<ReportView, 'actionEventIds'> & {
    queueId: number
    actionEventIds: number[] | null
  }
> {
  for (const status of ['open', 'queued', 'closed', 'assigned', 'escalated']) {
    for (const isMuted of [false, true]) {
      const { reports } = await mod.queryReports({
        status,
        isMuted,
        limit: 100,
      })
      const report = reports.find((row) => row.eventId === eventId)
      if (report)
        return {
          ...report,
          queueId: report.queue?.id ?? -1,
          actionEventIds: report.actionEventIds ?? null,
        }
    }
  }
  throw new Error(`No report returned for event ${eventId}`)
}

/** Headers for the viewer-facing endpoints through the PDS proxy. */
export function inboxHeaders(
  network: TestNetwork,
  sc: SeedClient,
  did: DidString,
) {
  return {
    ...sc.getHeaders(did),
    'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
  }
}

/** Reset fixtures that have no deletion endpoint. */
export async function resetInbox(db: Database): Promise<void> {
  await db.db.deleteFrom('inbox_notification').execute()
  await db.db.deleteFrom('inbox_notification_preference').execute()
  await db.db.deleteFrom('inbox_seen').execute()
}

/** Legacy timestamp fixtures cannot be created through updateSeen. */
export async function seedSeenAt(
  db: Database,
  did: DidString,
  section: InboxSeen['section'],
  seenAt: DatetimeString,
): Promise<void> {
  await db.db
    .insertInto('inbox_seen')
    .values({ did, section, seenAt })
    .execute()
}

/** Exercise real PostgreSQL transaction failure, rather than a rejected JS mock. */
export async function withNotificationInsertFailure(
  db: Database,
  run: () => Promise<void>,
): Promise<void> {
  await sql`create function fail_inbox_notification() returns trigger language plpgsql as $$ begin raise exception 'notification test failure'; end $$`.execute(
    db.db,
  )
  await sql`create trigger fail_inbox_notification before insert on inbox_notification for each statement execute function fail_inbox_notification()`.execute(
    db.db,
  )
  try {
    await run()
  } finally {
    await sql`drop trigger fail_inbox_notification on inbox_notification`.execute(
      db.db,
    )
    await sql`drop function fail_inbox_notification()`.execute(db.db)
  }
}
