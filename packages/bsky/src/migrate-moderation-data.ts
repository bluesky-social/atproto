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
  DB_POOL_SIZE: Number(process.env.MODERATION_MIGRATION_DB_POOL_SIZE) || 10,
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

const getLatestReportLegacyRefId = async (db: PrimaryDatabase) => {
  const events = await db.db
    .selectFrom('moderation_event')
    .select((eb) => eb.fn.max('legacyRefId').as('latestLegacyRefId'))
    .where('action', '=', 'com.atproto.admin.defs#modEventReport')
    .executeTakeFirstOrThrow()

  return events.latestLegacyRefId
}

const countStatuses = async (db: PrimaryDatabase) => {
  const events = await db.db
    .selectFrom('moderation_subject_status')
    .select((eb) => eb.fn.count<number>('id').as('count'))
    .executeTakeFirstOrThrow()

  return events.count
}

const processLegacyReports = async (
  db: PrimaryDatabase,
  legacyIds: number[],
) => {
  if (!legacyIds.length) {
    console.log('No legacy reports to process')
    return
  }
  const reports = await db.db
    .selectFrom('moderation_event')
    .where('action', '=', 'com.atproto.admin.defs#modEventReport')
    .where('legacyRefId', 'in', legacyIds)
    .orderBy('legacyRefId', 'asc')
    .selectAll()
    .execute()

  console.log(`Processing ${reports.length} reports from ${legacyIds.length}`)
  await db.transaction(async (tx) => {
    // This will be slow but we need to run this in sequence
    for (const report of reports) {
      await adjustModerationSubjectStatus(tx, report)
    }
  })
  console.log(`Completed processing ${reports.length} reports`)
}

const getReportEventsAboveLegacyId = async (
  db: PrimaryDatabase,
  aboveLegacyId: number,
) => {
  return await db.db
    .selectFrom('moderation_event')
    .where('action', '=', 'com.atproto.admin.defs#modEventReport')
    .where('legacyRefId', '>', aboveLegacyId)
    .select(sql<number>`"legacyRefId"`.as('legacyRefId'))
    .execute()
}

const createEvents = async (
  db: PrimaryDatabase,
  opts?: { onlyReportsAboveId: number },
) => {
  const commonColumnsToSelect = [
    'subjectDid',
    'subjectUri',
    'subjectType',
    'subjectCid',
    sql`reason`.as('comment'),
    'createdAt',
  ]
  const commonColumnsToInsert = [
    'subjectDid',
    'subjectUri',
    'subjectType',
    'subjectCid',
    'comment',
    'createdAt',
    'action',
    'createdBy',
  ] as const

  let totalActions: number
  if (!opts?.onlyReportsAboveId) {
    await db.db
      .insertInto('moderation_event')
      .columns([
        'id',
        ...commonColumnsToInsert,
        'createLabelVals',
        'negateLabelVals',
        'durationInHours',
        'expiresAt',
      ])
      .expression((eb) =>
        eb
          // @ts-ignore
          .selectFrom('moderation_action')
          // @ts-ignore
          .select([
            'id',
            ...commonColumnsToSelect,
            sql`CONCAT('com.atproto.admin.defs#modEvent', UPPER(SUBSTRING(SPLIT_PART(action, '#', 2) FROM 1 FOR 1)), SUBSTRING(SPLIT_PART(action, '#', 2) FROM 2))`.as(
              'action',
            ),
            'createdBy',
            'createLabelVals',
            'negateLabelVals',
            'durationInHours',
            'expiresAt',
          ])
          .orderBy('id', 'asc'),
      )
      .execute()

    totalActions = await countEvents(db)
    console.log(`Created ${totalActions} events from actions`)

    await sql`SELECT setval(pg_get_serial_sequence('moderation_event', 'id'), (select max(id) from moderation_event))`.execute(
      db.db,
    )
    console.log('Reset the id sequence for moderation_event')
  } else {
    totalActions = await countEvents(db)
  }

  await db.db
    .insertInto('moderation_event')
    .columns([...commonColumnsToInsert, 'meta', 'legacyRefId'])
    .expression((eb) => {
      const builder = eb
        // @ts-ignore
        .selectFrom('moderation_report')
        // @ts-ignore
        .select([
          ...commonColumnsToSelect,
          sql`'com.atproto.admin.defs#modEventReport'`.as('action'),
          sql`"reportedByDid"`.as('createdBy'),
          sql`json_build_object('reportType', "reasonType")`.as('meta'),
          sql`id`.as('legacyRefId'),
        ])

      if (opts?.onlyReportsAboveId) {
        // @ts-ignore
        return builder.where('id', '>', opts.onlyReportsAboveId)
      }

      return builder
    })
    .execute()

  const totalEvents = await countEvents(db)
  console.log(`Created ${totalEvents - totalActions} events from reports`)

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
      AND "recordPath" = ''
      AND ("lastReportedAt" is null OR "lastReportedAt" < reports."createdAt")
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
      AND ("lastReportedAt" is null OR "lastReportedAt" < reports."createdAt")
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

  const chunkSize = 2500
  const totalChunks = Math.ceil(allEvents.count / chunkSize)

  console.log(`Processing ${allEvents.count} actions in ${totalChunks} chunks`)

  await db.transaction(async (tx) => {
    // This is not used for pagination but only for logging purposes
    let currentChunk = 1
    let lastProcessedId: undefined | number = 0
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
          action: `com.atproto.admin.defs#modEvent${actionParts[1]
            .charAt(0)
            .toUpperCase()}${actionParts[1].slice(
            1,
          )}` as ModerationEventRow['action'],
          comment: event.reason,
          meta: null,
        })
      }

      console.log(`Processed events chunk ${currentChunk} of ${totalChunks}`)
      lastProcessedId = events.at(-1)?.id
      currentChunk++
    } while (lastProcessedId !== undefined)
  })

  console.log(`Events migration complete!`)

  const totalStatuses = await countStatuses(db)
  console.log(`Created ${totalStatuses} statuses`)
}

