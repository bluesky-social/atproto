import { sql } from 'kysely'
import { DatabaseCoordinator, PrimaryDatabase } from './index'
import { adjustModerationSubjectStatus } from './services/moderation/status'
import { ModerationEventRow } from './services/moderation/types'

type ModerationActionRow = Omit<ModerationEventRow, 'comment' | 'meta'> & {
  reason: string | null
}

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
          sql`CONCAT('com.atproto.admin.defs#modEvent', UPPER(SUBSTRING(SPLIT_PART(action, '#', 2) FROM 1 FOR 1)), SUBSTRING(SPLIT_PART(action, '#', 2) FROM 2))`.as(
            'action',
          ),
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

const setReportedAtTimestamp = async (db: PrimaryDatabase) => {
  console.log('Initiating lastReportedAt timestamp sync')
  const didUpdate = await sql`
    UPDATE moderation_subject_status
    SET "lastReportedAt" = reports."createdAt"
    FROM (
      select "subjectDid", "subjectUri", MAX("createdAt") as "createdAt"
      from moderation_report
      where "subjectUri" is null
      group by "subjectDid", "subjectUri"
    ) as reports
    WHERE reports."subjectDid" = moderation_subject_status."did"
      AND "recordPath"=''
  `.execute(db.db)

  console.log(
    `Updated lastReportedAt for ${didUpdate.numUpdatedOrDeletedRows} did subject`,
  )

  const contentUpdate = await sql`
    UPDATE moderation_subject_status
    SET "lastReportedAt" = reports."createdAt"
    FROM (
      select "subjectDid", "subjectUri", MAX("createdAt") as "createdAt"
      from moderation_report
      where "subjectUri" is not null
      group by "subjectDid", "subjectUri"
    ) as reports
    WHERE reports."subjectDid" = moderation_subject_status."did"
      AND "recordPath" is not null
      AND POSITION(moderation_subject_status."recordPath" IN reports."subjectUri") > 0
  `.execute(db.db)

  console.log(
    `Updated lastReportedAt for ${contentUpdate.numUpdatedOrDeletedRows} subject with uri`,
  )
}

const createStatusFromActions = async (db: PrimaryDatabase) => {
  const allEvents = await db.db
    // @ts-ignore
    .selectFrom('moderation_action')
    // @ts-ignore
    .where('reversedAt', 'is', null)
    // @ts-ignore
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
        // @ts-ignore
        .selectFrom('moderation_action')
        // @ts-ignore
        .where('reversedAt', 'is', null)
        // @ts-ignore
        .where('id', '>', lastProcessedId)
        .limit(chunkSize)
        .selectAll()
      const events = (await eventsQuery.execute()) as ModerationActionRow[]

      for (const event of events) {
        // Remap action to event data type
        const actionParts = event.action.split('#')
        await adjustModerationSubjectStatus(tx, {
          ...event,
          action: `${actionParts[0]}#modEvent${actionParts[1]
            .charAt(0)
            .toUpperCase()}${actionParts[1].slice(
            1,
          )}` as ModerationEventRow['action'],
          comment: event.reason,
          meta: null,
        })
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

const syncBlobCids = async (db: PrimaryDatabase) => {
  console.log('Initiating blob cid sync')
  const results = await sql`
    UPDATE moderation_subject_status
    SET "blobCids" = blob_action."cids"
    FROM (
        SELECT moderation_action."subjectUri", moderation_action."subjectDid", jsonb_agg(moderation_action_subject_blob."cid") as cids
        FROM moderation_action_subject_blob
            JOIN moderation_action
                ON moderation_action.id = moderation_action_subject_blob."actionId"
          WHERE moderation_action."reversedAt" is NULL
          GROUP by moderation_action."subjectUri", moderation_action."subjectDid"
    ) as blob_action
    WHERE did = "subjectDid" AND position("recordPath" IN "subjectUri") > 0
  `.execute(db.db)
  console.log(`Updated blob cids on ${results.numUpdatedOrDeletedRows} rows`)
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
  await createStatusFromActions(primaryDb)
  await setReportedAtTimestamp(primaryDb)
  await syncBlobCids(primaryDb)

  console.log('Migration complete!')
}

main()
