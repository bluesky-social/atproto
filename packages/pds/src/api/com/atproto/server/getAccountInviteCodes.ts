import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { genInvCodes } from './util'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getAccountInviteCodes({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ params, auth }) => {
      const requester = auth.credentials.did
      const { includeUsed, createAvailable } = params

      const accntSrvc = ctx.services.account(ctx.db)

      const [user, userCodes] = await Promise.all([
        ctx.db.db
          .selectFrom('user_account')
          .where('did', '=', requester)
          .select('createdAt')
          .executeTakeFirstOrThrow(),
        accntSrvc.getAccountInviteCodes(requester),
      ])
      const unusedCodes = userCodes.filter(
        (row) => row.available > row.uses.length,
      )

      let created: string[] = []

      // if the user wishes to create available codes & the server allows that,
      // we determine the number to create by dividing their account lifetime by the interval at which they can create codes
      // we allow a max of 5 open codes at a given time
      const now = new Date().toISOString()
      if (createAvailable && ctx.cfg.userInviteInterval !== null) {
        const accountLifespan = Date.now() - new Date(user.createdAt).getTime()
        const couldCreate = Math.floor(
          accountLifespan / ctx.cfg.userInviteInterval,
        )
        const toCreate = Math.min(
          5 - unusedCodes.length,
          couldCreate - userCodes.length,
        )
        if (toCreate > 0) {
          created = genInvCodes(ctx.cfg, toCreate)
          const rows = created.map((code) => ({
            code: code,
            availableUses: 1,
            disabled: 0 as const,
            forUser: requester,
            createdBy: requester,
            createdAt: now,
          }))
          await ctx.db.transaction(async (dbTxn) => {
            await dbTxn.db.insertInto('invite_code').values(rows).execute()
            const forUser = await dbTxn.db
              .selectFrom('invite_code')
              .where('forUser', '=', requester)
              .selectAll()
              .execute()
            if (forUser.length > userCodes.length + toCreate) {
              throw new InvalidRequestError(
                'attempted to create additional codes in another request',
                'DuplicateCreate',
              )
            }
          })
        }
      }

      const preexisting = includeUsed ? userCodes : unusedCodes

      const toReturn = [
        ...preexisting,
        ...created.map((code) => ({
          code: code,
          available: 1,
          disabled: false,
          forAccount: requester,
          createdBy: requester,
          createdAt: now,
          uses: [],
        })),
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
