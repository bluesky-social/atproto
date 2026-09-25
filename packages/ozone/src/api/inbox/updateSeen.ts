import { sql } from 'kysely'
import { currentDatetimeString } from '@atproto/lex'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { inboxSection } from '../../inbox/notifications.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.updateSeen, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const now = currentDatetimeString()
      const seenAt =
        input.body.seenAt && input.body.seenAt < now ? input.body.seenAt : now
      const sections = [...new Set(input.body.sections.map(inboxSection))]
      const applied = await ctx.db.transaction(async (txn) => {
        // One lock per viewer makes the returned value match every section
        // even when two updateSeen calls race or request different sections.
        await sql`select pg_advisory_xact_lock(hashtext(${auth.credentials.iss}))`.execute(
          txn.db,
        )
        const existing = await txn.db
          .selectFrom('inbox_seen')
          .select('seenAt')
          .where('did', '=', auth.credentials.iss)
          .where('section', 'in', sections)
          .execute()
        const appliedAt = existing.reduce(
          (max, row) => (row.seenAt > max ? row.seenAt : max),
          seenAt,
        )
        await txn.db
          .insertInto('inbox_seen')
          .values(
            sections.map((section) => ({
              did: auth.credentials.iss,
              section,
              seenAt: appliedAt,
            })),
          )
          .onConflict((oc) =>
            oc.columns(['did', 'section']).doUpdateSet({
              seenAt: sql`greatest(inbox_seen."seenAt", excluded."seenAt")`,
            }),
          )
          .execute()
        return appliedAt
      })
      return { encoding: 'application/json', body: { seenAt: applied } }
    },
  })
}
