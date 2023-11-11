import { sql } from 'kysely'
import { DatabaseCoordinator, PrimaryDatabase } from './index'
import { adjustModerationSubjectStatus } from './services/moderation/status'

const getEnv = () => ({
  DB_URL:
    process.env.MODERATION_MIGRATION_DB_URL ||
    'postgresql://pg:password@127.0.0.1:5433/postgres',
  DB_POOL_SIZE: Number(process.env.MODERATION_MIGRATION_DB_URL) || 10,
  DB_SCHEMA: process.env.MODERATION_MIGRATION_DB_SCHEMA || 'bsky',
})

const countEntries = async (db: PrimaryDatabase) => {
  const [allActions, allReports] = await Promise.all([
    db.db
      // @ts-ignore
      .selectFrom('moderation_action')
      // @ts-ignore
      .select((eb) => eb.fn.count<number>('id').as('count'))
      .executeTakeFirstOrThrow(),
    db.db
      // @ts-ignore
      .selectFrom('moderation_report')
      // @ts-ignore
      .select((eb) => eb.fn.count<number>('id').as('count'))
      .executeTakeFirstOrThrow(),
  ])

  return { reportsCount: allReports.count, actionsCount: allActions.count }
}

const countEvents = async (db: PrimaryDatabase) => {
  const events = await db.db
    .selectFrom('moderation_event')
    .select((eb) => eb.fn.count<number>('id').as('count'))
    .executeTakeFirstOrThrow()

  return events.count
}

const countStatuses = async (db: PrimaryDatabase) => {
  const events = await db.db
    .selectFrom('moderation_subject_status')
    .select((eb) => eb.fn.count<number>('id').as('count'))
    .executeTakeFirstOrThrow()

  return events.count
}

const createEvents = async (db: PrimaryDatabase) => {
  const commonColumns = [
    'subjectDid',
    'subjectUri',
    'subjectType',
    'subjectCid',
    sql`reason`.as('comment'),
    'createdAt',
  ]

  const insertQuery = db.db
    .insertInto('moderation_event')
    .columns([
      'subjectDid',
      'subjectUri',
      'subjectType',
      'subjectCid',
      'comment',
      'createdAt',
      'action',
      'createLabelVals',
      'negateLabelVals',
      'createdBy',
      'durationInHours',
      'expiresAt',
      'meta',
    ])
    .expression((eb) =>
      eb
        // @ts-ignore
        .selectFrom('moderation_action')
        // @ts-ignore
        .select([
          ...commonColumns,
          sql`CONCAT('com.atproto.admin.defs#modEvent', UPPER(SUBSTRING(SPLIT_PART(action, '#', 2) FROM 1 FOR 1)), SUBSTRING(SPLIT_PART(action, '#', 2) FROM 2))`.as('action'),
          'createLabelVals',
          'negateLabelVals',
          'createdBy',
          'durationInHours',
          'expiresAt',
          sql`NULL`.as('meta'),
        ])
        .unionAll(
          eb
            // @ts-ignore
            .selectFrom('moderation_report')
            // @ts-ignore
            .select([
              ...commonColumns,
              sql`'com.atproto.admin.defs#modEventReport'`.as('action'),
              sql`NULL`.as('createLabelVals'),
              sql`NULL`.as('negateLabelVals'),
              sql`"reportedByDid"`.as('createdBy'),
              sql`NULL`.as('durationInHours'),
              sql`NULL`.as('expiresAt'),
              sql`json_build_object('reportType', "reasonType")`.as('meta'),
            ]),
        )
        .orderBy('createdAt', 'asc'),
    )

  await insertQuery.execute()
  const totalEvents = await countEvents(db)
  console.log(`Created ${totalEvents} events`)

  return
}

const createStatusFromEvents = async (db: PrimaryDatabase) => {
  const allEvents = await db.db
    .selectFrom('moderation_event')
    .where('action', '!=', 'com.atproto.admin.defs#modEventReport')
    .select((eb) => eb.fn.count<number>('id').as('count'))
    .executeTakeFirstOrThrow()

  const chunkSize = 10
  const totalChunks = Math.ceil(allEvents.count / chunkSize)

  console.log(`Processing ${allEvents.count} actions in ${totalChunks} chunks`)

  await db.transaction(async (tx) => {
    let currentChunk = 1
    let lastProcessedId = 0
    do {
      const eventsQuery = tx.db
        .selectFrom('moderation_event')
        .where('id', '>', lastProcessedId)
        .limit(chunkSize)
        .selectAll()
      const events = await eventsQuery.execute()

      // TODO: Figure out how to handle blob cids here
      for (const event of events) {
        await adjustModerationSubjectStatus(tx, event)
      }

      console.log(`Processed events chunk ${currentChunk} of ${totalChunks}`)
      lastProcessedId = events.at(-1)?.id ?? 0
      currentChunk++
    } while (currentChunk < totalChunks)
  })

  console.log(`Events migration complete!`)

  const totalStatuses = await countStatuses(db)
  console.log(`Created ${totalStatuses} statuses`)
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

  const counts = await countEntries(primaryDb)
  const totalEntries = counts.actionsCount + counts.reportsCount

  console.log(`Migrating ${totalEntries} rows of actions and reports`)
  await createEvents(primaryDb)
  await createStatusFromEvents(primaryDb)
}

main()
