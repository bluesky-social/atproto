import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { genInvCodes } from './util'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { CodeDetail } from '../../../../services/account'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getAccountInviteCodes({
    auth: ctx.accessVerifierNotAppPassword,
    handler: async ({ params, auth }) => {
      const requester = auth.credentials.did
      const { includeUsed, createAvailable } = params

      const accntSrvc = ctx.services.account(ctx.db)

      const [user, userCodes] = await Promise.all([
        ctx.db.db
          .selectFrom('user_account')
          .where('did', '=', requester)
          .select(['invitesDisabled', 'createdAt'])
          .executeTakeFirstOrThrow(),
        accntSrvc.getAccountInviteCodes(requester),
      ])

      let created: string[] = []

      const now = new Date().toISOString()
      if (createAvailable && ctx.cfg.userInviteInterval !== null) {
        const { toCreate, total } = await calculateCodesToCreate({
          did: requester,
          userCreatedAt: new Date(user.createdAt).getTime(),
          codes: userCodes,
          epoch: ctx.cfg.userInviteEpoch,
          interval: ctx.cfg.userInviteInterval,
        })
        if (toCreate > 0) {
          created = genInvCodes(ctx.cfg, toCreate)
          const rows = created.map((code) => ({
            code: code,
            availableUses: 1,
            disabled: user.invitesDisabled,
            forUser: requester,
            createdBy: requester,
            createdAt: now,
          }))
          await ctx.db.transaction(async (dbTxn) => {
            await dbTxn.db.insertInto('invite_code').values(rows).execute()
            const finalRoutineInviteCodes = await dbTxn.db
              .selectFrom('invite_code')
              .where('forUser', '=', requester)
              .where('createdBy', '!=', 'admin') // dont count admin-gifted codes aginast the user
              .selectAll()
              .execute()
            if (finalRoutineInviteCodes.length > total) {
              throw new InvalidRequestError(
                'attempted to create additional codes in another request',
                'DuplicateCreate',
              )
            }
          })
        }
      }

      const allCodes = [
        ...userCodes,
        ...created.map((code) => ({
          code: code,
          available: 1,
          disabled: user.invitesDisabled === 1 ? true : false,
          forAccount: requester,
          createdBy: requester,
          createdAt: now,
          uses: [],
        })),
      ]

      const filtered = allCodes.filter((code) => {
        if (code.disabled) return false
        if (!includeUsed && code.uses.length >= code.available) return false
        return true
      })

      return {
        encoding: 'application/json',
        body: {
          codes: filtered,
        },
      }
    },
  })
}

/**
 * WARNING: TRICKY SUBTLE MATH - DONT MESS WITH THIS FUNCTION UNLESS YOUR'RE VERY CONFIDENT
 * if the user wishes to create available codes & the server allows that,
 * we determine the number to create by dividing their account lifetime by the interval at which they can create codes
 * if an invite epoch is provided, we only calculate available invites since that epoch
 * we allow a max of 5 open codes at a given time
 * note: even if a user is disabled from future invites, we still create the invites for bookkeeping, we just immediately disable them as well
 */
const calculateCodesToCreate = async (opts: {
  did: string
  userCreatedAt: number
  codes: CodeDetail[]
  epoch: number
  interval: number
}): Promise<{ toCreate: number; total: number }> => {
  // for the sake of generating routine interval codes, we do not count explicitly gifted admin codes
  const routineCodes = opts.codes.filter((code) => code.createdBy !== 'admin')
  const unusedRoutineCodes = routineCodes.filter(
    (row) => !row.disabled && row.available > row.uses.length,
  )

  const userLifespan = Date.now() - opts.userCreatedAt

  // how many codes a user could create within the current epoch if they have 0
  let couldCreate: number

  if (opts.userCreatedAt >= opts.epoch) {
    // if the user was created after the epoch, then they can create a code for each interval since the epoch
    couldCreate = Math.floor(userLifespan / opts.interval)
  } else {
    // if the user was created before the epoch, we:
    // - calculate the total intervals since account creation
    // - calculate the total intervals before the epoch
    // - subtract the two
    const couldCreateTotal = Math.floor(userLifespan / opts.interval)
    const userPreEpochLifespan = opts.epoch - opts.userCreatedAt
    const couldCreateBeforeEpoch = Math.floor(
      userPreEpochLifespan / opts.interval,
    )
    couldCreate = couldCreateTotal - couldCreateBeforeEpoch
  }
  // we count the codes that the user has created within the current epoch
  const epochCodes = routineCodes.filter(
    (code) => new Date(code.createdAt).getTime() > opts.epoch,
  )
  // finally we the number of codes they currently have from the number that they could create, and take a max of 5
  const toCreate = Math.min(
    5 - unusedRoutineCodes.length,
    couldCreate - epochCodes.length,
  )
  return {
    toCreate,
    total: routineCodes.length + toCreate,
  }
}
