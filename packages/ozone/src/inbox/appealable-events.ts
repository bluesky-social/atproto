import { sql } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex-schema'
import type { Database } from '../db/index.js'
import { com } from '../lexicons/index.js'
import type { ModSubject } from '../mod-service/subject.js'
import {
  LABEL,
  PUBLIC_EVENT_ACTIONS,
  REVERSE_TAKEDOWN,
  TAKEDOWN,
  appealableEventFilter,
  eventSubjectFilter,
} from './appeal.js'

/** Check the public activity that historically allowed a subject-only appeal. */
export async function hasVisiblePublicAction(
  db: Database,
  subject: ModSubject,
  startAt: DatetimeString,
): Promise<boolean> {
  const publicAction = sql<boolean>`action IN (${sql.join(PUBLIC_EVENT_ACTIONS.map(sql.lit))}) AND action <> ${sql.lit(REVERSE_TAKEDOWN)}`
  if (subject.isRepo() || subject.isRecord()) {
    const { subjectDid, subjectUri, subjectType } = subject.info()
    // @NOTE Filter by the covering public-event index before checking the exact
    // subject type by primary key; subjectType is not included in that index.
    const match = await db.db
      .with(
        (cte) => cte('visible_public_events').materialized(),
        (qb) => {
          let events = qb
            .selectFrom('moderation_event')
            .where('subjectDid', '=', subjectDid)
            .where('createdAt', '>=', startAt)
            .where(publicAction)
            .where(
              sql<boolean>`"subjectType" IN (${sql.lit(com.atproto.admin.defs.repoRef.$type)}, ${sql.lit(com.atproto.repo.strongRef.$type)})`,
            )
          events = subjectUri
            ? events.where('subjectUri', '=', subjectUri)
            : events.where('subjectUri', 'is', null)
          return events.select('id')
        },
      )
      .selectFrom('visible_public_events as candidate')
      .innerJoinLateral(
        (eb) =>
          eb
            .selectFrom('moderation_event as exact')
            .whereRef('exact.id', '=', 'candidate.id')
            .where('exact.subjectType', '=', subjectType)
            .select('exact.id')
            .limit(1)
            .as('exact'),
        (join) => join.onTrue(),
      )
      .select('exact.id')
      .limit(1)
      .executeTakeFirst()
    return !!match
  }

  const match = await db.db
    .selectFrom('moderation_event')
    .where((eb) => eventSubjectFilter(eb, subject))
    .where(publicAction)
    .where('createdAt', '>=', startAt)
    .select('id')
    .limit(1)
    .executeTakeFirst()
  return !!match
}

/** Find the latest appealable action for each account or record in a page. */
export async function findLatestAppealableByUri(
  db: Database,
  did: DidString,
  uris: string[],
): Promise<Map<string, DatetimeString | null>> {
  if (!uris.length) return new Map()

  // @NOTE The subject URI and literal action predicates match existing partial
  // indexes even when PostgreSQL uses a generic prepared plan.
  const branch = (account: boolean) => {
    const uriFilter = account
      ? sql`e."subjectUri" IS NULL`
      : sql`e."subjectUri" = s.uri`
    const subjectType = account
      ? com.atproto.admin.defs.repoRef.$type
      : com.atproto.repo.strongRef.$type
    const pageFilter = account ? sql`s.uri = ${did}` : sql`s.uri <> ${did}`
    return sql`
      SELECT s.uri, greatest(t."createdAt", l."createdAt") AS "createdAt"
      FROM unnest(${uris}::text[]) AS s(uri)
      LEFT JOIN LATERAL (
        SELECT e."createdAt" FROM moderation_event e
        WHERE e."subjectDid" = ${did} AND ${uriFilter}
          AND e."subjectType" = ${subjectType} AND e.action = ${sql.lit(TAKEDOWN)}
        ORDER BY e."createdAt" DESC LIMIT 1
      ) t ON true
      LEFT JOIN LATERAL (
        SELECT e."createdAt" FROM moderation_event e
        WHERE e."subjectDid" = ${did} AND ${uriFilter}
          AND e."subjectType" = ${subjectType} AND e.action = ${sql.lit(LABEL)}
          AND e."createdAt" > coalesce(t."createdAt", '')
          AND nullif(btrim(e."createLabelVals"), '') IS NOT NULL
        ORDER BY e."createdAt" DESC LIMIT 1
      ) l ON true
      WHERE ${pageFilter}
    `
  }
  const result = await sql<{ uri: string; createdAt: DatetimeString | null }>`
    ${branch(true)} UNION ALL ${branch(false)}
  `.execute(db.db)
  return new Map(result.rows.map((row) => [row.uri, row.createdAt]))
}

/** Find the latest appealable action without applying the inbox history cutoff. */
export async function findLatestAppealableAt(
  db: Database,
  subject: ModSubject,
): Promise<DatetimeString | null> {
  if (subject.isRepo() || subject.isRecord()) {
    const uri = subject.info().subjectUri ?? subject.did
    return (
      (await findLatestAppealableByUri(db, subject.did, [uri])).get(uri) ?? null
    )
  }

  // Chat subjects do not use account/record event identity or those indexes.
  const row = await db.db
    .selectFrom('moderation_event')
    .where((eb) => eventSubjectFilter(eb, subject))
    .where(appealableEventFilter)
    .select(sql<DatetimeString | null>`max("createdAt")`.as('createdAt'))
    .executeTakeFirstOrThrow()
  return row.createdAt
}
