import { sql } from 'kysely'
import { currentDatetimeString, toDatetimeString } from '@atproto/lex-schema'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { Database } from '../db/index.js'
import type { tools } from '../lexicons/index.js'
import type { QueueAccess } from '../queue/access.js'

const MAX_DAYS = 120

type BreakdownRow = {
  reportType: string
  inboundCount: string | number
}

/** Fetch additional details for one report stat group and UTC calendar window. */
export async function getStatGroupDetails(
  db: Database,
  params: tools.ozone.report.getStatGroupDetails.$Params,
  access: QueueAccess,
  signal?: AbortSignal,
): Promise<tools.ozone.report.getStatGroupDetails.$OutputBody> {
  const computedAt = currentDatetimeString()
  const startDate = toDatetimeString(
    `${toDatetimeString(params.startDate ?? computedAt).slice(0, 10)}T00:00:00.000Z`,
  )
  const endDate = toDatetimeString(
    `${toDatetimeString(params.endDate ?? computedAt).slice(0, 10)}T00:00:00.000Z`,
  )
  const day = 86_400_000
  const duration = Date.parse(endDate) - Date.parse(startDate) + day
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > MAX_DAYS * day
  ) {
    throw new InvalidRequestError(
      `Date range must be ordered and include at most ${MAX_DAYS} calendar days`,
    )
  }
  const endExclusive = toDatetimeString(Date.parse(endDate) + day)
  const { queueId, moderatorDid, reportTypes } = params
  const predicates = [
    sql`"isMuted" = false`,
    sql`"createdAt" >= ${startDate} and "createdAt" < ${endExclusive}`,
    sql`("queueId" is null or ${access.filter('queueId')})`,
  ]
  if (queueId === -1) {
    predicates.push(sql`("queueId" is null or "queueId" = -1)`)
  } else if (queueId !== undefined) {
    predicates.push(sql`"queueId" = ${queueId}`)
  } else if (moderatorDid) {
    predicates.push(sql`"assignedTo" = ${moderatorDid}`)
  } else if (reportTypes?.length) {
    predicates.push(sql`"reportType" in (${sql.join(reportTypes)})`)
  }
  const result = await sql<BreakdownRow>`
    select "reportType", count(*) as "inboundCount"
    from report
    where ${sql.join(predicates, sql` and `)}
    group by "reportType"
    order by "inboundCount" desc, "reportType"
  `.execute(db.db, { signal, inflightQueryAbortStrategy: 'cancel query' })

  const stats = result.rows.map((row) => ({
    reportType: row.reportType,
    inboundCount: Number(row.inboundCount),
  }))
  return {
    computedAt,
    startDate,
    endDate,
    reportTypeBreakdown: {
      totalCount: stats.reduce((total, row) => total + row.inboundCount, 0),
      stats,
    },
  }
}