const remapFlagToAcknlowedge = async (db: PrimaryDatabase) => {
  console.log('Initiating flag to ack remap')
  const results = await sql`
    UPDATE moderation_event
    SET "action" = 'com.atproto.admin.defs#modEventAcknowledge'
    WHERE action = 'com.atproto.admin.defs#modEventFlag'
  `.execute(db.db)
  console.log(`Remapped ${results.numUpdatedOrDeletedRows} flag actions to ack`)
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

async function updateStatusFromUnresolvedReports(db: PrimaryDatabase) {
  const { ref } = db.db.dynamic
  const reports = await db.db
    // @ts-ignore
    .selectFrom('moderation_report')
    .whereNotExists((qb) =>
      qb
        .selectFrom('moderation_report_resolution')
        .selectAll()
        // @ts-ignore
        .whereRef('reportId', '=', ref('moderation_report.id')),
    )
    .select(sql<number>`moderation_report.id`.as('legacyId'))
    .execute()

  console.log('Updating statuses based on unresolved reports')
  await processLegacyReports(
    db,
    reports.map((report) => report.legacyId),
  )
  console.log('Completed updating statuses based on unresolved reports')
}

export async function MigrateModerationData() {
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

  const [counts, existingEventsCount] = await Promise.all([
    countEntries(primaryDb),
    countEvents(primaryDb),
  ])

  // If there are existing events in the moderation_event table, we assume that the migration has already been run
  // so we just bring over any new reports since last run
  if (existingEventsCount) {
    console.log(
      `Found ${existingEventsCount} existing events. Migrating ${counts.reportsCount} reports only, ignoring actions`,
    )
    const reportMigrationStartedAt = Date.now()
    const latestReportLegacyRefId = await getLatestReportLegacyRefId(primaryDb)

    if (latestReportLegacyRefId) {
      await createEvents(primaryDb, {
        onlyReportsAboveId: latestReportLegacyRefId,
      })
      const newReportEvents = await getReportEventsAboveLegacyId(
        primaryDb,
        latestReportLegacyRefId,
      )
      await processLegacyReports(
        primaryDb,
        newReportEvents.map((evt) => evt.legacyRefId),
      )
      await setReportedAtTimestamp(primaryDb)
    } else {
      console.log('No reports have been migrated into events yet, bailing.')
    }

    console.log(
      `Time spent: ${(Date.now() - reportMigrationStartedAt) / 1000} seconds`,
    )
    console.log('Migration complete!')
    return
  }

  const totalEntries = counts.actionsCount + counts.reportsCount
  console.log(`Migrating ${totalEntries} rows of actions and reports`)
  const startedAt = Date.now()
  await createEvents(primaryDb)
  // Important to run this before creation statuses from actions to ensure that we are not attempting to map flag actions
  await remapFlagToAcknlowedge(primaryDb)
  await createStatusFromActions(primaryDb)
  await updateStatusFromUnresolvedReports(primaryDb)
  await setReportedAtTimestamp(primaryDb)
  await syncBlobCids(primaryDb)

  console.log(`Time spent: ${(Date.now() - startedAt) / 1000 / 60} minutes`)
  console.log('Migration complete!')
}
