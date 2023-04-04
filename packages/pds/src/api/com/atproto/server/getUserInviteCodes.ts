import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { genInvCodes } from './util'
import { sql } from 'kysely'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getUserInviteCodes({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ params, auth }) => {
      const requester = auth.credentials.did
      const { includeUsed, createAvailable } = params

      const [user, userCodes] = await Promise.all([
        ctx.db.db
          .selectFrom('user_account')
          .where('did', '=', requester)
          .select('createdAt')
          .executeTakeFirstOrThrow(),
        ctx.db.db
          .selectFrom('invite_code')
          .innerJoin(
            'invite_code_use',
            'invite_code_use.code',
            'invite_code.code',
          )
          .where('forUser', '=', requester)
          .groupBy('invite_code.code')
          .select([
            'invite_code.code as code',
            'invite_code.availableUses as available',
            sql<number>`count(invite_code_use.usedBy)`.as('uses'),
          ])
          .execute(),
      ])

      const unusedCodes = userCodes.filter((row) => row.available > row.uses)

      let created: string[] = []

      // if the user wishes to create available codes & the server allows that,
      // we determine the number to create by dividing their account lifetime by the interval at which they can create codes
      // we allow a max of 5 open codes at a given time
      if (createAvailable && ctx.cfg.userInviteInterval !== null) {
        const accountLifespan = Date.now() - new Date(user.createdAt).getTime()
        const couldCreate = Math.floor(
          accountLifespan / ctx.cfg.userInviteInterval,
        )
        const toCreate = Math.min(5 - unusedCodes.length, couldCreate)
        if (toCreate > 0) {
          created = genInvCodes(ctx.cfg, toCreate)
          const rows = created.map((code) => ({
            code: code,
            availableUses: 1,
            disabled: 0 as const,
            forUser: requester,
            createdBy: requester,
            createdAt: new Date().toISOString(),
          }))
          await ctx.db.db.insertInto('invite_code').values(rows).execute()
        }
      }

      const toReturn = [
        ...(includeUsed ? userCodes : unusedCodes),
        ...created.map((code) => ({ code: code, available: 1, uses: 0 })),
      ]

      return {
        encoding: 'application/json',
        body: {
          codes: toReturn,
        },
      }
    },
  })
}
