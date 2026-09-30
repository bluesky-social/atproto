import { sql } from 'kysely'
import { currentDatetimeString, toDatetimeString } from '@atproto/lex'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { inboxSection } from '../../inbox/notifications.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.updateSeen, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const now = currentDatetimeString()
      const requestedAt = input.body.seenAt
        ? toDatetimeString(new Date(input.body.seenAt))
        : now
      const seenAt = requestedAt < now ? requestedAt : now
      const sections = [...new Set(input.body.sections.map(inboxSection))]
      const applied = await ctx.db.transaction(async (txn) => {
        // @NOTE Serialize overlapping section updates, including inserts,
        // so requests listing sections in different orders cannot deadlock.
        await sql`select pg_advisory_xact_lock(hashtext(${auth.credentials.iss}))`.execute(
          txn.db,
        )
        const existing = await txn.db
          .selectFrom('inbox_seen')
          .select(['section', 'seenAt'])
          .where('did', '=', auth.credentials.iss)
          .where('section', 'in', sections)
          .execute()
        // @NOTE Normalize legacy rows with the same date rules as new inputs.
        const previous = new Map(
          existing.map((row) => [
            row.section,
            toDatetimeString(new Date(row.seenAt)),
          ]),
        )
        const rows = await txn.db
          .insertInto('inbox_seen')
          .values(
            sections.map((section) => {
              const oldSeenAt = previous.get(section)
              return {
                did: auth.credentials.iss,
                section,
                seenAt: oldSeenAt && oldSeenAt > seenAt ? oldSeenAt : seenAt,
              }
            }),
          )
          .onConflict((oc) =>
            oc.columns(['did', 'section']).doUpdateSet({
              seenAt: sql`excluded."seenAt"`,
            }),
          )
          .returning('seenAt')
          .execute()
        // @NOTE Only the earliest watermark is shared by every section.
        return rows.reduce(
          (min, row) => (row.seenAt < min ? row.seenAt : min),
          rows[0].seenAt,
        )
      })
      return { encoding: 'application/json', body: { seenAt: applied } }
    },
  })
}
