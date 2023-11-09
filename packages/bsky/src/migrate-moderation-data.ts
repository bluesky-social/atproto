import { TimeCidKeyset, paginate } from './db/pagination'
import { DatabaseCoordinator, PrimaryDatabase } from './index'
import { adjustModerationSubjectStatus } from './services/moderation/status'
import { ModerationEventRow } from './services/moderation/types'

type ModerationAction = Omit<ModerationEventRow, 'meta' | 'comment'> & {
  reason: string
  reversedAt: string | null
  reversedBy: string | null
  reversedReason: string | null
}

type ModerationReport = Pick<
  ModerationEventRow,
  | 'id'
  | 'subjectType'
  | 'subjectDid'
  | 'subjectUri'
  | 'subjectCid'
  | 'createdAt'
> & {
  reasonType: string
  reason: string | null
  reportedByDid: string
}

const getEnv = () => ({
  DB_URL:
    process.env.MODERATION_MIGRATION_DB_URL ||
    'postgresql://pg:password@127.0.0.1:5433/postgres',
  DB_POOL_SIZE: Number(process.env.MODERATION_MIGRATION_DB_URL) || 10,
  DB_SCHEMA: process.env.MODERATION_MIGRATION_DB_SCHEMA || 'bsky',
})
export class ListKeyset extends TimeCidKeyset<{
  createdAt: string
  id: string
}> {
  labelResult(result: { createdAt: string; id: string }) {
    return { primary: result.createdAt, secondary: `${result.id}` }
  }
}

const transformActionToEvent = (actionEntry: ModerationAction) => {
  const {
    id,
    reversedAt,
    reversedBy,
    reversedReason,
    action,
    reason,
    ...rest
  } = actionEntry
  const actionName = action.split('#')[1]
  const event = {
    ...rest,
    comment: reason,
    action:
      `com.atproto.admin.defs#modEvent${actionName[0].toUpperCase()}${actionName.slice(
        1,
      )}` as ModerationEventRow['action'],
  }

  return event
}

const transformReportToEvent = (actionEntry: ModerationReport) => {
  const { id, reasonType, reason, reportedByDid, ...rest } = actionEntry
  const event = {
    ...rest,
    comment: reason,
    createdBy: reportedByDid,
    meta: { reportType: reasonType },
    action:
      'com.atproto.admin.defs#modEventReport' as ModerationEventRow['action'],
  }

  return event
}

// TODO: Figure out what to do with `reversed` actions
const migrateActions = async (db: PrimaryDatabase) => {
  const allActions = await db.db
    // @ts-ignore
    .selectFrom('moderation_action')
    // @ts-ignore
    .select((eb) => eb.fn.count<number>('id').as('count'))
    .executeTakeFirstOrThrow()

  const chunkSize = 10
  const totalChunks = Math.ceil(allActions.count / chunkSize)

  console.log(
    `Initiating migration for ${allActions.count} actions in ${totalChunks} chunks`,
  )

  await db.transaction(async (tx) => {
    let currentChunk = 1
    let lastProcessedId = 0
    do {
      const actions = (await tx.db
        // @ts-ignore
        .selectFrom('moderation_action')
        // @ts-ignore
        .where('id', '>', lastProcessedId)
        // @ts-ignore
        .orderBy('id', 'asc')
        .selectAll()
        .limit(chunkSize)
        .execute()) as ModerationAction[]

      await tx.db
        .insertInto('moderation_event')
        .values(actions.map(transformActionToEvent))
        .execute()

      lastProcessedId = actions[actions.length - 1].id
      console.log(
        `Processed actions chunk ${currentChunk} of ${totalChunks}. lastProcessedId: ${lastProcessedId}`,
      )
      currentChunk++
    } while (currentChunk <= totalChunks)
  })

  console.log(`Actions migration complete!`)
}

const migrateReports = async (db: PrimaryDatabase) => {
  const allReports = await db.db
    // @ts-ignore
    .selectFrom('moderation_report')
    // @ts-ignore
    .select((eb) => eb.fn.count<number>('id').as('count'))
    .executeTakeFirstOrThrow()

  const chunkSize = 10
  const totalChunks = Math.ceil(allReports.count / chunkSize)

  console.log(
    `Initiating migration for ${allReports.count} reports in ${totalChunks} chunks`,
  )

  await db.transaction(async (tx) => {
    let currentChunk = 1
    let lastProcessedId = 0
    do {
      const reports = (await tx.db
        // @ts-ignore
        .selectFrom('moderation_report')
        // @ts-ignore
        .where('id', '>', lastProcessedId)
        // @ts-ignore
        .orderBy('id', 'asc')
        .selectAll()
        .limit(chunkSize)
        .execute()) as ModerationReport[]

      await tx.db
        .insertInto('moderation_event')
        .values(reports.map(transformReportToEvent))
        .execute()

      lastProcessedId = reports[reports.length - 1].id
      console.log(
        `Processed reports chunk ${currentChunk} of ${totalChunks}. lastProcessedId: ${lastProcessedId}`,
      )
      currentChunk++
    } while (currentChunk <= totalChunks)
  })

  console.log(`Reports migration complete!`)
}

const createStatusFromEvents = async (db: PrimaryDatabase) => {
  const { ref } = db.db.dynamic
  const allEvents = await db.db
    // @ts-ignore
    .selectFrom('moderation_event')
    // @ts-ignore
    .select((eb) => eb.fn.count<number>('id').as('count'))
    .executeTakeFirstOrThrow()

  const chunkSize = 10
  const totalChunks = Math.ceil(allEvents.count / chunkSize)

  console.log(
    `Initiating re-processing of ${allEvents.count} events in ${totalChunks} chunks`,
  )

  await db.transaction(async (tx) => {
    let currentChunk = 1
    let cursor
    do {
      const keyset = new ListKeyset(ref('createdAt'), ref('id'))

      const eventsQuery = paginate(tx.db.selectFrom('moderation_event'), {
        keyset,
        cursor,
        limit: chunkSize,
        direction: 'asc' as const,
      }).selectAll()
      const events = await eventsQuery.execute()
      // @ts-ignore
      cursor = keyset.packFromResult(events)

      // TODO: Figure out how to handle blob cids here
      for (const event of events) {
        await adjustModerationSubjectStatus(tx, event)
      }

      console.log(`Processed events chunk ${currentChunk} of ${totalChunks}`)
      currentChunk++
    } while (cursor)
  })

  console.log(`Events migration complete!`)
}

async function main() {
  const env = getEnv()
  const db = new DatabaseCoordinator({
    schema: env.DB_SCHEMA,
    primary: {
      url: env.DB_URL,
      poolSize: env.DB_POOL_SIZE,
    },
    replicas: [],
  })

  const primaryDb = db.getPrimary()
  // TODO: Is this safe? importing actions and reports sequentially will cause the id sequence to fall out of order
  // Meaning we will have to depend on `createdAt` in order to identify the chronological order of events and can no longer depend on id
  await migrateActions(primaryDb)
  await migrateReports(primaryDb)
  await createStatusFromEvents(primaryDb)
}

main()
