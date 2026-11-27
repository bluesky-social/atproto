import { sql } from 'kysely'
import type { ModeratorClient, SeedClient, TestNetwork } from '@atproto/dev-env'
import type { DatetimeString, DidString } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import type { Database } from '../src/db/index.js'
import type { InboxSeen } from '../src/db/schema/inbox_seen.js'
import type { chat, com } from '../src/lexicons/index.js'

type ReportView = Awaited<
  ReturnType<ModeratorClient['queryReports']>
>['reports'][number]

export type ReportRow = Omit<ReportView, 'actionEventIds'> & {
  queueId: number
  actionEventIds: number[] | null
}

export type ReportSubject = ReturnType<
  | typeof com.atproto.admin.defs.repoRef.$build
  | typeof com.atproto.repo.strongRef.$build
  | typeof chat.bsky.convo.defs.messageRef.$build
  | typeof chat.bsky.convo.defs.convoRef.$build
>

// @NOTE Unmuted statuses first: a report matches exactly one combination.
const REPORT_FILTERS = [false, true].flatMap((isMuted) =>
  ['open', 'queued', 'closed', 'assigned', 'escalated'].map((status) => ({
    status,
    isMuted,
  })),
)

function toReportRow(report: ReportView): ReportRow {
  return {
    ...report,
    queueId: report.queue?.id ?? -1,
    actionEventIds: report.actionEventIds ?? null,
  }
}

/** Resolve the public report ID using the same API available to moderators. */
export async function reportForEvent(
  mod: ModeratorClient,
  eventId: number,
  subject?: string,
): Promise<ReportRow> {
  for (const filter of REPORT_FILTERS) {
    const { reports } = await mod.queryReports({
      ...filter,
      subject,
      limit: 100,
    })
    const report = reports.find((row) => row.eventId === eventId)
    if (report) return toReportRow(report)
  }
  throw new Error(`No report returned for event ${eventId}`)
}

/** Resolve several report events, querying each subject DID's reports once per status. */
export async function reportsForEvents(
  mod: ModeratorClient,
  events: { eventId: number; did: string }[],
): Promise<ReportRow[]> {
  const found = new Map<number, ReportRow>()
  for (const did of new Set(events.map((event) => event.did))) {
    const pending = new Set(
      events.filter((event) => event.did === did).map(({ eventId }) => eventId),
    )
    for (const filter of REPORT_FILTERS) {
      let cursor: string | undefined
      do {
        const page = await mod.queryReports({
          ...filter,
          did,
          cursor,
          limit: 100,
        })
        for (const report of page.reports) {
          if (pending.delete(report.eventId)) {
            found.set(report.eventId, toReportRow(report))
          }
        }
        cursor = page.cursor
      } while (pending.size && cursor)
      if (!pending.size) break
    }
    if (pending.size) {
      throw new Error(`No report returned for events ${[...pending]}`)
    }
  }
  return events.map(({ eventId }) => found.get(eventId)!)
}

/**
 * File reports in order and resolve their views. Report rows are written with
 * their events, so one routing pass, rather than a network flush per report,
 * brings them to the state moderators read.
 */
export async function createReports(
  network: TestNetwork,
  sc: SeedClient,
  reports: {
    subject: ReportSubject
    reasonType: string
    reportedBy: DidString
  }[],
): Promise<ReportRow[]> {
  const events: { eventId: number; did: string }[] = []
  for (const report of reports) {
    const { id } = await sc.createReport(report)
    const { subject } = report
    events.push({
      eventId: id,
      did: 'uri' in subject ? new AtUri(subject.uri).host : subject.did,
    })
  }
  await network.ozone.daemon.ctx.queueRouter.routeReports()
  return reportsForEvents(network.ozone.getModClient(), events)
}

/**
 * Hand out fixtures that are created in batches, so a batch shares one network
 * flush instead of paying for one per fixture. Each fixture is used once.
 */
export function pooled<T>(
  create: () => Promise<T>,
  flush: () => Promise<void>,
  batchSize = 8,
): () => Promise<T> {
  const pool: T[] = []
  return async () => {
    if (!pool.length) {
      for (let i = 0; i < batchSize; i++) pool.push(await create())
      await flush()
    }
    return pool.shift()!
  }
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
