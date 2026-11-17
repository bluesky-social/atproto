import { sql } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex-schema'
import type { Database } from '../db/index.js'
import { com } from '../lexicons/index.js'
import type { ModSubject } from '../mod-service/subject.js'
import {
  LABEL,
  TAKEDOWN,
  appealableEventFilter,
  eventSubjectFilter,
} from './appeal.js'

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
