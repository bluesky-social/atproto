import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { sql } from 'kysely'
import { nullToZero } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getInviteCodeUsage({
    auth: ctx.adminVerifier,
    handler: async () => {
      const ref = ctx.db.db.dynamic.ref
      const res = await ctx.db.db
        .with('use_count', (qb) =>
          qb
            .selectFrom('invite_code_use')
            .groupBy('code')
            .select(['code', sql<number>`count(*)`.as('uses')]),
        )
        .selectFrom('invite_code')
        .leftJoin('use_count', 'use_count.code', 'invite_code.code')
        .select([
          'invite_code.createdBy as createdBy',
          'invite_code.availableUses as available',
          'invite_code.disabled as disabled',
          nullToZero(ctx.db, ref('use_count.uses')).as('uses'),
        ])
        .execute()

      const total = res.reduce(reducer, empty())
      const user = res
        .filter((row) => row.createdBy !== 'admin')
        .reduce(reducer, empty())
      const admin = res
        .filter((row) => row.createdBy === 'admin')
        .reduce(reducer, empty())

      return {
        encoding: 'application/json',
        body: {
          total,
          user,
          admin,
        },
      }
    },
  })
}

type CodesDetail = {
  count: number
  available: number
  used: number
  disabled: number
}

type Row = {
  available: number
  disabled: 1 | 0
  uses: number
}

const empty = () => ({
  count: 0,
  available: 0,
  used: 0,
  disabled: 0,
})

const reducer = (acc: CodesDetail, cur: Row) => {
  acc.count += 1
  acc.available += cur.available
  acc.disabled += cur.disabled
  acc.used += cur.uses ?? 0
  return acc
}
